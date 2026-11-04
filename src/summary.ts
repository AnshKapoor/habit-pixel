import { addDays, addMonths, fromKey, periodStart, previousPeriod, startOfDay, toKey } from './dates';
import { intensity } from './stats';
import type { Habit } from './types';

export type SummaryRange = '30d' | '90d' | '12m' | 'all';

export function rangeStart(range: SummaryRange, today = new Date()): Date | null {
  const t = startOfDay(today);
  if (range === '30d') return addDays(t, -29);
  if (range === '90d') return addDays(t, -89);
  if (range === '12m') return addMonths(t, -11);
  return null;
}

export interface HabitSummary {
  habit: Habit;
  /** Periods counted (the current period counts only once it has been logged). */
  periods: number;
  /** Periods with any logged value. */
  done: number;
  /**
   * 0..1. Yes/no habits: done / periods. Value habits: the mean of value / max
   * over all periods, with periods not logged counting as 0.
   */
  efficiency: number | null;
  /** Value habits only: average logged value over the periods it was done. */
  averageValue: number | null;
}

/** The first period the habit can be judged on: its creation, or an earlier back-filled entry. */
function firstPeriod(habit: Habit): Date {
  let first = fromKey(habit.createdAt);
  for (const k of Object.keys(habit.entries)) {
    const d = fromKey(k);
    if (d < first) first = d;
  }
  return periodStart(first, habit.frequency);
}

export function summarizeHabit(habit: Habit, from: Date | null, today = new Date()): HabitSummary {
  const f = habit.frequency;
  let start = firstPeriod(habit);
  if (from) {
    const s = periodStart(from, f);
    if (s > start) start = s;
  }
  const current = periodStart(today, f);

  let periods = 0;
  let done = 0;
  let score = 0;
  let valueSum = 0;
  for (let d = current; d >= start; d = previousPeriod(d, f)) {
    const v = habit.entries[toKey(d)];
    const logged = v > 0;
    // The current day/week/month isn't over yet, so it only counts once it's done.
    if (d.getTime() === current.getTime() && !logged) continue;
    periods++;
    if (logged) {
      done++;
      score += intensity(habit, v);
      valueSum += v;
    }
  }

  return {
    habit,
    periods,
    done,
    efficiency: periods > 0 ? score / periods : null,
    averageValue: habit.kind === 'value' && done > 0 ? valueSum / done : null,
  };
}

/** Each habit weighs the same, regardless of how often it repeats. */
export function overallEfficiency(summaries: HabitSummary[]): number | null {
  const scored = summaries.filter((s) => s.efficiency !== null);
  if (scored.length === 0) return null;
  return scored.reduce((sum, s) => sum + (s.efficiency ?? 0), 0) / scored.length;
}

export function formatPercent(v: number | null): string {
  return v === null ? '–' : `${Math.round(v * 100)}%`;
}
