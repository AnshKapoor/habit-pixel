import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { addDays, addMonths, fromKey, MONTHS, startOfDay, startOfMonth, startOfWeek, toKey } from '../dates';
import { excusal, periodStrength } from '../stats';
import type { Theme } from '../theme';
import type { Habit } from '../types';
import { Tile } from './Tile';

interface Props {
  habit: Habit;
  theme: Theme;
  onTilePress: (key: string) => void;
}

export function Heatmap(props: Props) {
  if (props.habit.frequency === 'weekly') return <WeeklyGrid {...props} />;
  if (props.habit.frequency === 'monthly') return <MonthlyGrid {...props} />;
  return <DailyGrid {...props} />;
}

/** Horizontal scroller that starts scrolled to the most recent (right) end. */
function EndScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<ScrollViewInstance>(null);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
      onLayout={() => ref.current?.scrollToEnd({ animated: false })}
    >
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Daily: GitHub contribution graph — one column per week, Mon..Sun top to bottom.

const DAILY_WEEKS = 53;
const D_SIZE = 13;
const D_GAP = 3;

/** Columns where a new month starts; the partial first month is dropped if it would collide. */
function monthLabelColumns(weeks: Date[]): number[] {
  const cols = weeks
    .map((monday, w) => (w === 0 || weeks[w - 1].getMonth() !== monday.getMonth() ? w : -1))
    .filter((w) => w >= 0);
  if (cols.length > 1 && cols[1] < 3) cols.shift();
  return cols;
}

function DailyGrid({ habit, theme, onTilePress }: Props) {
  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const firstMonday = addDays(startOfWeek(today), -7 * (DAILY_WEEKS - 1));
  const weeks = Array.from({ length: DAILY_WEEKS }, (_, w) => addDays(firstMonday, 7 * w));

  return (
    <View style={styles.row}>
      <View style={{ marginTop: 16, marginRight: 4 }}>
        {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((l, i) => (
          <Text key={i} style={[styles.axis, { color: theme.subtext, height: D_SIZE + D_GAP, lineHeight: D_SIZE }]}>
            {l}
          </Text>
        ))}
      </View>
      <EndScroller>
        <View>
          <View style={{ height: 16 }}>
            {monthLabelColumns(weeks).map((w, i) => {
              const monday = weeks[w];
              return (
                <Text
                  key={w}
                  style={[styles.axis, { color: theme.subtext, position: 'absolute', left: w * (D_SIZE + D_GAP) }]}
                >
                  {monday.getMonth() === 0 || i === 0
                    ? `${MONTHS[monday.getMonth()]} ’${String(monday.getFullYear()).slice(2)}`
                    : MONTHS[monday.getMonth()]}
                </Text>
              );
            })}
          </View>
          <View style={styles.row}>
            {weeks.map((monday, w) => (
              <View key={w} style={{ marginRight: D_GAP }}>
                {Array.from({ length: 7 }, (_, d) => {
                  const day = addDays(monday, d);
                  const key = toKey(day);
                  if (day > today) return <View key={d} style={{ width: D_SIZE, height: D_SIZE + D_GAP }} />;
                  return (
                    <View key={d} style={{ marginBottom: D_GAP }}>
                      <Tile
                        size={D_SIZE}
                        shape={habit.shape}
                        color={habit.color}
                        strength={periodStrength(habit, key)}
                        excused={excusal(habit, key)}
                        theme={theme}
                        current={key === todayKey}
                        onPress={() => onTilePress(key)}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </EndScroller>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weekly: one column per month, one tile per week (by the week's Monday).

const WEEKLY_MONTHS = 24;
const W_SIZE = 18;
const W_GAP = 4;
const W_COL = 26;

function weeksStartingIn(monthStart: Date): Date[] {
  let d = startOfWeek(monthStart);
  if (d < monthStart) d = addDays(d, 7);
  const out: Date[] = [];
  while (d.getMonth() === monthStart.getMonth()) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

function WeeklyGrid({ habit, theme, onTilePress }: Props) {
  const today = new Date();
  const currentKey = toKey(startOfWeek(today));
  const thisMonth = startOfMonth(today);
  const months = Array.from({ length: WEEKLY_MONTHS }, (_, i) => addMonths(thisMonth, i - (WEEKLY_MONTHS - 1)));

  return (
    <EndScroller>
      <View style={styles.row}>
        {months.map((m, i) => (
          <View key={i} style={{ width: W_COL, alignItems: 'center' }}>
            <Text style={[styles.axis, { color: theme.subtext, height: 14 }]}>
              {m.getMonth() === 0 || i === 0 ? `’${String(m.getFullYear()).slice(2)}` : ''}
            </Text>
            <Text style={[styles.axis, { color: theme.subtext, marginBottom: 4 }]}>{MONTHS[m.getMonth()]}</Text>
            {weeksStartingIn(m).map((monday) => {
              const key = toKey(monday);
              return (
                <View key={key} style={{ marginBottom: W_GAP }}>
                  <Tile
                    size={W_SIZE}
                    shape={habit.shape}
                    color={habit.color}
                    strength={periodStrength(habit, key)}
                    excused={excusal(habit, key)}
                    theme={theme}
                    current={key === currentKey}
                    future={monday > today}
                    onPress={() => onTilePress(key)}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </EndScroller>
  );
}

// ---------------------------------------------------------------------------
// Monthly: one row per year, twelve tiles.

const M_SIZE = 20;
const M_GAP = 5;

function MonthlyGrid({ habit, theme, onTilePress }: Props) {
  const today = new Date();
  const thisYear = today.getFullYear();
  const currentKey = toKey(startOfMonth(today));
  const entryYears = Object.keys(habit.entries).map((k) => fromKey(k).getFullYear());
  const firstYear = Math.min(thisYear - 1, fromKey(habit.createdAt).getFullYear(), ...entryYears);
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <View>
      <View style={[styles.row, { marginLeft: 36, marginBottom: 4 }]}>
        {MONTHS.map((m) => (
          <Text key={m} style={[styles.axis, { color: theme.subtext, width: M_SIZE + M_GAP, textAlign: 'center' }]}>
            {m[0]}
          </Text>
        ))}
      </View>
      {years.map((y) => (
        <View key={y} style={[styles.row, { alignItems: 'center', marginBottom: M_GAP }]}>
          <Text style={[styles.axis, { color: theme.subtext, width: 36 }]}>{y}</Text>
          {MONTHS.map((_, mi) => {
            const start = new Date(y, mi, 1);
            const key = toKey(start);
            return (
              <View key={mi} style={{ width: M_SIZE + M_GAP, alignItems: 'center' }}>
                <Tile
                  size={M_SIZE}
                  shape={habit.shape}
                  color={habit.color}
                  strength={periodStrength(habit, key)}
                  excused={excusal(habit, key)}
                  theme={theme}
                  current={key === currentKey}
                  future={start > today}
                  onPress={() => onTilePress(key)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  axis: { fontSize: 10 },
});
