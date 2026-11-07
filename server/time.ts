// Asia/Bangkok is UTC+7 all year (no daylight saving), so a fixed offset is exact.
const bangkokOffsetMs = 7 * 60 * 60_000;
const hourMs = 60 * 60_000;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/** True when year, month and day name a real calendar date (no Feb 30, no month 13). */
function isCalendarDate(year: number, month: number, day: number): boolean {
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

export const slotLengthMs = hourMs;

/** The UTC instants where a Bangkok calendar date starts and ends, or null for an invalid date. */
export function bangkokDayRange(date: unknown): { start: Date; end: Date } | null {
  if (typeof date !== 'string') return null;
  const match = datePattern.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (!isCalendarDate(year, month, day)) return null;
  const start = Date.UTC(year, month - 1, day) - bangkokOffsetMs;
  return { start: new Date(start), end: new Date(start + 24 * hourMs) };
}

/**
 * Parses an ISO timestamp that carries an explicit offset or Z. Returns null otherwise.
 * Every field is range-checked first, because Date.parse rolls impossible values over
 * (2026-02-30 becomes March 2, 24:00 becomes the next day).
 */
export function parseOffsetTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = timestampPattern.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second = 0, offsetHour = 0, offsetMinute = 0] =
    match.slice(1).map(part => (part === undefined ? undefined : Number(part))) as number[];
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59 ||
      offsetHour > 23 || offsetMinute > 59) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

/** True when the instant is a whole hour in Bangkok time. */
export function isOnTheHour(instant: Date): boolean {
  return (instant.getTime() + bangkokOffsetMs) % hourMs === 0;
}

export function slotEnd(startAt: Date): Date {
  return new Date(startAt.getTime() + slotLengthMs);
}
