import { fromKey, nextPeriod, periodStart, previousPeriod, toKey, weekdayIndex } from './dates';
import type { Habit } from './types';

/** Entry values logged for one period (empty if none). */
export function periodEntries(habit: Habit, key: string): number[] {
  return habit.entries[key] ?? [];
}

export function periodCount(habit: Habit, key: string): number {
  return periodEntries(habit, key).length;
}

export function hasTarget(habit: Habit): boolean {
  return habit.target >= 1;
}

/** Whether the period reached the target number of entries; without a target, whether anything was logged. */
export function targetMet(habit: Habit, key: string): boolean {
  return periodCount(habit, key) >= Math.max(1, habit.target);
}

/** 0..1 strength of one intensity value. */
export function valueStrength(habit: Habit, value: number): number {
  if (value <= 0) return 0;
  if (habit.kind === 'boolean') return 1;
  return Math.min(1, value / Math.max(1, habit.maxValue));
}

/**
 * 0..1 strength of a period, used to fade the tile colour and score efficiency.
 * Progress towards the target (any entry counts as 100% without one), times the average intensity
 * for value habits: 2 of 3 entries → 0.67; one entry of 6/10 with no target → 0.6.
 */
export function periodStrength(habit: Habit, key: string): number {
  const values = periodEntries(habit, key);
  if (values.length === 0) return 0;
  const progress = Math.min(1, values.length / Math.max(1, habit.target));
  if (habit.kind === 'boolean') return progress;
  const avg = values.reduce((s, v) => s + valueStrength(habit, v), 0) / values.length;
  return progress * avg;
}

/** Most streak freezes a habit can use per month (per year for monthly habits). */
export const FREEZE_LIMIT = 2;

/** A planned rest day of a daily habit. */
export function isRestDay(habit: Habit, key: string): boolean {
  return habit.frequency === 'daily' && habit.restDays.includes(weekdayIndex(fromKey(key)));
}

export function isFrozen(habit: Habit, key: string): boolean {
  return habit.freezes.includes(key);
}

/**
 * Why a period that missed its target is excused: a planned rest day or a streak freeze. Excused periods
 * keep a streak alive (without adding to it) and are left out of Summary. Null when the target was met.
 */
export function excusal(habit: Habit, key: string): 'rest' | 'freeze' | null {
  if (targetMet(habit, key)) return null;
  if (isFrozen(habit, key)) return 'freeze';
  if (isRestDay(habit, key)) return 'rest';
  return null;
}

/** The month (or year, for monthly habits) whose freeze allowance a period uses: "YYYY-MM" or "YYYY". */
function freezeWindow(habit: Habit, key: string): string {
  return habit.frequency === 'monthly' ? key.slice(0, 4) : key.slice(0, 7);
}

/** Freezes still available in the window of the period starting at `key`. */
export function freezesLeft(habit: Habit, key: string): number {
  const w = freezeWindow(habit, key);
  return Math.max(0, FREEZE_LIMIT - habit.freezes.filter((k) => freezeWindow(habit, k) === w).length);
}

/** A freeze can cover a missed, non-rest period up to the current one, while the allowance lasts. */
export function canFreeze(habit: Habit, key: string, today = new Date()): boolean {
  if (isFrozen(habit, key) || targetMet(habit, key) || isRestDay(habit, key)) return false;
  if (key > toKey(periodStart(today, habit.frequency))) return false;
  return freezesLeft(habit, key) > 0;
}

/** The first period the habit can be judged on: its creation, or an earlier back-filled entry. */
export function firstPeriod(habit: Habit): Date {
  let first = fromKey(habit.createdAt);
  for (const k of Object.keys(habit.entries)) {
    const d = fromKey(k);
    if (d < first) first = d;
  }
  return periodStart(first, habit.frequency);
}

/**
 * Consecutive periods that reached the target (or were logged at all, without one), ending at the
 * current one. An unfinished current period doesn't break the streak — you still have time to reach it.
 * Rest days and frozen periods are skipped over: they keep the streak alive but don't add to it.
 */
export function currentStreak(habit: Habit, today = new Date()): number {
  const first = firstPeriod(habit);
  let d = periodStart(today, habit.frequency);
  if (!targetMet(habit, toKey(d))) d = previousPeriod(d, habit.frequency);
  let n = 0;
  for (; d >= first; d = previousPeriod(d, habit.frequency)) {
    const key = toKey(d);
    if (targetMet(habit, key)) n++;
    else if (!excusal(habit, key)) break;
  }
  return n;
}

export function bestStreak(habit: Habit, today = new Date()): number {
  const current = periodStart(today, habit.frequency);
  let best = 0;
  let run = 0;
  for (let d = firstPeriod(habit); d <= current; d = nextPeriod(d, habit.frequency)) {
    const key = toKey(d);
    if (targetMet(habit, key)) best = Math.max(best, ++run);
    // The unfinished current period, rest days and freezes leave the run as it is.
    else if (d.getTime() !== current.getTime() && !excusal(habit, key)) run = 0;
  }
  return best;
}

/** Total number of entries ever logged. */
export function totalEntries(habit: Habit): number {
  return Object.values(habit.entries).reduce((n, list) => n + list.length, 0);
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Bring a stored habit up to the current shape: older versions kept one number per period
 * and had no target (they get none), rest days, reminder or freezes. Drops empty or invalid values.
 */
export function normalizeHabit(raw: Habit): Habit {
  const entries: Record<string, number[]> = {};
  const max = raw.kind === 'value' ? Math.max(1, raw.maxValue) : 1;
  for (const [k, v] of Object.entries((raw.entries ?? {}) as Record<string, unknown>)) {
    const list = (Array.isArray(v) ? v : [v])
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
      .map((x) => (raw.kind === 'boolean' ? 1 : Math.min(x, max)));
    if (list.length) entries[k] = list;
  }
  const target = typeof raw.target === 'number' && raw.target > 0 ? Math.min(99, Math.round(raw.target)) : 0;
  const restDays =
    raw.frequency === 'daily' && Array.isArray(raw.restDays)
      ? [...new Set(raw.restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [];
  const reminder = typeof raw.reminder === 'string' && TIME_RE.test(raw.reminder) ? raw.reminder : null;
  const freezes = Array.isArray(raw.freezes)
    ? [...new Set(raw.freezes.filter((k) => typeof k === 'string' && KEY_RE.test(k)))].sort()
    : [];
  return { ...raw, target, restDays, reminder, freezes, entries };
}
