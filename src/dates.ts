import type { Frequency } from './types';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// All helpers work in local time so a "day" matches the user's calendar.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function periodStart(d: Date, freq: Frequency): Date {
  if (freq === 'weekly') return startOfWeek(d);
  if (freq === 'monthly') return startOfMonth(d);
  return startOfDay(d);
}

export function periodKey(d: Date, freq: Frequency): string {
  return toKey(periodStart(d, freq));
}

export function previousPeriod(start: Date, freq: Frequency): Date {
  if (freq === 'weekly') return addDays(start, -7);
  if (freq === 'monthly') return addMonths(start, -1);
  return addDays(start, -1);
}

export function formatPeriod(key: string, freq: Frequency): string {
  const d = fromKey(key);
  if (freq === 'monthly') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (freq === 'weekly') {
    const end = addDays(d, 6);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function periodNoun(freq: Frequency): string {
  return freq === 'daily' ? 'day' : freq === 'weekly' ? 'week' : 'month';
}
