import { inspectPdf } from '../pdf/pdf-service';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import {
  fileKey,
  snapshotFiles,
  validateSnapshot,
  type Snapshot,
} from '../domain/models';
import { nobleBackupCrypto, type BackupCrypto } from './backup-crypto';
import {
  progressReporter,
  type OnBackupProgress,
  type ProgressReporter,
} from './backup-progress';
import { ContentLimitError, MAX_FILE_BYTES } from '../files/limits';
import type { Environment, PhotoValidator } from '../ports';
import type { AquariumService } from '../../features/entries/entry-service';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAGIC = encoder.encode('AQBACK01');
const ITERATIONS = 600000;
export const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAX_BACKUP_FILES = 30000;
// 40-byte authenticated header, 16-byte tag and 4-byte manifest length.
const CONTAINER_OVERHEAD = 60;
export function checkBackupSize(
  manifestBytes: number,
  fileBytes: number,
): void {
  if (manifestBytes > MAX_MANIFEST_BYTES)
    throw new ContentLimitError(
      'Die Textdaten und das Dateiverzeichnis des Backups überschreiten die Grenze von 16 MiB. Es wurde keine Sicherung erstellt oder übernommen.',
    );
  if (manifestBytes + fileBytes + CONTAINER_OVERHEAD > MAX_BACKUP_BYTES)
    throw new ContentLimitError(
      'Das Backup überschreitet die Grenze von 128 MB.',
    );
}
export type PasswordKey = (
  password: string,
  salt: Uint8Array,
  iterations: number,
) => Promise<Uint8Array>;
export const noblePasswordKey: PasswordKey = (password, salt, iterations) =>
  pbkdf2Async(sha256, encoder.encode(password), salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 8,
  });
const descriptorsSchema = z
  .array(
    z
      .object({
        file: fileKey,
        size: z.number().int().positive().max(MAX_FILE_BYTES),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  )
  .max(MAX_BACKUP_FILES);
const manifestSchema = z
  .object({
    format: z.literal('aquariumlog_backup'),
    version: z.literal(1),
    createdAt: z.string().datetime({ offset: true }),
    data: z.unknown(),
    files: descriptorsSchema,
  })
  .strict();
type Descriptor = z.infer<typeof descriptorsSchema>[number];
async function validateContents(
  data: Snapshot,
  files: Map<string, Uint8Array>,
  inspector: PhotoValidator,
  crypto: BackupCrypto,
  report: ProgressReporter,
  expectedDescriptors?: Descriptor[],
): Promise<Descriptor[]> {
  if (files.size > MAX_BACKUP_FILES)
    throw new ContentLimitError(
      'Das Backup überschreitet die Grenze von 30000 Dateien.',
    );
  const items = [
    ...data.entries.flatMap((step) => step.attachments),
    ...data.reports,
  ];
  const labels = new Map(items.map((item) => [item.file, item.name]));
  if (
    files.size !== snapshotFiles(data).length ||
    (expectedDescriptors && files.size !== expectedDescriptors.length)
  )
    throw new Error('Unvollständiges Inhaltsverzeichnis.');
  const expected = new Map(expectedDescriptors?.map((d) => [d.file, d]));
  if (expectedDescriptors && expected.size !== expectedDescriptors.length)
    throw new Error('Doppelte Datei im Inhaltsverzeichnis.');
  const descriptors: Descriptor[] = [];
  const verified = new Map<string, { sha256: string; size: number }>();
  await report({
    phase: 'checking',
    completedFiles: 0,
    totalFiles: files.size,
  });
  for (const [file, bytes] of files) {
    try {
      if (bytes.length > MAX_FILE_BYTES)
        throw new ContentLimitError(
          'Die Datei überschreitet die Grenze von 50 MB.',
        );
      const descriptor = descriptorsSchema.element.parse({
        file,
        size: bytes.length,
        sha256: await crypto.hash(bytes),
      });
      const original = expected.get(file);
      if (
        expectedDescriptors &&
        (!original ||
          original.size !== descriptor.size ||
          original.sha256 !== descriptor.sha256)
      )
        throw new Error('Die Datei fehlt oder ihre Prüfsumme ist ungültig.');
      if (file.endsWith('.pdf')) await inspectPdf(bytes);
      else await inspector.validate(bytes);
      verified.set(file, descriptor);
      descriptors.push(descriptor);
    } catch (error) {
      const message = `${labels.get(file) ?? 'Backup-Datei'}: ${error instanceof Error ? error.message : 'Datei nicht lesbar.'}`;
      if (error instanceof ContentLimitError)
        throw new ContentLimitError(message);
      throw new Error(message);
    }
    await report({
      phase: 'checking',
      completedFiles: verified.size,
      totalFiles: files.size,
    });
  }
  for (const item of items) {
    const file = verified.get(item.file);
    if (!file || file.sha256 !== item.sha256 || file.size !== item.size)
      throw new Error(`${item.name}: Eine Dateireferenz ist beschädigt.`);
  }
  return descriptors;
}
type DecodedBackup = {
  data: Snapshot;
  files: Map<string, Uint8Array>;
  createdAt: string;
};
function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}
function integer(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(offset);
}
export class BackupCodec {
  constructor(
    private env: Environment,
    private inspector: PhotoValidator,
    private passwordKey: PasswordKey = noblePasswordKey,
    readonly crypto: BackupCrypto = nobleBackupCrypto,
  ) {}
  async encode(
    data: Snapshot,
    files: Map<string, Uint8Array>,
    password: string,
    onProgress?: OnBackupProgress,
  ): Promise<Uint8Array> {
    if (password.length < 6 || password.length > 1024)
      throw new Error('Bitte ein Passwort mit 6 bis 1024 Zeichen verwenden.');
    if (files.size > MAX_BACKUP_FILES)
      throw new ContentLimitError(
        'Das Backup überschreitet die Grenze von 30000 Dateien.',
      );
    const validated = validateSnapshot(data);
    const fileBytes = [...files.values()].reduce((sum, b) => sum + b.length, 0);
    checkBackupSize(0, fileBytes);
    const report = progressReporter(onProgress);
    const descriptors = await validateContents(
      validated,
      files,
      this.inspector,
      this.crypto,
      report,
    );
    const metadata = {
      format: 'aquariumlog_backup',
      version: 1,
      createdAt: this.env.now(),
      data: validated,
      files: descriptors,
    };
    const manifest = encoder.encode(JSON.stringify(metadata));
    let payload: Uint8Array | undefined;
    let key: Uint8Array | undefined;
    try {
      checkBackupSize(manifest.length, fileBytes);
      manifestSchema.parse(metadata);
      payload = concatBytes(u32(manifest.length), manifest, ...files.values());
      await report({ phase: 'encrypting' });
      const salt = this.env.random(16);
      const nonce = this.env.random(12);
      const header = concatBytes(MAGIC, u32(ITERATIONS), salt, nonce);
      key = await this.passwordKey(password, salt, ITERATIONS);
      return concatBytes(
        header,
        await this.crypto.encrypt(key, nonce, header, payload),
      );
    } finally {
      key?.fill(0);
      payload?.fill(0);
      manifest.fill(0);
    }
  }
  async decode(
    bytes: Uint8Array,
    password: string,
    onProgress?: OnBackupProgress,
  ): Promise<DecodedBackup> {
    if (bytes.length > MAX_BACKUP_BYTES)
      throw new ContentLimitError(
        'Das Backup überschreitet die Grenze von 128 MB.',
      );
    if (bytes.length < 60 || !MAGIC.every((b, i) => bytes[i] === b))
      throw new Error('Keine unterstützte AquariumLog-Sicherung (.aqbackup).');
    const iterations = integer(bytes, 8);
    if (iterations !== ITERATIONS)
      throw new Error(
        'Die Backup-Version oder Schlüsselableitung wird nicht unterstützt.',
      );
    if (password.length > 1024) throw new Error('Das Passwort ist zu lang.');
    const report = progressReporter(onProgress);
    await report({ phase: 'decrypting' });
    const key = await this.passwordKey(
      password,
      bytes.subarray(12, 28),
      iterations,
    );
    let payload: Uint8Array;
    try {
      payload = await this.crypto.decrypt(
        key,
        bytes.subarray(28, 40),
        bytes.subarray(0, 40),
        bytes.subarray(40),
      );
    } catch {
      throw new Error(
        'Das Passwort ist falsch oder das Backup wurde beschädigt.',
      );
    } finally {
      key.fill(0);
    }
    try {
      const length = integer(payload, 0);
      if (length > payload.length - 4)
        throw new Error('Ungültiges Inhaltsverzeichnis.');
      checkBackupSize(length, payload.length - 4 - length);
      const raw: unknown = JSON.parse(
        decoder.decode(payload.subarray(4, 4 + length)),
      );
      if (
        raw &&
        typeof raw === 'object' &&
        'files' in raw &&
        Array.isArray(raw.files) &&
        raw.files.length > MAX_BACKUP_FILES
      )
        throw new ContentLimitError(
          'Das Backup überschreitet die Grenze von 30000 Dateien.',
        );
      const manifest = manifestSchema.parse(raw);
      const data = validateSnapshot(manifest.data);
      const files = new Map<string, Uint8Array>();
      let offset = 4 + length;
      for (const descriptor of manifest.files) {
        if (
          files.has(descriptor.file) ||
          offset + descriptor.size > payload.length
        )
          throw new Error('Doppelte oder fehlende Datei.');
        const file = payload.slice(offset, offset + descriptor.size);
        offset += descriptor.size;
        files.set(descriptor.file, file);
      }
      if (
        offset !== payload.length ||
        files.size !== snapshotFiles(data).length
      )
        throw new Error('Unvollständiges Inhaltsverzeichnis.');
      await validateContents(
        data,
        files,
        this.inspector,
        this.crypto,
        report,
        manifest.files,
      );
      return { data, files, createdAt: manifest.createdAt };
    } catch (error) {
      if (error instanceof ContentLimitError) throw error;
      throw new Error(
        'Das Backup enthält beschädigte oder unvollständige Daten. Es wurde nichts übernommen.',
      );
    } finally {
      payload.fill(0);
    }
  }
}
export class BackupService {
  constructor(
    private aquariumService: AquariumService,
    readonly codec: BackupCodec,
  ) {}
  create(password: string, onProgress?: OnBackupProgress): Promise<Uint8Array> {
    return this.aquariumService.queue.run(async () => {
      const report = progressReporter(onProgress);
      await report({ phase: 'preparing' });
      const data = await this.aquariumService.repository.snapshot();
      const keys = snapshotFiles(data);
      if (keys.length > MAX_BACKUP_FILES)
        throw new ContentLimitError(
          'Das Backup überschreitet die Grenze von 30000 Dateien.',
        );
      const files = new Map<string, Uint8Array>();
      let size = 0;
      for (const file of keys) {
        let bytes: Uint8Array;
        try {
          bytes = await this.aquariumService.vault.read(file);
        } catch {
          throw new Error(
            'Ein Anhang fehlt. Bitte die Datei ersetzen oder aus einem Backup wiederherstellen.',
          );
        }
        size += bytes.length;
        checkBackupSize(0, size);
        files.set(file, bytes);
        await report({
          phase: 'preparing',
          completedFiles: files.size,
          totalFiles: keys.length,
        });
      }
      return this.codec.encode(data, files, password, onProgress);
    });
  }
  restore(
    decoded: DecodedBackup,
    onProgress?: OnBackupProgress,
  ): Promise<{ warnings: string[] }> {
    return this.aquariumService.queue.run(async () => {
      const report = progressReporter(onProgress);
      await report({
        phase: 'restoring',
        completedFiles: 0,
        totalFiles: decoded.files.size,
      });
      const incoming = validateSnapshot(decoded.data);
      const old = await this.aquariumService.repository.snapshot();
      const drafts = await this.aquariumService.repository.drafts();
      const staged: string[] = [];
      type CheckedFile = { sha256: string; size: number };
      const checked = new Map<string, CheckedFile | null>();
      const inspectStored = async (file: string) => {
        if (checked.has(file)) return checked.get(file) ?? null;
        let bytes: Uint8Array;
        try {
          bytes = await this.aquariumService.vault.read(file);
        } catch {
          checked.set(file, null);
          return null;
        }
        const result = {
          sha256: await this.codec.crypto.hash(bytes),
          size: bytes.length,
        };
        checked.set(file, result);
        return result;
      };
      try {
        const references = new Map<string, CheckedFile[]>();
        for (const item of [
          ...incoming.entries.flatMap((step) => step.attachments),
          ...incoming.reports,
        ]) {
          const rows = references.get(item.file) ?? [];
          rows.push(item);
          references.set(item.file, rows);
        }
        if (references.size !== decoded.files.size)
          throw new Error('Unvollständiges Inhaltsverzeichnis.');
        const mapping = new Map<string, string>();
        const hashes = new Map<string, CheckedFile & { file: string }>();
        for (const [key, bytes] of decoded.files) {
          const sha256 = await this.codec.crypto.hash(bytes);
          const rows = references.get(key);
          if (
            !rows ||
            rows.some(
              (item) => item.sha256 !== sha256 || item.size !== bytes.length,
            )
          )
            throw new Error(
              'Eine Dateireferenz des Backups ist beschädigt. Es wurde nichts übernommen.',
            );
          if (key.endsWith('.pdf')) await inspectPdf(bytes);
          else await this.aquariumService.inspector.validate(bytes);
          const file = await this.aquariumService.vault.put(
            bytes,
            key.endsWith('.pdf') ? 'pdf' : 'jpg',
          );
          staged.push(file);
          const stored = await inspectStored(file);
          if (stored?.sha256 !== sha256 || stored.size !== bytes.length)
            throw new Error(
              'Eine Backup-Datei konnte nicht unverändert gespeichert werden. Es wurde nichts übernommen.',
            );
          mapping.set(key, file);
          hashes.set(sha256, { ...stored, file });
          await report({
            phase: 'restoring',
            completedFiles: staged.length,
            totalFiles: decoded.files.size,
          });
        }
        for (const item of [
          ...incoming.entries.flatMap((step) => step.attachments),
          ...incoming.reports,
        ])
          item.file = mapping.get(item.file)!;
        const aquariums = new Map(old.aquariums.map((p) => [p.id, p]));
        for (const aquarium of incoming.aquariums)
          if (
            !aquariums.has(aquarium.id) ||
            aquariums.get(aquarium.id)!.updatedAt < aquarium.updatedAt
          )
            aquariums.set(aquarium.id, aquarium);
        const steps = new Map(old.entries.map((s) => [s.id, s]));
        for (const step of incoming.entries) {
          if (
            steps.has(step.id) &&
            steps.get(step.id)!.aquariumId !== step.aquariumId
          )
            throw new Error('Widersprüchliche Aquariumzuordnung im Backup.');
          if (
            !steps.has(step.id) ||
            steps.get(step.id)!.updatedAt < step.updatedAt
          )
            steps.set(step.id, step);
        }
        const reports = new Map(old.reports.map((r) => [r.id, r]));
        for (const report of incoming.reports) {
          const existing = reports.get(report.id);
          if (
            existing &&
            (existing.aquariumId !== report.aquariumId ||
              existing.entryId !== report.entryId ||
              existing.sha256 !== report.sha256 ||
              existing.size !== report.size ||
              existing.createdAt !== report.createdAt ||
              existing.full !== report.full ||
              existing.groupId !== report.groupId ||
              existing.partIndex !== report.partIndex ||
              existing.partCount !== report.partCount)
          )
            throw new Error(
              'Widersprüchliche Protokollzuordnung im Backup. Es wurde nichts übernommen.',
            );
          if (!existing) reports.set(report.id, report);
        }
        const data: Snapshot = {
          aquariums: [...aquariums.values()],
          entries: [...steps.values()],
          activities: [...new Set([...old.activities, ...incoming.activities])],
          reports: [...reports.values()],
        };

        const items = [
          ...data.entries.flatMap((step) => step.attachments),
          ...data.reports,
          ...drafts.flatMap((draft) => draft.form.attachments),
        ];
        const keys = [...new Set(items.map((item) => item.file))];
        await report({
          phase: 'checking',
          completedFiles: 0,
          totalFiles: keys.length,
        });
        for (const [index, file] of keys.entries()) {
          await inspectStored(file);
          await report({
            phase: 'checking',
            completedFiles: index + 1,
            totalFiles: keys.length,
          });
        }
        // Preserve newer local content and drafts. Repair only with verified incoming bytes.
        for (const item of items) {
          const stored = checked.get(item.file);
          if (
            !stored ||
            stored.sha256 !== item.sha256 ||
            stored.size !== item.size
          ) {
            const repair = hashes.get(item.sha256);
            if (repair?.size === item.size) item.file = repair.file;
            // Unrelated missing local files do not invalidate the incoming backup.
          }
        }
        await report({ phase: 'restoring' });
        await this.aquariumService.repository.replace(data, drafts);
        await this.aquariumService.cleanup([...snapshotFiles(old), ...staged]);
        return { warnings: await this.aquariumService.syncReminders() };
      } catch (error) {
        await this.aquariumService.cleanup(staged);
        throw error;
      }
    });
  }
}
