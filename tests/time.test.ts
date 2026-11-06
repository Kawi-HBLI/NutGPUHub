import { expect, test } from 'vitest';
import { bangkokDayRange, isOnTheHour, parseOffsetTimestamp } from '../server/time.js';

test('TC-TIME-01 uses Bangkok calendar boundaries for a selected date', () => {
  const range = bangkokDayRange('2026-11-08');
  expect(range?.start.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  expect(range?.end.toISOString()).toBe('2026-11-08T17:00:00.000Z');
  for (const invalid of ['', '2026-13-40', '2026-02-30', '2026-11-8', '08-11-2026', '2026-11-08T00:00']) {
    expect(bangkokDayRange(invalid)).toBeNull();
  }
});

test('TC-TIME-01 accepts whole Bangkok hours and rejects other times', () => {
  const onHour = parseOffsetTimestamp('2026-11-08T14:00:00+07:00');
  const offHour = parseOffsetTimestamp('2026-11-08T14:30:00+07:00');
  const halfHourOffset = parseOffsetTimestamp('2026-11-08T14:00:00+05:30');
  expect(onHour && isOnTheHour(onHour)).toBe(true);
  expect(offHour && isOnTheHour(offHour)).toBe(false);
  expect(halfHourOffset && isOnTheHour(halfHourOffset)).toBe(false);
  expect(parseOffsetTimestamp('2026-11-08T07:00:00Z')?.toISOString()).toBe('2026-11-08T07:00:00.000Z');
  for (const invalid of ['2026-11-08 14:00', '2026-11-08T14:00:00', 'tomorrow', 1_700_000_000, null]) {
    expect(parseOffsetTimestamp(invalid)).toBeNull();
  }
});
