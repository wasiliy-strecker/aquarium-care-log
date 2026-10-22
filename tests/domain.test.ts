import { describe, expect, it } from 'vitest';
import {
  aquariumSchema,
  entrySchema,
  parseDecimal,
  measurementDelta,
  validateSnapshot,
} from '../src/core/domain/models';
import { visibleAquariums } from '../src/features/aquariums/presentation-model';
import { aquarium, env } from './support';

describe('Aquarium and measurement fields', () => {
  it('accepts optional sizes, free dimensions and a required name', () => {
    expect(
      aquariumSchema.parse(aquarium({ volumeLiters: null })).volumeLiters,
    ).toBeNull();
    expect(
      aquariumSchema.safeParse(aquarium({ volumeLiters: 0 })).success,
    ).toBe(false);
    expect(aquariumSchema.safeParse(aquarium({ name: '  ' })).success).toBe(
      false,
    );
  });
  it('accepts decimals, zero and signed measurements and rejects ambiguous input', () => {
    expect(parseDecimal('24,5')).toBe(24.5);
    expect(parseDecimal('7.2')).toBe(7.2);
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('-2,5')).toBe(-2.5);
    expect(parseDecimal(' ')).toBeNull();
    for (const invalid of ['NaN', '1e3', '1,2,3', '24 °C'])
      expect(() => parseDecimal(invalid)).toThrow();
  });
  it('supports a pH measurement without a unit and distinguishes measurement names', () => {
    const tank = aquarium();
    const entry = entrySchema.parse({
      id: env.id(),
      aquariumId: tank.id,
      activity: 'Wassertest',
      occurredAt: env.now(),
      measurement: { label: 'pH-Wert', value: 7.2, unit: '' },
      note: '',
      attachments: [],
      createdAt: env.now(),
      updatedAt: env.now(),
    });
    expect(
      measurementDelta(entry, {
        ...entry,
        measurement: { label: 'pH-Wert', value: 7, unit: '' },
      }),
    ).toBeCloseTo(0.2);
    expect(
      measurementDelta(entry, {
        ...entry,
        measurement: { label: 'Nitrit', value: 7, unit: '' },
      }),
    ).toBeNull();
    expect(measurementDelta(entry, { ...entry, measurement: null })).toBeNull();
    expect(() =>
      entrySchema.parse({
        ...entry,
        measurement: { label: '', value: 7.2, unit: '' },
      }),
    ).toThrow();
    expect(() =>
      validateSnapshot({ aquariums: [], entries: [entry], activities: [] }),
    ).toThrow();
  });
  it('searches aquarium size and location and sorts by name', () => {
    const alpha = aquarium({ name: 'Alpha' }),
      beta = aquarium({ name: 'Beta', location: 'Küche', volumeLiters: 60 });
    const items = [beta, alpha].map((tank) => ({
      aquarium: tank,
      latest: null,
      photo: null,
      lastEdited: tank.updatedAt,
    }));
    expect(
      visibleAquariums(items, '60', 'name').map((item) => item.aquarium.id),
    ).toEqual([beta.id]);
    expect(
      visibleAquariums(items, '', 'name').map((item) => item.aquarium.name),
    ).toEqual(['Alpha', 'Beta']);
  });
});
