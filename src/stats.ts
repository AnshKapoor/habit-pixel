import { fromKey, periodStart, previousPeriod, toKey } from './dates';
import type { Habit } from './types';

/** 0..1 strength of a logged value, used to fade the tile colour. */
export function intensity(habit: Habit, value: number | undefined): number {
  if (!value || value <= 0) return 0;
  if (habit.kind === 'boolean') return 1;
  return Math.min(1, value / Math.max(1, habit.maxValue));
}

/**
 * Consecutive completed periods ending at the current one. An unfinished
 * current period doesn't break the streak — you still have time to do it.
 */
export function currentStreak(habit: Habit, today = new Date()): number {
  let d = periodStart(today, habit.frequency);
  if (!(habit.entries[toKey(d)] > 0)) d = previousPeriod(d, habit.frequency);
  let n = 0;
  while (habit.entries[toKey(d)] > 0) {
    n++;
    d = previousPeriod(d, habit.frequency);
  }
  return n;
}

export function bestStreak(habit: Habit): number {
  const keys = Object.keys(habit.entries)
    .filter((k) => habit.entries[k] > 0)
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

export function totalCompleted(habit: Habit): number {
  return Object.values(habit.entries).filter((v) => v > 0).length;
}
