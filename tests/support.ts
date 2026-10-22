import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqlRepository, migrate } from '../src/core/database/repository';
import { AquariumService } from '../src/features/entries/entry-service';
import { BackupCodec, BackupService } from '../src/core/backup/backup-service';
import { fileKey, type Aquarium } from '../src/core/domain/models';
import { PdfService } from '../src/core/pdf/pdf-service';
import { ReportService } from '../src/features/pdf/report-service';
import type {
  Environment,
  FileVault,
  PhotoValidator,
  SqlConnection,
  ReminderPort,
} from '../src/core/ports';

export const env: Environment = {
  id: randomUUID,
  now: () => new Date().toISOString(),
  random: (length) => new Uint8Array(randomBytes(length)),
};
export function connect(path: string) {
  const raw = new DatabaseSync(path);
  const db: SqlConnection = {
    async exec(sql) {
      raw.exec(sql);
    },
    async run(sql, ...params) {
      raw.prepare(sql).run(...params);
    },
    async all<T>(sql: string, ...params: (string | number | null)[]) {
      return raw.prepare(sql).all(...params) as T[];
    },
  };
  return { raw, db };
}
class NodeVault implements FileVault {
  constructor(private directory: string) {}
  uri(key: string) {
    return join(this.directory, fileKey.parse(key));
  }
  async read(key: string) {
    return new Uint8Array(await readFile(this.uri(key)));
  }
  async put(bytes: Uint8Array, extension: 'jpg' | 'pdf' = 'jpg') {
    await mkdir(this.directory, { recursive: true });
    const key = `${randomUUID()}.${extension}`;
    await writeFile(this.uri(key) + '.tmp', bytes);
    await rename(this.uri(key) + '.tmp', this.uri(key));
    return key;
  }
  async remove(key: string) {
    await rm(this.uri(key), { force: true });
  }
  async list() {
    return readdir(this.directory).catch(() => [] as string[]);
  }
}
// Android's actual image decoder is checked by PrivateFilesTest. This fake
// checks the port's invocation without loading Android in Node.
const photos: PhotoValidator = {
  async validate(bytes) {
    if (
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff ||
      bytes.at(-1) !== 0xd9
    )
      throw new Error('Invalid test JPEG');
  },
};
export async function fixture(
  reminders: ReminderPort = {
    async sync() {
      return [];
    },
  },
) {
  const root = await mkdtemp(join(tmpdir(), 'aquariumlog-test-'));
  const path = join(root, 'aquariumlog.db');
  const { raw, db } = connect(path);
  await migrate(db);
  const repo = new SqlRepository(db);
  const vault = new NodeVault(join(root, 'vault'));
  const service = new AquariumService(repo, vault, env, reminders, photos);
  const backup = new BackupService(
    service,
    new BackupCodec(
      env,
      photos,
      async (password, salt, iterations) =>
        new Uint8Array(pbkdf2Sync(password, salt, iterations, 32, 'sha256')),
    ),
  );
  const pdf = new PdfService(vault, async () => ({
    regular: new Uint8Array(
      await readFile(
        new URL('../assets/ui/Roboto-Regular.ttf', import.meta.url),
      ),
    ),
    bold: new Uint8Array(
      await readFile(new URL('../assets/ui/Roboto-Bold.ttf', import.meta.url)),
    ),
  }));
  const reports = new ReportService(service, pdf);
  return {
    root,
    path,
    raw,
    db,
    repo,
    vault,
    service,
    backup,
    env,
    inspector: photos,
    pdf,
    reports,
    async close() {
      raw.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
export async function populatedFixture() {
  const f = await fixture();
  const tank = aquarium();
  await f.service.saveAquarium(tank);
  return { ...f, aquarium: tank };
}
export function aquarium(overrides: Partial<Aquarium> = {}): Aquarium {
  return {
    id: env.id(),
    name: 'Wohnzimmer',
    volumeLiters: 180,
    dimensions: '100 × 40 × 50 cm',
    location: 'Wohnzimmer',
    reminder: null,
    createdAt: env.now(),
    updatedAt: env.now(),
    ...overrides,
  };
}
export async function photo() {
  return new Uint8Array(
    await readFile(new URL('../assets/synthetic-photo.jpg', import.meta.url)),
  );
}
