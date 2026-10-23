import type {
  CareEntry,
  Aquarium,
  Reminder,
  EntryDraft,
  AquariumPhoto,
} from '../../core/domain/models';
import {
  measurementDelta,
  measurementText,
  measurementValueText,
} from '../../core/domain/models';

export type HistoryItem = {
  entry: CareEntry;
  photoUri?: string;
  photoCount: number;
  measurementText: string;
  comparison: string | null;
};
export function historyComparison(
  entry: CareEntry,
  previous: CareEntry | null,
): string | null {
  if (!previous) return null;
  const delta = measurementDelta(entry, previous);
  if (delta === null || !entry.measurement || !previous.measurement)
    return null;
  return `${measurementValueText(previous.measurement.value)} → ${measurementValueText(entry.measurement.value)} = ${delta.toLocaleString('de-DE')} ${entry.measurement.unit} Differenz`;
}

export type DashboardItem = {
  aquarium: Aquarium;
  latest: CareEntry | null;
  lastEdited: string;
  photo: AquariumPhoto | null;
};
export type AquariumSort = 'lastEdited' | 'name' | 'location';
export const sortLabels: Record<AquariumSort, string> = {
  lastEdited: 'Zuletzt bearbeitet',
  name: 'Name',
  location: 'Standort',
};
export const dateTime = (value: string | number) =>
  new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export function entrySummary(entry: CareEntry | null) {
  return !entry
    ? 'Noch kein Eintrag'
    : entry.activity +
        (entry.measurement ? ` · ${measurementText(entry)}` : '');
}
export function visibleAquariums(
  items: DashboardItem[],
  search: string,
  sort: AquariumSort,
) {
  const q = search.trim().toLocaleLowerCase('de-DE');
  return items
    .filter(({ aquarium: r, latest }) =>
      [
        r.name,
        r.location,
        r.dimensions,
        r.volumeLiters === null
          ? ''
          : r.volumeLiters.toLocaleString('de-DE') + ' l',
        latest ? entrySummary(latest) : '',
      ].some((v) => v.toLocaleLowerCase('de-DE').includes(q)),
    )
    .sort(
      (a, b) =>
        (sort === 'lastEdited'
          ? b.lastEdited.localeCompare(a.lastEdited)
          : sort === 'name'
            ? a.aquarium.name.localeCompare(b.aquarium.name, 'de-DE')
            : a.aquarium.location.localeCompare(
                b.aquarium.location,
                'de-DE',
              )) ||
        a.aquarium.name.localeCompare(b.aquarium.name, 'de-DE') ||
        a.aquarium.id.localeCompare(b.aquarium.id),
    );
}
export function reminderSummary(r: Reminder) {
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')} Uhr`;
  const labels = {
    hourly: `stündlich ab ${dateTime(r.startsAtMillis)}`,
    daily: `täglich um ${time}`,
    weekly: `${['montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags', 'sonntags'][r.day - 1]} um ${time}`,
    monthly: `monatlich am ${r.day}. um ${time}`,
    yearly: `jährlich am ${r.day}.${r.month}. um ${time}`,
  };
  return (
    labels[r.interval] +
    (r.deliveryMode === 'punctualWithSound' ? ' · pünktlich mit Ton' : '')
  );
}
export function capturePhase(draft: EntryDraft): 'choose' | 'form' {
  return draft.entryId ||
    draft.form.attachments.length ||
    draft.form.activity ||
    draft.form.note ||
    draft.form.measurementLabel ||
    draft.form.unit ||
    draft.form.value
    ? 'form'
    : (draft.captureStage ?? 'choose');
}

export function aquariumSummary(aquarium: Aquarium): string {
  return [
    aquarium.volumeLiters === null
      ? ''
      : `${aquarium.volumeLiters.toLocaleString('de-DE')} l`,
    aquarium.dimensions,
    aquarium.location,
  ]
    .filter(Boolean)
    .join(' · ');
}
