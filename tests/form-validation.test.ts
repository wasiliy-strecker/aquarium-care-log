import { expect, it } from 'vitest';
import { populatedFixture as fixture, photo } from './support';
import { validateAquariumForm } from '../src/features/aquariums/aquarium-form-validation';
import { validateEntryForm } from '../src/features/entries/entry-form-validation';
import { suggestionLayout } from '../src/core/ui/suggestion-layout';
import { mergePhotos } from '../src/features/media/photo-selection';

it('marks aquarium and measurement errors at their fields, retaining optional values and zero', async () => {
  const f = await fixture();
  try {
    const { volumeLiters: _volume, ...fields } = f.aquarium;
    const aquarium = { ...fields, volume: '' };
    expect(validateAquariumForm(aquarium)).toEqual({});
    expect(
      Object.keys(
        validateAquariumForm({ ...aquarium, name: ' ', volume: '0' }),
      ),
    ).toEqual(['name', 'volume']);
    expect(validateAquariumForm({ ...aquarium, volume: '180,5' })).toEqual({});
    const { form } = await f.service.draft(f.aquarium.id);
    expect(validateEntryForm(form).activity).toBeTruthy();
    const complete = {
      ...form,
      activity: 'Wassertest',
      value: '0',
      measurementLabel: 'pH-Wert',
    };
    expect(validateEntryForm(complete)).toEqual({});
    expect(validateEntryForm({ ...complete, value: '' })).toEqual({});
    for (const value of [
      'Vm nbb',
      '<0,05',
      '24–26',
      'normal 🐠',
      ' 007,20 ',
      ' ',
    ])
      expect(validateEntryForm({ ...complete, value })).toEqual({});
    expect(
      validateEntryForm({ ...complete, measurementLabel: '' }).measurementLabel,
    ).toBeTruthy();
    expect(
      validateEntryForm({ ...complete, value: 'klar', measurementLabel: '' })
        .measurementLabel,
    ).toBeTruthy();
    expect(
      Object.keys(
        validateEntryForm({
          ...complete,
          occurredAt: '',
          note: 'x'.repeat(20001),
        }),
      ),
    ).toEqual(['occurredAt', 'note']);
  } finally {
    await f.close();
  }
});

it('places independently scrollable suggestions inside the space above the keyboard', () => {
  expect(
    suggestionLayout({ top: 100, height: 60 }, { top: 88, bottom: 500 }, 220),
  ).toEqual({ above: false, maxHeight: 220 });
  expect(
    suggestionLayout({ top: 400, height: 60 }, { top: 88, bottom: 500 }, 220),
  ).toEqual({ above: true, maxHeight: 220 });
  expect(
    suggestionLayout({ top: 150, height: 60 }, { top: 88, bottom: 230 }, 220),
  ).toEqual({ above: true, maxHeight: 50 });
  expect(
    suggestionLayout({ top: 500, height: 60 }, { top: 88, bottom: 400 }, 220)
      .maxHeight,
  ).toBe(0);
});

it('accepts more than 200 ordered photos and retains saved custom care activities', async () => {
  const f = await fixture();
  try {
    const image = await f.service.importPhoto(await photo(), 'Test.jpg');
    const draft = await f.service.draft(f.aquarium.id);
    draft.form.activity = 'Eigene Pflegeaktivität';
    const current = Array.from({ length: 200 }, () => ({
      ...image,
      id: f.env.id(),
    }));
    draft.form.attachments = mergePhotos(current, [image]);
    const { entry } = await f.service.saveEntry(draft);
    expect(
      (await f.repo.entry(entry.id))?.attachments.map((p) => p.id),
    ).toEqual([...current, image].map((p) => p.id));
    expect((await f.repo.snapshot()).activities).toContain(
      'Eigene Pflegeaktivität',
    );
  } finally {
    await f.close();
  }
});
