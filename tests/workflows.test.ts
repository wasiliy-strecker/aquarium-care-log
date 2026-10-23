import { afterEach, describe, expect, it } from 'vitest';
import { SqlRepository, migrate } from '../src/core/database/repository';
import { mergePhotos } from '../src/features/media/photo-selection';
import { fixture, aquarium, photo, connect } from './support';
const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
async function setup() {
  const value = await fixture();
  fixtures.push(value);
  return value;
}
afterEach(async () => {
  for (const value of fixtures.splice(0)) await value.close();
});

describe('Real SQLite, drafts and photos', () => {
  it('preserves free-text values through drafts, reopening, editing, search and encrypted backup', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    const draft = await f.service.draft(tank.id);
    draft.form.activity = 'Wassertest';
    draft.form.measurementLabel = 'Zustand';
    draft.form.value = 'Vm nbb · <0,05 / normal 🐠';
    await f.service.persistDraft(draft);
    const reopened = connect(f.path);
    let entry;
    try {
      const repo = new SqlRepository(reopened.db);
      const restoredDraft = (await repo.drafts())[0]!;
      expect(restoredDraft.form.value).toBe(draft.form.value);
      entry = (await f.service.saveEntry(restoredDraft)).entry;
      expect((await repo.entry(entry.id))?.measurement?.value).toBe(
        draft.form.value,
      );
      expect((await repo.entries(tank.id, 'Vm nbb')).total).toBe(1);
      const edit = await f.service.draft(tank.id, entry);
      expect(edit.form.value).toBe(draft.form.value);
      edit.form.value = ' 007,20 / klar ± 🐠 ';
      entry = (await f.service.saveEntry(edit)).entry;
      expect((await repo.entry(entry.id))?.measurement?.value).toBe(
        edit.form.value,
      );
    } finally {
      reopened.raw.close();
    }
    const target = await setup();
    const password = 'AquariumLog Testpasswort';
    const bytes = await f.backup.create(password);
    await target.backup.restore(
      await target.backup.codec.decode(bytes, password),
    );
    expect((await target.repo.entry(entry.id))?.measurement).toEqual(
      entry.measurement,
    );
    const edit = await target.service.draft(tank.id, entry);
    edit.form.value = '   ';
    expect((await target.service.saveEntry(edit)).entry.measurement).toBeNull();
  });
  it('persists custom activities and optional measurements after reopening', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    const draft = await f.service.draft(tank.id);
    await expect(f.service.saveEntry(draft)).rejects.toThrow();
    draft.form.activity = 'Scheiben gereinigt';
    const { entry } = await f.service.saveEntry(draft);
    expect(entry.measurement).toBeNull();
    const reopened = connect(f.path);
    try {
      await migrate(reopened.db);
      const saved = await new SqlRepository(reopened.db).snapshot();
      expect(saved.activities).toContain('Scheiben gereinigt');
      expect(saved.aquariums[0]?.dimensions).toBe(tank.dimensions);
      expect(saved.entries[0]).toEqual(entry);
    } finally {
      reopened.raw.close();
    }
  });
  it('paginates chronologically and uses the immediately previous care entry', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    for (let index = 0; index < 12; index++) {
      const draft = await f.service.draft(tank.id);
      draft.form.activity = index === 5 ? 'Fütterung' : 'Wasserwechsel';
      draft.form.occurredAt = new Date(
        Date.UTC(2026, 8, index + 1),
      ).toISOString();
      if (index !== 5) {
        draft.form.measurementLabel = 'Temperatur';
        draft.form.value = '24,5';
        draft.form.unit = '°C';
      }
      await f.service.saveEntry(draft);
    }
    const page = await f.repo.entries(tank.id);
    expect(page.rows).toHaveLength(10);
    expect(page.total).toBe(12);
    expect(page.rows[0]?.occurredAt).toContain('2026-09-12');
    expect((await f.repo.entries(tank.id, '', 10)).rows).toHaveLength(2);
    const next = page.rows.find((entry) =>
      entry.occurredAt.startsWith('2026-09-07'),
    )!;
    expect((await f.repo.previousEntry(next))?.measurement).toBeNull();
    expect((await f.repo.entries(tank.id, '24,5')).total).toBe(11);
    expect((await f.repo.entries(tank.id, '%')).total).toBe(0);
  });
  it('retains the photo replacement target and other draft fields through process loss', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    const draft = await f.service.draft(tank.id);
    draft.form.activity = 'Filterreinigung';
    draft.form.measurementLabel = 'pH-Wert';
    draft.form.value = '7,2';
    draft.form.attachments = [
      await f.service.importPhoto(await photo(), 'Erstes.jpg'),
      await f.service.importPhoto(await photo(), 'Zweites.jpg'),
    ];
    draft.external = 'gallery';
    draft.externalReplaceId = draft.form.attachments[0]!.id;
    await f.service.persistDraft(draft);
    const reopened = connect(f.path);
    try {
      const restored = (await new SqlRepository(reopened.db).drafts())[0]!;
      const replacement = await f.service.importPhoto(
        await photo(),
        'Ersatz.jpg',
      );
      restored.form.attachments = mergePhotos(
        restored.form.attachments,
        [replacement],
        restored.externalReplaceId,
      );
      expect(restored.form.value).toBe('7,2');
      expect(restored.form.attachments.map((item) => item.name)).toEqual([
        'Ersatz.jpg',
        'Zweites.jpg',
      ]);
    } finally {
      reopened.raw.close();
    }
  });
  it('saves photo order and edits the same entry without revisions', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    const draft = await f.service.draft(tank.id);
    draft.form.activity = 'Wasserwechsel';
    draft.form.attachments = [
      await f.service.importPhoto(await photo(), 'Vorher.jpg'),
      await f.service.importPhoto(await photo(), 'Nachher.jpg'),
    ];
    const { entry } = await f.service.saveEntry(draft);
    const edit = await f.service.draft(tank.id, entry);
    edit.form.attachments.reverse();
    edit.form.note = 'Bearbeitet';
    await f.service.saveEntry(edit);
    expect((await f.repo.snapshot()).entries).toHaveLength(1);
    expect(
      (await f.repo.entry(entry.id))?.attachments.map((item) => item.name),
    ).toEqual(['Nachher.jpg', 'Vorher.jpg']);
  });
  it('keeps saved photos on failed save or discard and deletes only unreferenced files', async () => {
    const f = await setup(),
      tank = aquarium();
    await f.service.saveAquarium(tank);
    const draft = await f.service.draft(tank.id);
    draft.form.activity = 'Wasserwechsel';
    const original = await f.service.importPhoto(await photo(), 'Original.jpg');
    draft.form.attachments = [original];
    const { entry } = await f.service.saveEntry(draft);
    const edit = await f.service.draft(tank.id, entry);
    const added = await f.service.importPhoto(await photo(), 'Neu.jpg');
    edit.form.attachments = [added];
    await f.service.persistDraft(edit);
    f.raw.exec(
      "CREATE TRIGGER fail_save BEFORE UPDATE ON entries BEGIN SELECT RAISE(ABORT,'synthetic'); END;",
    );
    await expect(f.service.saveEntry(edit)).rejects.toThrow();
    expect(await f.vault.read(original.file)).toEqual(await photo());
    expect(await f.vault.read(added.file)).toEqual(await photo());
    await f.service.discard(edit);
    expect(await f.vault.read(original.file)).toEqual(await photo());
    await expect(f.vault.read(added.file)).rejects.toThrow();
    f.raw.exec('DROP TRIGGER fail_save');
    await f.service.delete('aquarium', tank.id);
    expect(await f.vault.list()).toEqual([]);
  });
});
