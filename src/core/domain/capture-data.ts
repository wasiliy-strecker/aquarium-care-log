import type { CareEntry, AquariumAtCapture } from './models';
import { messages } from '../texts';
export function interpolate(
  text: string,
  values: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    String(values[key] ?? match),
  );
}
export function entryDateTime(
  step: Pick<CareEntry, 'occurredAt' | 'timezoneOffsetMinutes'>,
  withZone = false,
): string {
  const offset = step.timezoneOffsetMinutes;
  const date = new Date(
    Date.parse(step.occurredAt) + (offset == null ? 0 : offset * 60000),
  );
  const text = date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(offset == null ? {} : { timeZone: 'UTC' }),
  });
  if (!withZone || offset == null) return text;
  return `${text} (UTC${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')})`;
}
export function captureDifferences(
  step: CareEntry,
  aquarium: AquariumAtCapture,
): string[][] {
  if (!step.aquariumAtCapture) return [];
  const labels = messages.reportDocument;
  return (
    [
      ['name', labels.aquarium],
      ['volumeLiters', labels.volume],
      ['dimensions', labels.dimensions],
      ['location', labels.location],
    ] as const
  )
    .filter(([key]) => step.aquariumAtCapture![key] !== aquarium[key])
    .map(([key, label]) => [
      label,
      key === 'volumeLiters'
        ? step.aquariumAtCapture!.volumeLiters === null
          ? labels.notProvided
          : `${step.aquariumAtCapture!.volumeLiters.toLocaleString('de-DE')} l`
        : String(step.aquariumAtCapture![key] || labels.notProvided),
    ]);
}
