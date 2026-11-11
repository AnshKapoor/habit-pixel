export type Frequency = 'daily' | 'weekly' | 'monthly';

/** `boolean` = done / not done; `value` = each entry records an intensity from 1..maxValue. */
export type HabitKind = 'boolean' | 'value';

export type TileShape = 'square' | 'circle' | 'star';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  frequency: Frequency;
  kind: HabitKind;
  /** Only meaningful for `value` habits. */
  maxValue: number;
  /** Optional unit shown next to values, e.g. "pages" or "km". */
  unit: string;
  shape: TileShape;
  /**
   * How many entries per period count as reaching the goal, e.g. 3 for “at least 3 times a week”.
   * 0 = no target: any entry marks the period as done, and the habit has no “targets hit” score.
   */
  target: number;
  /**
   * Planned rest days for daily habits, as weekdays (0 = Monday … 6 = Sunday). A rest day with nothing
   * logged doesn't break a streak and isn't counted in Summary. Always empty for weekly and monthly habits.
   */
  restDays: number[];
  /** Daily reminder time as "HH:MM" (24 h, local time), or null for no reminder. Android/iOS only. */
  reminder: string | null;
  createdAt: string;
  /**
   * Entries keyed by the start date of the period (YYYY-MM-DD): the day itself, the Monday of the week,
   * or the 1st of the month. Each period holds one value per entry (always 1 for `boolean` habits).
   */
  entries: Record<string, number[]>;
  /**
   * Periods (by start key) covered by a streak freeze: a missed day/week/month that keeps the streak alive.
   * Limited to FREEZE_LIMIT per month (per year for monthly habits).
   */
  freezes: string[];
}

export type HabitDraft = Omit<Habit, 'id' | 'createdAt' | 'entries' | 'freezes'>;
