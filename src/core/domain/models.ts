import { z } from 'zod';
import { MAX_FILE_BYTES } from '../files/limits';

const id = z.string().uuid();
const short = z.string().max(500);
const timestamp = z.string().datetime({ offset: true });
export const fileKey = z.string().regex(/^[a-f0-9-]{36}\.jpg$/);
export const attachmentSchema = z
  .object({
    id,
    kind: z.literal('photo'),
    name: short.min(1),
    file: fileKey,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().positive().max(MAX_FILE_BYTES),
  })
  .strict();
export const reminderSchema = z
  .object({
    interval: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']),
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    deliveryMode: z.enum(['normal', 'punctualWithSound']),
    startsAtMillis: z.number().int().nonnegative(),
  })
  .strict()
  .refine((r) => r.interval !== 'weekly' || r.day <= 7, {
    message: 'Wochentag muss zwischen 1 und 7 liegen.',
  });
export const aquariumSchema = z
  .object({
    id,
    name: short.trim().min(1, 'Bitte einen Aquariennamen eingeben.'),
    volumeLiters: z
      .number()
      .finite()
      .positive('Bitte ein Volumen größer als 0 eingeben.')
      .nullable(),
    dimensions: short,
    location: short,
    reminder: reminderSchema.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
export const entrySchema = z
  .object({
    id,
    aquariumId: id,
    activity: short.trim().min(1, 'Bitte eine Aktivität eingeben.'),
    occurredAt: timestamp,
    measurement: z
      .object({
        label: short.trim().min(1, 'Bitte die Messgröße benennen.'),
        value: z.number().finite(),
        unit: short.trim(),
      })
      .strict()
      .nullable(),
    note: z.string().max(20000),
    attachments: z.array(attachmentSchema).max(200),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
export const snapshotSchema = z
  .object({
    aquariums: z.array(aquariumSchema).max(10000),
    entries: z.array(entrySchema).max(100000),
    activities: z.array(short).max(10000),
  })
  .strict();
export type Aquarium = z.infer<typeof aquariumSchema>;
export type CareEntry = z.infer<typeof entrySchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type AquariumForm = Omit<Aquarium, 'volumeLiters'> & { volume: string };
export type EntryForm = {
  activity: string;
  occurredAt: string;
  measurementLabel: string;
  value: string;
  unit: string;
  note: string;
  attachments: Attachment[];
};
export type EntryDraft = {
  id: string;
  aquariumId: string;
  entryId: string | null;
  createdAt: string;
  form: EntryForm;
  updatedAt: string;
  external: 'camera' | 'gallery' | null;
  externalReplaceId?: string;
  recoveryNotice?: string;
  captureStage?: 'choose' | 'form';
  captureSource?: 'manual' | 'photo';
};
export const defaultActivities = [
  'Wasserwechsel',
  'Filterreinigung',
  'Fütterung',
];
export const measurementLabels = ['Temperatur', 'pH-Wert'];
export const PAGE_SIZE = 10;
export function parseDecimal(input: string, field = 'Messwert'): number | null {
  const value = input.trim().replace(',', '.');
  if (!value) return null;
  if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))
    throw new Error(`${field} bitte als Zahl eingeben, zum Beispiel 24,5.`);
  return Number(value);
}
export function numberInput(value: number | null): string {
  return value === null ? '' : value.toString().replace('.', ',');
}
export function entryForm(entry: CareEntry): EntryForm {
  return {
    activity: entry.activity,
    occurredAt: entry.occurredAt,
    measurementLabel: entry.measurement?.label ?? '',
    value: numberInput(entry.measurement?.value ?? null),
    unit: entry.measurement?.unit ?? '',
    note: entry.note,
    attachments: [...entry.attachments],
  };
}
export function measurementDelta(
  current: CareEntry,
  previous: CareEntry,
): number | null {
  return current.measurement &&
    previous.measurement &&
    current.measurement.label.toLocaleLowerCase('de-DE') ===
      previous.measurement.label.toLocaleLowerCase('de-DE') &&
    current.measurement.unit === previous.measurement.unit
    ? current.measurement.value - previous.measurement.value
    : null;
}
export function snapshotFiles(data: Snapshot): string[] {
  return [
    ...new Set(data.entries.flatMap((e) => e.attachments.map((a) => a.file))),
  ];
}
export function validateSnapshot(input: unknown): Snapshot {
  const data = snapshotSchema.parse(input);
  for (const rows of [data.aquariums, data.entries])
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error('Doppelte IDs im Backup.');
  const aquariums = new Set(data.aquariums.map((a) => a.id));
  for (const entry of data.entries)
    if (
      !aquariums.has(entry.aquariumId) ||
      new Set(entry.attachments.map((a) => a.id)).size !==
        entry.attachments.length
    )
      throw new Error('Ungültige Zuordnung im Backup.');
  return data;
}
