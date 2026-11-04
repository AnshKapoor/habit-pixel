import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../components/Segmented';
import { periodKey, periodNoun } from '../dates';
import { currentStreak } from '../stats';
import { useStore } from '../store';
import {
  formatPercent,
  overallEfficiency,
  rangeStart,
  summarizeHabit,
  type HabitSummary,
  type SummaryRange,
} from '../summary';
import type { Theme } from '../theme';
import { screenStyles } from './screenStyles';

const RANGES: [SummaryRange, string][] = [
  ['30d', '30 days'],
  ['90d', '90 days'],
  ['12m', '12 months'],
  ['all', 'All time'],
];

export function SummaryScreen({ theme }: { theme: Theme }) {
  const { habits } = useStore();
  const [range, setRange] = useState<SummaryRange>('30d');

  const summaries = useMemo(() => {
    const from = rangeStart(range);
    return habits
      .map((h) => summarizeHabit(h, from))
      .sort((a, b) => (b.efficiency ?? -1) - (a.efficiency ?? -1));
  }, [habits, range]);

  const overall = overallEfficiency(summaries);
  const now = new Date();
  const daily = habits.filter((h) => h.frequency === 'daily');
  const doneToday = daily.filter((h) => h.entries[periodKey(now, 'daily')] > 0).length;
  const activeStreaks = habits.filter((h) => currentStreak(h) > 0).length;
  const count = (f: string) => habits.filter((h) => h.frequency === f).length;

  return (
    <ScrollView contentContainerStyle={screenStyles.content}>
      <View style={screenStyles.header}>
        <Text style={[screenStyles.title, { color: theme.text }]}>Summary</Text>
        <Text style={{ color: theme.subtext }}>How consistently you keep your habits</Text>
      </View>

      <Segmented theme={theme} accent={theme.accent} value={range} onChange={setRange} options={RANGES} />

      <View style={styles.stats}>
        <Stat theme={theme} label="Overall efficiency" value={formatPercent(overall)} accent={theme.accent} />
        <Stat
          theme={theme}
          label="Habits"
          value={String(habits.length)}
          detail={`${count('daily')} daily · ${count('weekly')} weekly · ${count('monthly')} monthly`}
        />
        <Stat
          theme={theme}
          label="Done today"
          value={daily.length ? `${doneToday}/${daily.length}` : '–'}
          detail="daily habits"
        />
        <Stat theme={theme} label="Active streaks" value={String(activeStreaks)} detail={`of ${habits.length}`} />
      </View>

      <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[screenStyles.sectionTitle, { color: theme.subtext }]}>By habit</Text>
        {summaries.length === 0 ? (
          <Text style={{ color: theme.subtext }}>Add a habit to see its efficiency here.</Text>
        ) : (
          summaries.map((s, i) => <HabitRow key={s.habit.id} summary={s} theme={theme} first={i === 0} />)
        )}
      </View>

      <Text style={[styles.note, { color: theme.subtext }]}>
        Efficiency is counted per period (day, week or month, depending on the habit), from when the habit was created
        or first logged. Done/not-done habits: share of periods done. Intensity habits: average of value ÷ maximum,
        where periods not logged count as 0. The current period is only counted once it’s logged. Overall efficiency
        is the average across habits.
      </Text>
    </ScrollView>
  );
}

function Stat({
  theme,
  label,
  value,
  detail,
  accent,
}: {
  theme: Theme;
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[styles.statValue, { color: accent ?? theme.text }]}>{value}</Text>
      {detail ? <Text style={[styles.statDetail, { color: theme.subtext }]}>{detail}</Text> : null}
    </View>
  );
}

function HabitRow({ summary, theme, first }: { summary: HabitSummary; theme: Theme; first: boolean }) {
  const { habit, periods, done, efficiency, averageValue } = summary;
  const noun = periodNoun(habit.frequency);
  const pct = efficiency ?? 0;

  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
          {habit.emoji ? `${habit.emoji} ` : ''}
          {habit.name}
        </Text>
        <Text style={[styles.rowPct, { color: habit.color }]}>{formatPercent(efficiency)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.empty }]}>
        <View style={[styles.fill, { backgroundColor: habit.color, width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <Text style={[styles.rowMeta, { color: theme.subtext }]}>
        {periods === 0
          ? `Nothing to count yet — log this ${noun} to start`
          : `Done ${done} of ${periods} ${noun}${periods === 1 ? '' : 's'}`}
        {averageValue !== null
          ? ` · avg ${averageValue.toFixed(1)}/${habit.maxValue}${habit.unit ? ` ${habit.unit}` : ''} when done`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  statDetail: { fontSize: 11, marginTop: 2 },
  row: { paddingVertical: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', marginRight: 8 },
  rowPct: { fontSize: 16, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  rowMeta: { fontSize: 12, marginTop: 6 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 8 },
});
