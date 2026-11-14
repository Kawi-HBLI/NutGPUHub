import { expect, test } from 'vitest';
import { bangkokDayRange, isOnTheHour, parseOffsetTimestamp } from '../server/time.js';

test('TC-TIME-01 uses Bangkok calendar boundaries for a selected date', () => {
  const range = bangkokDayRange('2026-11-08');
  expect(range?.start.toISOString()).toBe('2026-11-07T18:00:00.000Z');
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

test('TC-TIME-01 rejects calendar dates and clock times that do not exist instead of rolling them over', () => {
  for (const invalid of [
    '2026-02-30T14:00:00+07:00', // February 30 would roll over to March 2
    '2026-04-31T14:00:00+07:00',
    '2026-02-29T14:00:00+07:00', // 2026 is not a leap year
    '2026-13-01T14:00:00+07:00',
    '2026-11-08T24:00:00+07:00', // 24:00 would roll over to the next day
    '2026-11-08T14:60:00+07:00',
    '2026-11-08T14:00:60+07:00',
    '2026-11-08T14:00:00+24:00',
    '2026-11-08T14:00:00+07:60',
  ]) {
    expect(parseOffsetTimestamp(invalid), invalid).toBeNull();
  }
  expect(parseOffsetTimestamp('2028-02-29T14:00:00+07:00')?.toISOString()).toBe('2028-02-29T07:00:00.000Z');
});
