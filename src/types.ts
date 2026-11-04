export type Frequency = 'daily' | 'weekly' | 'monthly';

/** `boolean` = done / not done; `value` = an intensity from 1..maxValue. */
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
  createdAt: string;
  /**
   * Logged values keyed by the start date of the period (YYYY-MM-DD):
   * the day itself, the Monday of the week, or the 1st of the month.
   */
  entries: Record<string, number>;
}

export type HabitDraft = Omit<Habit, 'id' | 'createdAt' | 'entries'>;
