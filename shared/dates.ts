/** Local-calendar date helpers. All ISO dates are YYYY-MM-DD with no timezone. */

const pad = (n: number): string => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISODate(value);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

/** Monday-based start of week, at local midnight. */
export function startOfWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

export function startOfWeekISO(date: Date = new Date()): string {
  return toISODate(startOfWeek(date));
}

export function normalizeWeekStart(iso: string): string {
  return startOfWeekISO(parseISODate(iso));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatDayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatDayNumber(iso: string): string {
  return String(parseISODate(iso).getDate());
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatMonthYear(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function relativeDayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDaysISO(today, 1)) return 'Tomorrow';
  return formatDayShort(iso);
}

export function weekStartFromDate(iso: string): string {
  return startOfWeekISO(parseISODate(iso));
}

export function eachDay(startISO: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysISO(startISO, index));
}
