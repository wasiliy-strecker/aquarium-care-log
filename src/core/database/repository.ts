import { SerialQueue, type Repository, type SqlConnection } from '../ports';
import {
  type CareEntry,
  type Aquarium,
  type Snapshot,
  type EntryDraft,
  type SavedReport,
  type AquariumPhoto,
  reportSchema,
  PAGE_SIZE,
  aquariumSchema,
  entrySchema,
  validateSnapshot,
} from '../domain/models';

function latestPhotoQuery(aquariumId: '?' | 'r.id') {
  return `SELECT json_object('entryId',e.id,'activity',json_extract(e.body,'$.activity'),
    'occurredAt',e.occurred_at,'photo',json(a.value)) body
    FROM entries e,json_each(e.body,'$.attachments') a WHERE e.aquarium_id=${aquariumId}
    ORDER BY e.occurred_at DESC,e.id DESC,CAST(a.key AS INTEGER) ASC LIMIT 1`;
}

export const schemaV1 = `
CREATE TABLE aquariums (id TEXT PRIMARY KEY, body TEXT NOT NULL CHECK(json_valid(body)));
CREATE TABLE entries (id TEXT PRIMARY KEY, aquarium_id TEXT NOT NULL REFERENCES aquariums(id) ON DELETE CASCADE, occurred_at TEXT NOT NULL, search TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body)));
CREATE TABLE drafts (id TEXT PRIMARY KEY, aquarium_id TEXT NOT NULL REFERENCES aquariums(id) ON DELETE CASCADE, entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE, body TEXT NOT NULL CHECK(json_valid(body)));
CREATE TABLE activities (name TEXT PRIMARY KEY);
CREATE INDEX entries_history ON entries(aquarium_id, occurred_at DESC, id DESC);
PRAGMA user_version=1;`;
export async function migrate(db: SqlConnection): Promise<void> {
  await db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
  );
  const version =
    (await db.all<{ user_version: number }>('PRAGMA user_version'))[0]
      ?.user_version ?? 0;
  if (version > 2)
    throw new Error(
      'Die Datenbank stammt aus einer neueren AquariumLog-Version.',
    );
  if (version === 2) return;
  await db.exec('BEGIN IMMEDIATE');
  try {
    if (version === 0) await db.exec(schemaV1);
    await db.exec(`
      CREATE TABLE reports (id TEXT PRIMARY KEY, aquarium_id TEXT NOT NULL REFERENCES aquariums(id) ON DELETE CASCADE, entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE, body TEXT NOT NULL CHECK(json_valid(body)));
      CREATE INDEX reports_scope ON reports(aquarium_id,entry_id,json_extract(body,'$.createdAt') DESC,id DESC);
      PRAGMA user_version=2;
    `);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
export class SqlRepository implements Repository {
  private queue = new SerialQueue();
  constructor(private db: SqlConnection) {}
  private async bodies<T>(
    table: string,
    where = '',
    params: (string | number | null)[] = [],
  ): Promise<T[]> {
    return (
      await this.db.all<{ body: string }>(
        `SELECT body FROM ${table} ${where}`,
        ...params,
      )
    ).map((r) => JSON.parse(r.body) as T);
  }
  private write<T>(work: () => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      await this.db.exec('BEGIN IMMEDIATE');
      try {
        const value = await work();
        await this.db.exec('COMMIT');
        return value;
      } catch (error) {
        await this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }
  aquariums() {
    return this.queue.run(() =>
      this.bodies<Aquarium>(
        'aquariums',
        "ORDER BY json_extract(body, '$.name') COLLATE NOCASE",
      ),
    );
  }
  entry(id: string) {
    return this.queue.run(
      async () =>
        (await this.bodies<CareEntry>('entries', 'WHERE id=?', [id]))[0] ??
        null,
    );
  }
  dashboard() {
    return this.queue.run(async () => {
      const rows = await this.db.all<{
        body: string;
        latest: string | null;
        lastEdited: string;
        photo: string | null;
      }>(`
        SELECT r.body,
          (${latestPhotoQuery('r.id')}) photo,
          (SELECT e.body FROM entries e WHERE e.aquarium_id=r.id ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1) latest,
          max(json_extract(r.body,'$.updatedAt'),coalesce((SELECT max(json_extract(e.body,'$.updatedAt')) FROM entries e WHERE e.aquarium_id=r.id),json_extract(r.body,'$.updatedAt'))) lastEdited
        FROM aquariums r ORDER BY lastEdited DESC,r.id ASC`);
      return rows.map((row) => ({
        aquarium: JSON.parse(row.body) as Aquarium,
        latest: row.latest ? (JSON.parse(row.latest) as CareEntry) : null,
        lastEdited: row.lastEdited,
        photo: row.photo ? (JSON.parse(row.photo) as AquariumPhoto) : null,
      }));
    });
  }
  latestPhoto(aquariumId: string): Promise<AquariumPhoto | null> {
    return this.queue.run(async () => {
      const row = (
        await this.db.all<{ body: string }>(latestPhotoQuery('?'), aquariumId)
      )[0];
      return row ? (JSON.parse(row.body) as AquariumPhoto) : null;
    });
  }
  entries(aquariumId: string, search = '', offset = 0, limit = PAGE_SIZE) {
    return this.queue.run(async () => {
      const pattern = `%${search.toLocaleLowerCase('de-DE').replace(/[\\%_]/g, '\\$&')}%`;
      const clause = "WHERE aquarium_id=? AND search LIKE ? ESCAPE '\\'";
      const rows = await this.bodies<CareEntry>(
        'entries',
        `${clause} ORDER BY occurred_at DESC,id DESC LIMIT ? OFFSET ?`,
        [aquariumId, pattern, limit, offset],
      );
      const total =
        (
          await this.db.all<{ n: number }>(
            `SELECT count(*) n FROM entries ${clause}`,
            aquariumId,
            pattern,
          )
        )[0]?.n ?? 0;
      return { rows, total };
    });
  }
  previousEntry(entry: CareEntry) {
    return this.queue.run(async () => {
      const rows = await this.bodies<CareEntry>(
        'entries',
        'WHERE aquarium_id=? AND (occurred_at<? OR (occurred_at=? AND id<?)) ORDER BY occurred_at DESC,id DESC LIMIT 1',
        [entry.aquariumId, entry.occurredAt, entry.occurredAt, entry.id],
      );
      return rows[0] ?? null;
    });
  }
  reportPage(request: {
    aquariumId: string;
    entryId: string | null;
    offset: number;
  }) {
    return this.queue.run(async () => {
      const clause = 'WHERE aquarium_id=? AND entry_id IS ?';
      const params = [request.aquariumId, request.entryId];
      const total =
        (
          await this.db.all<{ n: number }>(
            `SELECT count(*) n FROM reports ${clause}`,
            ...params,
          )
        )[0]?.n ?? 0;
      const lastOffset = Math.max(
        0,
        Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE,
      );
      const offset = Math.min(
        lastOffset,
        Math.max(0, Math.floor(request.offset / PAGE_SIZE) * PAGE_SIZE),
      );
      const rows = await this.bodies<SavedReport>(
        'reports',
        `${clause} ORDER BY json_extract(body,'$.createdAt') DESC, json_extract(body,'$.groupId') DESC, json_extract(body,'$.partIndex') ASC, id DESC LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset],
      );
      return { rows, total, offset };
    });
  }
  private async putReport(report: SavedReport) {
    const r = reportSchema.parse(report);
    if (r.entryId) {
      const step = (
        await this.db.all<{ aquarium_id: string }>(
          'SELECT aquarium_id FROM entries WHERE id=?',
          r.entryId,
        )
      )[0];
      if (step?.aquarium_id !== r.aquariumId)
        throw new Error('Ungültige Pflegeeintragszuordnung im Protokoll.');
    }
    await this.db.run(
      'INSERT INTO reports VALUES (?,?,?,?)',
      r.id,
      r.aquariumId,
      r.entryId,
      JSON.stringify(r),
    );
  }
  saveReports(reports: SavedReport[]) {
    return this.write(async () => {
      for (const report of reports) await this.putReport(report);
    });
  }
  deleteReport(id: string) {
    return this.write(() => this.db.run('DELETE FROM reports WHERE id=?', id));
  }
  drafts() {
    return this.queue.run(() => this.bodies<EntryDraft>('drafts'));
  }
  snapshot(): Promise<Snapshot> {
    return this.queue.run(async () =>
      validateSnapshot({
        aquariums: await this.bodies('aquariums'),
        entries: await this.bodies('entries'),
        reports: await this.bodies('reports'),
        activities: (
          await this.db.all<{ name: string }>(
            'SELECT name FROM activities ORDER BY name',
          )
        ).map((a) => a.name),
      }),
    );
  }
  saveDraft(draft: EntryDraft) {
    return this.write(() =>
      this.db.run(
        'INSERT INTO drafts VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
        draft.id,
        draft.aquariumId,
        draft.entryId,
        JSON.stringify(draft),
      ),
    );
  }
  removeDraft(id: string) {
    return this.write(() => this.db.run('DELETE FROM drafts WHERE id=?', id));
  }
  private putAquarium(aquarium: Aquarium) {
    return this.db.run(
      'INSERT INTO aquariums VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
      aquarium.id,
      JSON.stringify(aquariumSchema.parse(aquarium)),
    );
  }
  saveAquarium(aquarium: Aquarium) {
    return this.write(() => this.putAquarium(aquarium));
  }
  private async putEntry(entry: CareEntry) {
    const e = entrySchema.parse(entry);
    const existing = (
      await this.db.all<{ aquarium_id: string }>(
        'SELECT aquarium_id FROM entries WHERE id=?',
        e.id,
      )
    )[0];
    if (existing && existing.aquarium_id !== e.aquariumId)
      throw new Error(
        'Ein Eintrag kann nicht in ein anderes Aquarium verschoben werden.',
      );
    await this.db.run(
      'INSERT INTO entries VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET occurred_at=excluded.occurred_at,search=excluded.search,body=excluded.body',
      e.id,
      e.aquariumId,
      e.occurredAt,
      `${e.activity} ${e.occurredAt} ${new Date(e.occurredAt).toLocaleDateString('de-DE')} ${e.measurement?.label ?? ''} ${e.measurement?.value ?? ''} ${e.measurement?.value.toString().replace('.', ',') ?? ''} ${e.measurement?.unit ?? ''} ${e.note} ${e.attachments.map((a) => a.name).join(' ')}`.toLocaleLowerCase(
        'de-DE',
      ),
      JSON.stringify(e),
    );
    await this.db.run(
      'INSERT OR IGNORE INTO activities VALUES (?)',
      e.activity,
    );
  }
  saveEntry(entry: CareEntry, draftId: string) {
    return this.write(async () => {
      await this.putEntry(entry);
      await this.db.run('DELETE FROM drafts WHERE id=?', draftId);
    });
  }
  deleteAquarium(id: string) {
    return this.write(() =>
      this.db.run('DELETE FROM aquariums WHERE id=?', id),
    );
  }
  deleteEntry(id: string) {
    return this.write(() => this.db.run('DELETE FROM entries WHERE id=?', id));
  }
  replace(input: Snapshot, preservedDrafts?: EntryDraft[]) {
    const data = validateSnapshot(input);
    return this.write(async () => {
      const drafts =
        preservedDrafts ?? (await this.bodies<EntryDraft>('drafts'));
      await this.db.exec(
        'DELETE FROM reports; DELETE FROM drafts; DELETE FROM entries; DELETE FROM aquariums; DELETE FROM activities;',
      );
      for (const r of data.aquariums) await this.putAquarium(r);
      for (const e of data.entries) await this.putEntry(e);
      for (const r of data.reports) await this.putReport(r);
      for (const a of data.activities)
        await this.db.run('INSERT OR IGNORE INTO activities VALUES (?)', a);
      for (const draft of drafts)
        if (
          data.aquariums.some((r) => r.id === draft.aquariumId) &&
          (!draft.entryId ||
            data.entries.some(
              (e) =>
                e.id === draft.entryId && e.aquariumId === draft.aquariumId,
            ))
        )
          await this.db.run(
            'INSERT INTO drafts VALUES (?,?,?,?)',
            draft.id,
            draft.aquariumId,
            draft.entryId,
            JSON.stringify(draft),
          );
    });
  }
}
