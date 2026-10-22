import { afterEach, expect, it, vi } from 'vitest';
import { ExpoVault } from '../src/core/files/expo-vault';
import { ExpoMedia } from '../src/core/media/media-service';
import { populatedFixture as fixture } from './support';

const ports = vi.hoisted(() => ({
  move: vi.fn(),
  copy: vi.fn(),
  share: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('expo-file-system', () => {
  class Path {
    readonly uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((p) => (typeof p === 'string' ? p : p.uri))
        .join('/');
    }
    create() {}
    write() {}
    delete() {
      ports.remove(this.uri);
    }
    move(target: Path) {
      return ports.move(target.uri);
    }
    copy(target: Path) {
      return ports.copy(target.uri);
    }
  }
  return {
    File: Path,
    Directory: Path,
    Paths: { document: 'document', cache: 'cache' },
  };
});
vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000001',
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: ports.share,
}));
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-document-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({}));
vi.mock('../src/core/native/aquarium-native', () => ({ aquariumNative: {} }));
afterEach(() => vi.resetAllMocks());

it('returns a vault file only after moving it, and cleans the temporary file after a rejected move', async () => {
  let finish!: () => void;
  ports.move.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const vault = new ExpoVault();
  let completed = false;
  const pending = vault.put(new Uint8Array([1, 2])).then((key) => {
    completed = true;
    return key;
  });
  await Promise.resolve();
  expect(ports.move).toHaveBeenCalledOnce();
  expect(completed).toBe(false);
  finish();
  expect(await pending).toMatch(/\.jpg$/);
  ports.move.mockRejectedValueOnce(new Error('Delayed move failure'));
  await expect(vault.put(new Uint8Array([3]))).rejects.toThrow(
    'Delayed move failure',
  );
  expect(ports.remove).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/));
});

it('opens sharing only after the backup copy has finished', async () => {
  const f = await fixture();
  try {
    let finish!: () => void;
    ports.copy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const media = new ExpoMedia(f.service);
    const pending = media.shareBackup({
      uri: 'exports/prepared.aqbackup',
      name: 'AquariumLog.aqbackup',
    });
    await vi.waitFor(() => expect(ports.copy).toHaveBeenCalledOnce());
    expect(ports.share).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(ports.share).toHaveBeenCalledWith(
      'cache/shared-backups/AquariumLog.aqbackup',
      expect.any(Object),
    );
  } finally {
    await f.close();
  }
});
