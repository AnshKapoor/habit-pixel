import { addDays, addMonths, periodStart, previousPeriod, startOfDay, toKey } from './dates';
import { excusal, firstPeriod, hasTarget, periodEntries, periodStrength, targetMet } from './stats';
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
  /**
   * Periods counted (the current period counts only once its target is reached, or once logged without one).
   * Missed rest days and frozen periods aren't counted.
   */
  periods: number;
  /** Periods that reached the target number of entries. */
  targetHit: number;
  /** targetHit / periods, 0..1. Null for habits without a target. */
  targetRate: number | null;
  /** All entries logged in the counted periods. */
  entries: number;
  /**
   * 0..1, the mean period strength: progress towards the target (capped at 100%), times the average
   * value ÷ maximum for intensity habits. Periods with nothing logged count as 0.
   */
  efficiency: number | null;
  /** Value habits only: average value per entry. */
  averageValue: number | null;
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
  let targetHit = 0;
  let entries = 0;
  let score = 0;
  let valueSum = 0;
  for (let d = current; d >= start; d = previousPeriod(d, f)) {
    const key = toKey(d);
    const met = targetMet(habit, key);
    // The current day/week/month isn't over yet, so it only counts once its target is reached.
    if (d.getTime() === current.getTime() && !met) continue;
    // Rest days and frozen periods that missed the target are left out, so they don't lower the score.
    if (excusal(habit, key)) continue;
    periods++;
    if (met) targetHit++;
    const values = periodEntries(habit, key);
    entries += values.length;
    valueSum += values.reduce((a, v) => a + v, 0);
    score += periodStrength(habit, key);
  }

  return {
    habit,
    periods,
    targetHit,
    targetRate: periods > 0 && hasTarget(habit) ? targetHit / periods : null,
    entries,
    efficiency: periods > 0 ? score / periods : null,
    averageValue: habit.kind === 'value' && entries > 0 ? valueSum / entries : null,
  };
}

/** Each habit weighs the same, regardless of how often it repeats. */
export function overallEfficiency(summaries: HabitSummary[]): number | null {
  return average(summaries.map((s) => s.efficiency));
}

/** Average share of periods that reached their target, across habits that have one. */
export function overallTargetRate(summaries: HabitSummary[]): number | null {
  return average(summaries.map((s) => s.targetRate));
}

function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function formatPercent(v: number | null): string {
  return v === null ? '–' : `${Math.round(v * 100)}%`;
}
