import { describe, expect, it } from 'vitest';
import {
  addDays,
  addDaysISO,
  eachDay,
  isISODate,
  normalizeWeekStart,
  parseISODate,
  startOfWeek,
  startOfWeekISO,
  toISODate,
  weekDates,
  weekStartFromDate,
} from '../shared/dates';

describe('ISO date helpers', () => {
  it('round-trips local dates without timezone drift', () => {
    const date = new Date(2026, 2, 8);
    expect(toISODate(date)).toBe('2026-03-08');
    expect(toISODate(parseISODate('2026-03-08'))).toBe('2026-03-08');
  });

  it('validates real calendar dates only', () => {
    expect(isISODate('2026-10-26')).toBe(true);
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-10-2026')).toBe(false);
    expect(isISODate(20261026)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29');
    expect(toISODate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('uses Monday as the start of the week', () => {
    expect(startOfWeekISO(new Date(2026, 9, 26))).toBe('2026-10-26');
    expect(startOfWeekISO(new Date(2026, 9, 25))).toBe('2026-10-19');
    expect(startOfWeekISO(new Date(2026, 9, 27))).toBe('2026-10-26');
    expect(toISODate(startOfWeek(new Date(2026, 10, 1)))).toBe('2026-10-26');
  });

  it('normalizes any date to its week start', () => {
    expect(normalizeWeekStart('2026-10-29')).toBe('2026-10-26');
    expect(weekStartFromDate('2026-11-01')).toBe('2026-10-26');
    expect(normalizeWeekStart('2026-10-26')).toBe('2026-10-26');
  });

  it('builds seven consecutive days', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(eachDay('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });
});
