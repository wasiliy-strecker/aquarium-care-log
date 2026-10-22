import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { populatedFixture as fixture } from './support';
import {
  BackupCodec,
  BackupService,
  type PasswordKey,
} from '../src/core/backup/backup-service';
import { expoBackupCrypto } from '../src/core/backup/expo-backup-crypto';
import { nobleBackupCrypto } from '../src/core/backup/backup-crypto';
import type { Snapshot } from '../src/core/domain/models';
import type { BackupProgress } from '../src/core/backup/backup-progress';
// Keep Expo's real JS wrappers. Replace only the Android/JSI boundary with
// independent OpenSSL primitives, including Android's synchronous digest API.
const native = await vi.hoisted(async () => {
  const { createCipheriv, createDecipheriv, createHash } =
    await import('node:crypto');
  const hash = vi.fn(
    (algorithm: string, output: Uint8Array, input: Uint8Array) => {
      if (algorithm !== 'SHA-256') throw new Error('Unexpected algorithm');
      output.set(createHash('sha256').update(input).digest());
    },
  );
  const importKey = vi.fn(async (bytes: Uint8Array) => ({
    bytes: bytes.slice(),
  }));
  const extract = vi.fn();
  class SealedData {
    constructor(
      readonly nonce: Uint8Array,
      readonly bytes: Uint8Array,
    ) {}
    static fromParts(nonce: Uint8Array, bytes: Uint8Array, tagLength: number) {
      if (tagLength !== 16) throw new Error('Unexpected tag length');
      return new SealedData(nonce, bytes);
    }
    async ciphertext(options: { includeTag: boolean; encoding: string }) {
      extract(options);
      if (!options.includeTag || options.encoding !== 'bytes')
        throw new Error('Unexpected ciphertext format');
      return this.bytes.slice();
    }
  }
  const encrypt = vi.fn(
    async (
      plaintext: Uint8Array,
      key: { bytes: Uint8Array },
      options: { nonce: string; additionalData: string; tagLength: number },
    ) => {
      if (!(plaintext instanceof Uint8Array) || options.tagLength !== 16)
        throw new Error('Expected binary plaintext and a 16-byte tag');
      const nonce = Buffer.from(options.nonce, 'base64');
      const cipher = createCipheriv('aes-256-gcm', key.bytes, nonce);
      cipher.setAAD(Buffer.from(options.additionalData, 'base64'));
      return new SealedData(
        nonce,
        new Uint8Array(
          Buffer.concat([
            cipher.update(plaintext),
            cipher.final(),
            cipher.getAuthTag(),
          ]),
        ),
      );
    },
  );
  const decrypt = vi.fn(
    async (
      sealed: SealedData,
      key: { bytes: Uint8Array },
      options: { additionalData: string; output: string },
    ) => {
      if (!(sealed.bytes instanceof Uint8Array) || options.output !== 'bytes')
        throw new Error('Expected binary ciphertext and output');
      const decipher = createDecipheriv('aes-256-gcm', key.bytes, sealed.nonce);
      decipher.setAAD(Buffer.from(options.additionalData, 'base64'));
      decipher.setAuthTag(sealed.bytes.subarray(-16));
      return new Uint8Array(
        Buffer.concat([
          decipher.update(sealed.bytes.subarray(0, -16)),
          decipher.final(),
        ]),
      );
    },
  );
  return {
    hash,
    importKey,
    extract,
    encrypt,
    decrypt,
    aes: {
      EncryptionKey: class {
        static import = importKey;
      },
      SealedData,
      encryptAsync: encrypt,
      decryptAsync: decrypt,
    },
  };
});
vi.mock('expo', () => ({ requireNativeModule: () => native.aes }));
vi.mock('expo-modules-core', () => ({
  requireNativeModule: () => ({ digest: native.hash }),
  UnavailabilityError: class extends Error {},
}));

const password = 'AquariumLog Testpasswort';
const passwordKey: PasswordKey = async (value, salt, iterations) =>
  new Uint8Array(pbkdf2Sync(value, salt, iterations, 32, 'sha256'));
const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
async function setup() {
  const f = await fixture();
  fixtures.push(f);
  const codec = new BackupCodec(
    f.env,
    f.inspector,
    passwordKey,
    expoBackupCrypto,
  );
  return { ...f, codec, backup: new BackupService(f.service, codec) };
}
const legacy = async () =>
  new Uint8Array(
    await readFile(new URL('./fixtures/backup-v1.bin', import.meta.url)),
  );
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  vi.restoreAllMocks();
  for (const f of fixtures.splice(0)) await f.close();
});

it('reads the pre-migration archive through the actual Expo wrappers and retains full history and photo order', async () => {
  const f = await setup();
  const expected = JSON.parse(
    await readFile(
      new URL('./fixtures/backup-v1.json', import.meta.url),
      'utf8',
    ),
  ) as Snapshot;
  const decoded = await f.codec.decode(await legacy(), password);
  expect(decoded.data).toEqual({ ...expected, reports: [] });
  const androidValidatedPhoto = new Uint8Array(
    await readFile(new URL('../assets/synthetic-photo.jpg', import.meta.url)),
  );
  for (const bytes of decoded.files.values())
    expect(bytes).toEqual(androidValidatedPhoto);
  expect(native.hash).toHaveBeenCalledTimes(1);
  await f.backup.restore(decoded);
  const restored = (await f.repo.snapshot()).entries;
  expect(
    restored.map((s) => [s.activity, s.attachments.map((p) => p.name)]),
  ).toEqual(
    expected.entries.map((s) => [s.activity, s.attachments.map((p) => p.name)]),
  );
  for (const item of restored.flatMap((s) => s.attachments))
    expect(
      createHash('sha256')
        .update(await f.vault.read(item.file))
        .digest('hex'),
    ).toBe(item.sha256);
});

it('reads and hashes each unique photo only once on export and reports progress', async () => {
  const f = await setup();
  await f.backup.restore(await f.codec.decode(await legacy(), password));
  const before = await f.repo.snapshot();
  const read = vi.spyOn(f.vault, 'read');
  vi.clearAllMocks();
  const progress: BackupProgress[] = [];
  const bytes = await f.backup.create(password, (p) => progress.push(p));
  expect(read).toHaveBeenCalledTimes(1);
  expect(native.hash).toHaveBeenCalledTimes(1);
  expect(native.encrypt).toHaveBeenCalledOnce();
  expect(progress[0]?.phase).toBe('preparing');
  expect(progress).toContainEqual({
    phase: 'checking',
    completedFiles: 1,
    totalFiles: 1,
  });
  expect(progress.at(-1)?.phase).toBe('encrypting');
  const independent = new BackupCodec(f.env, f.inspector, passwordKey);
  expect((await independent.decode(bytes, password)).data).toEqual(before);
});

it.each(['changed input', 'corrupt write', 'database failure'] as const)(
  'aborts %s without replacing data or leaving staged files',
  async (kind) => {
    const f = await setup();
    const decoded = await f.codec.decode(await legacy(), password);
    const draft = await f.service.draft(f.aquarium.id);
    const before = await f.repo.snapshot();
    if (kind === 'changed input')
      decoded.files.values().next().value![10]! ^= 1;
    if (kind === 'corrupt write') {
      const put = f.vault.put.bind(f.vault);
      vi.spyOn(f.vault, 'put').mockImplementation(async (bytes) => {
        const key = await put(bytes);
        await writeFile(f.vault.uri(key), new Uint8Array([1, 2, 3]));
        return key;
      });
    }
    if (kind === 'database failure')
      f.raw.exec(
        "CREATE TRIGGER reject_restore BEFORE INSERT ON entries BEGIN SELECT RAISE(ABORT,'SYNTHETIC_SQL_FAILURE'); END;",
      );
    await expect(f.backup.restore(decoded)).rejects.toThrow();
    expect(await f.repo.snapshot()).toEqual(before);
    expect(await f.repo.drafts()).toEqual([draft]);
    expect(await f.vault.list()).toEqual([]);
  },
);

it('preserves exact binary slices at the native boundary and clears secrets after failure', async () => {
  const storage = new Uint8Array(64 * 1024 + 100).fill(7);
  const bytes = storage.subarray(31, -17);
  bytes.fill(42);
  expect(await expoBackupCrypto.hash(bytes)).toBe(
    createHash('sha256').update(bytes).digest('hex'),
  );
  const key = new Uint8Array(32).fill(8),
    nonce = new Uint8Array(12).fill(9),
    header = new Uint8Array(40).fill(10);
  const encrypted = await expoBackupCrypto.encrypt(key, nonce, header, bytes);
  expect(
    await nobleBackupCrypto.decrypt(key, nonce, header, encrypted),
  ).toEqual(bytes);
  expect(await expoBackupCrypto.decrypt(key, nonce, header, encrypted)).toEqual(
    bytes,
  );
  const f = await setup();
  let derived: Uint8Array | undefined, cleartext: Uint8Array | undefined;
  const failing = new BackupCodec(
    f.env,
    f.inspector,
    async (...args) => {
      derived = await passwordKey(...args);
      return derived;
    },
    {
      ...expoBackupCrypto,
      async encrypt(_key, _nonce, _header, payload) {
        cleartext = payload;
        throw new Error('Synthetic native failure');
      },
    },
  );
  await expect(
    failing.encode(
      { aquariums: [], entries: [], reports: [], activities: [] },
      new Map(),
      password,
    ),
  ).rejects.toThrow('Synthetic native failure');
  expect(derived?.every((b) => b === 0)).toBe(true);
  expect(cleartext?.every((b) => b === 0)).toBe(true);
});
