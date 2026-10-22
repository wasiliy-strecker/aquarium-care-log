import { expect, it } from 'vitest';
import { populatedFixture as fixture, photo } from './support';

it('keeps latest progress independent of cover selection and follows saved photo order, edits and deletion', async () => {
  const f = await fixture();
  try {
    const a = await f.service.importPhoto(await photo(), 'A.jpg');
    const b = await f.service.importPhoto(await photo(), 'B.jpg');
    const old = await f.service.draft(f.aquarium.id);
    old.form = {
      ...old.form,
      activity: '99',
      occurredAt: '2026-10-01T12:00:00.000Z',
      attachments: [b, a],
    };
    const saved = (await f.service.saveEntry(old)).entry;
    for (let i = 0; i < 12; i++) {
      const newer = await f.service.draft(f.aquarium.id);
      newer.form = {
        ...newer.form,
        activity: String(i),
        occurredAt: new Date(Date.UTC(2026, 9, i + 2)).toISOString(),
      };
      await f.service.saveEntry(newer);
    }
    expect((await f.repo.dashboard())[0]?.latest?.activity).toBe('11');
    expect((await f.repo.dashboard())[0]?.photo?.photo.id).toBe(b.id);
    expect((await f.repo.latestPhoto(f.aquarium.id))?.entryId).toBe(saved.id);
    const edit = await f.service.draft(f.aquarium.id, saved);
    edit.form.attachments = [a, b];
    await f.service.saveEntry(edit);
    expect((await f.repo.latestPhoto(f.aquarium.id))?.photo.id).toBe(a.id);
    expect((await f.repo.dashboard())[0]?.photo?.photo.id).toBe(a.id);
    await f.service.delete('entry', saved.id);
    expect(await f.repo.latestPhoto(f.aquarium.id)).toBeNull();
    expect((await f.repo.dashboard())[0]?.photo).toBeNull();
    expect((await f.repo.dashboard())[0]?.latest?.activity).toBe('11');
  } finally {
    await f.close();
  }
});
