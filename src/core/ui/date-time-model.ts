export function localDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
}
export function parseDateInput(
  value: string,
  first: Date,
  last: Date,
): Date | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]),
    month = Number(match[2]) - 1,
    year = Number(match[3]);
  const result = new Date(year, month, day);
  return result.getDate() === day &&
    result.getMonth() === month &&
    result.getFullYear() === year &&
    result >= first &&
    result <= last
    ? result
    : null;
}
export function calendarCells(month: Date): (number | null)[] {
  const start =
    (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, i) =>
    i >= start && i < start + days ? i - start + 1 : null,
  );
}
