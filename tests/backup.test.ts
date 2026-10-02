import { afterEach, describe, expect, it } from 'vitest';
import { fixture, aquarium, photo } from './support';
const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
async function setup() {
  const value = await fixture();
  fixtures.push(value);
  return value;
}
afterEach(async () => {
  for (const value of fixtures.splice(0)) await value.close();
});
const password = 'AquariumLog Testpasswort';
async function prepared() {
  const f = await setup(),
    tank = aquarium({
      reminder: {
        interval: 'weekly',
        day: 2,
        month: 1,
        hour: 9,
        minute: 30,
        deliveryMode: 'normal',
        startsAtMillis: 0,
      },
    });
  await f.service.saveAquarium(tank);
  const draft = await f.service.draft(tank.id);
  draft.form.activity = 'Wasserwerte geprüft';
  draft.form.measurementLabel = 'pH-Wert';
  draft.form.value = '7,2';
  draft.form.attachments = [
    await f.service.importPhoto(await photo(), 'Test.jpg'),
  ];
  const { entry } = await f.service.saveEntry(draft);
  const storedTank = (await f.repo.aquariums()).find(
    (item) => item.id === tank.id,
  )!;
  return { f, tank: storedTank, entry, bytes: await f.backup.create(password) };
}
describe('Encrypted aquarium backups', () => {
  it('round trips sizes, custom activity, pH, reminders and photos with its own format', async () => {
    const { bytes, tank, entry } = await prepared(),
      target = await setup();
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe('AQBACK01');
    expect(Buffer.from(bytes).includes(Buffer.from('Wohnzimmer'))).toBe(false);
    const decoded = await target.backup.codec.decode(bytes, password);
    await target.backup.restore(decoded);
    const restored = await target.repo.snapshot();
    expect(restored.aquariums).toEqual([tank]);
    expect(restored.entries[0]?.measurement).toEqual({
      label: 'pH-Wert',
      value: 7.2,
      unit: '',
    });
    expect(restored.activities).toContain(entry.activity);
    expect(
      await target.vault.read(restored.entries[0]!.attachments[0]!.file),
    ).toEqual(await photo());
  });
  it('rejects wrong passwords, tampering and Hausakte containers without changing local data', async () => {
    const { f, bytes } = await prepared(),
      before = await f.repo.snapshot();
    await expect(f.backup.codec.decode(bytes, 'wrong')).rejects.toThrow(
      /Passwort/,
    );
    const tampered = bytes.slice();
    tampered[tampered.length - 20]! ^= 1;
    await expect(f.backup.codec.decode(tampered, password)).rejects.toThrow(
      /beschädigt/,
    );
    const foreign = bytes.slice();
    foreign.set(new TextEncoder().encode('HABACK01'));
    await expect(f.backup.codec.decode(foreign, password)).rejects.toThrow(
      /AquariumLog/,
    );
    await expect(f.backup.create('12345')).rejects.toThrow(/6 bis 1024/);
    expect(await f.repo.snapshot()).toEqual(before);
  });
  it('retains newer local entries and drafts during restore', async () => {
    const { f, bytes, tank, entry } = await prepared();
    const edit = await f.service.draft(tank.id, entry);
    edit.form.note = 'Neuer lokaler Stand';
    const saved = await f.service.saveEntry(edit);
    const draft = await f.service.draft(tank.id, saved.entry);
    draft.form.note = 'Ungespeicherter Entwurf';
    await f.service.persistDraft(draft);
    await f.backup.restore(await f.backup.codec.decode(bytes, password));
    expect((await f.repo.entry(entry.id))?.note).toBe('Neuer lokaler Stand');
    expect((await f.repo.drafts())[0]?.form.note).toBe(
      'Ungespeicherter Entwurf',
    );
  });
  it('rolls back a failed import without losing existing records or retaining staged photos', async () => {
    const { bytes } = await prepared(),
      target = await setup();
    await target.service.saveAquarium(aquarium({ name: 'Lokales Aquarium' }));
    const before = await target.repo.snapshot();
    target.raw.exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON entries BEGIN SELECT RAISE(ABORT,'synthetic'); END;",
    );
    const decoded = await target.backup.codec.decode(bytes, password);
    await expect(target.backup.restore(decoded)).rejects.toThrow();
    expect(await target.repo.snapshot()).toEqual(before);
    expect(await target.vault.list()).toEqual([]);
  });
});
