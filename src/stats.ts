import { fromKey, periodStart, previousPeriod, toKey } from './dates';
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

/**
 * Consecutive periods that reached the target (or were logged at all, without one), ending at the
 * current one. An unfinished current period doesn't break the streak — you still have time to reach it.
 */
export function currentStreak(habit: Habit, today = new Date()): number {
  let d = periodStart(today, habit.frequency);
  if (!targetMet(habit, toKey(d))) d = previousPeriod(d, habit.frequency);
  let n = 0;
  while (targetMet(habit, toKey(d))) {
    n++;
    d = previousPeriod(d, habit.frequency);
  }
  return n;
}

export function bestStreak(habit: Habit): number {
  const keys = Object.keys(habit.entries)
    .filter((k) => targetMet(habit, k))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const expectedPrev = toKey(previousPeriod(fromKey(k), habit.frequency));
    run = prev === expectedPrev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Total number of entries ever logged. */
export function totalEntries(habit: Habit): number {
  return Object.values(habit.entries).reduce((n, list) => n + list.length, 0);
}

/**
 * Bring a stored habit up to the current shape: older versions kept one number per period
 * and had no target (they get none). Drops empty or invalid values.
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
  return { ...raw, target, entries };
}
