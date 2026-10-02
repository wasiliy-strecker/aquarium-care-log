import { gcm } from '@noble/ciphers/aes.js';
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
import { digest, verifiedFile } from '../files/integrity';
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
  descriptors: Descriptor[],
  photos: PhotoValidator,
): Promise<void> {
  if (descriptors.length > MAX_BACKUP_FILES)
    throw new ContentLimitError(
      'Das Backup überschreitet die Grenze von 30000 Dateien.',
    );
  const items = data.entries.flatMap((e) => e.attachments);
  const labels = new Map(
    items.map((item) => [item.file, `Foto „${item.name}“`]),
  );
  if (
    files.size !== snapshotFiles(data).length ||
    files.size !== descriptors.length
  )
    throw new Error('Unvollständiges Inhaltsverzeichnis.');
  const verified = new Map<string, { sha256: string; size: number }>();
  for (const descriptor of descriptors) {
    try {
      if (descriptor.size > MAX_FILE_BYTES)
        throw new ContentLimitError(
          'Die Datei überschreitet die Grenze von 50 MB.',
        );
      descriptorsSchema.element.parse(descriptor);
      const bytes = files.get(descriptor.file);
      if (
        !bytes ||
        verified.has(descriptor.file) ||
        bytes.length !== descriptor.size ||
        digest(bytes) !== descriptor.sha256
      )
        throw new Error('Die Datei fehlt oder ihre Prüfsumme ist ungültig.');
      await photos.validate(bytes);
      verified.set(descriptor.file, {
        size: bytes.length,
        sha256: descriptor.sha256,
      });
    } catch (error) {
      const message = `${labels.get(descriptor.file) ?? 'Backup-Datei'}: ${error instanceof Error ? error.message : 'Datei nicht lesbar.'}`;
      if (error instanceof ContentLimitError)
        throw new ContentLimitError(message);
      throw new Error(message);
    }
  }
  for (const item of items) {
    const file = verified.get(item.file);
    if (
      !file ||
      file.sha256 !== item.sha256 ||
      ('size' in item && file.size !== item.size)
    )
      throw new Error(
        `${labels.get(item.file)}: Eine Anhangsreferenz ist beschädigt.`,
      );
  }
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
    private photos: PhotoValidator,
    private passwordKey: PasswordKey = noblePasswordKey,
  ) {}
  async encode(
    data: Snapshot,
    files: Map<string, Uint8Array>,
    password: string,
  ): Promise<Uint8Array> {
    if (password.length < 6 || password.length > 1024)
      throw new Error('Bitte ein Passwort mit 6 bis 1024 Zeichen verwenden.');
    if (files.size > MAX_BACKUP_FILES)
      throw new ContentLimitError(
        'Das Backup überschreitet die Grenze von 30000 Dateien.',
      );
    const validated = validateSnapshot(data);
    const descriptors = [...files].map(([file, bytes]) => ({
      file,
      size: bytes.length,
      sha256: digest(bytes),
    }));
    const metadata = {
      format: 'aquariumlog_backup',
      version: 1,
      createdAt: this.env.now(),
      data: validated,
      files: descriptors,
    };
    const manifest = encoder.encode(JSON.stringify(metadata));
    checkBackupSize(
      manifest.length,
      [...files.values()].reduce((sum, b) => sum + b.length, 0),
    );
    await validateContents(validated, files, descriptors, this.photos);
    manifestSchema.parse(metadata);
    const payload = concatBytes(
      u32(manifest.length),
      manifest,
      ...files.values(),
    );
    const salt = this.env.random(16);
    const nonce = this.env.random(12);
    const header = concatBytes(MAGIC, u32(ITERATIONS), salt, nonce);
    const key = await this.passwordKey(password, salt, ITERATIONS);
    try {
      return concatBytes(header, gcm(key, nonce, header).encrypt(payload));
    } finally {
      key.fill(0);
      payload.fill(0);
    }
  }
  async decode(bytes: Uint8Array, password: string): Promise<DecodedBackup> {
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
    const key = await this.passwordKey(
      password,
      bytes.slice(12, 28),
      iterations,
    );
    let payload: Uint8Array;
    try {
      payload = gcm(key, bytes.slice(28, 40), bytes.slice(0, 40)).decrypt(
        bytes.slice(40),
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
      await validateContents(data, files, manifest.files, this.photos);
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
  create(password: string): Promise<Uint8Array> {
    return this.aquariumService.queue.run(async () => {
      const data = await this.aquariumService.repository.snapshot();
      const files = new Map<string, Uint8Array>();
      let size = 0;
      for (const item of [...data.entries.flatMap((e) => e.attachments)]) {
        const bytes = await verifiedFile(this.aquariumService.vault, item);
        if (!files.has(item.file)) size += bytes.length;
        checkBackupSize(0, size);
        files.set(item.file, bytes);
      }
      return this.codec.encode(data, files, password);
    });
  }
  restore(decoded: DecodedBackup): Promise<{ warnings: string[] }> {
    return this.aquariumService.queue.run(async () => {
      const old = await this.aquariumService.repository.snapshot();
      const staged: string[] = [];
      try {
        const mapping = new Map<string, string>();
        const hashes = new Map<string, string>();
        for (const [key, bytes] of decoded.files) {
          const file = await this.aquariumService.vault.put(bytes, 'jpg');
          staged.push(file);
          mapping.set(key, file);
          hashes.set(digest(bytes), file);
        }
        const incoming = JSON.parse(JSON.stringify(decoded.data)) as Snapshot;
        for (const item of [...incoming.entries.flatMap((e) => e.attachments)])
          item.file = mapping.get(item.file)!;
        const aquariums = new Map(old.aquariums.map((r) => [r.id, r]));
        for (const aquarium of incoming.aquariums)
          if (
            !aquariums.has(aquarium.id) ||
            aquariums.get(aquarium.id)!.updatedAt < aquarium.updatedAt
          )
            aquariums.set(aquarium.id, aquarium);
        const entries = new Map(old.entries.map((e) => [e.id, e]));
        for (const entry of incoming.entries)
          if (
            !entries.has(entry.id) ||
            entries.get(entry.id)!.updatedAt < entry.updatedAt
          )
            entries.set(entry.id, entry);
        const data: Snapshot = {
          aquariums: [...aquariums.values()],
          entries: [...entries.values()],
          activities: [...new Set([...old.activities, ...incoming.activities])],
        };
        // Repair missing matching files without rolling back newer entry content.
        for (const item of [...data.entries.flatMap((e) => e.attachments)]) {
          try {
            await verifiedFile(this.aquariumService.vault, item);
          } catch {
            const repaired = hashes.get(item.sha256);
            if (repaired) item.file = repaired;
            // Unrelated missing local files do not invalidate the incoming backup.
          }
        }
        await this.aquariumService.repository.replace(data);
        await this.aquariumService.cleanup([...snapshotFiles(old), ...staged]);
        return { warnings: await this.aquariumService.syncReminders() };
      } catch (error) {
        await this.aquariumService.cleanup(staged);
        throw error;
      }
    });
  }
}
