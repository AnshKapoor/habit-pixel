import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../components/Segmented';
import { periodKey, periodNoun } from '../dates';
import { currentStreak, hasTarget, periodCount, targetMet } from '../stats';
import { useStore } from '../store';
import {
  formatPercent,
  overallEfficiency,
  overallTargetRate,
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
  const targets = overallTargetRate(summaries);
  const now = new Date();
  const daily = habits.filter((h) => h.frequency === 'daily');
  const doneToday = daily.filter((h) => targetMet(h, periodKey(now, 'daily'))).length;
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
          label="Targets hit"
          value={formatPercent(targets)}
          detail={
            targets === null
              ? 'no habit has a target yet'
              : 'share of periods that reached their target (habits with a target)'
          }
          accent={theme.accent}
        />
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
          detail="daily habits done (target reached)"
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
        Each habit is judged per period (day, week or month), from when it was created or first logged. Targets hit is
        the share of periods with at least the target number of entries; habits without a target are left out of it.
        Efficiency also gives credit for partial progress: entries ÷ target (capped at 100%; any entry counts in full
        without a target), times the average value ÷ maximum for intensity habits; periods with nothing logged count
        as 0. The current period is only counted once its target is reached (or once logged, without a target). The
        overall numbers are averages across habits.
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
  const { habit, periods, targetHit, targetRate, entries, efficiency, averageValue } = summary;
  const noun = periodNoun(habit.frequency);
  const pct = efficiency ?? 0;
  const nowKey = periodKey(new Date(), habit.frequency);
  const nowCount = periodCount(habit, nowKey);
  const nowMet = targetMet(habit, nowKey);
  const withTarget = hasTarget(habit);
  const periodLabel = habit.frequency === 'daily' ? 'Today' : `This ${noun}`;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

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
      <View style={styles.badges}>
        <View
          style={[
            styles.badge,
            { borderColor: nowMet ? habit.color : theme.border, backgroundColor: nowMet ? habit.color : 'transparent' },
          ]}
        >
          <Text style={[styles.badgeText, { color: nowMet ? '#fff' : theme.text }]}>
            {nowMet ? '✓ ' : ''}
            {periodLabel}:{' '}
            {withTarget ? `${nowCount}/${habit.target}` : `${nowCount} ${nowCount === 1 ? 'entry' : 'entries'}`}
          </Text>
        </View>
        {periods > 0 ? (
          <Text style={[styles.rowMeta, { color: theme.subtext, marginTop: 0 }]}>
            {withTarget
              ? `Target (${habit.target}×/${noun}) hit in ${targetHit} of ${plural(periods, noun)} · ${formatPercent(targetRate)}`
              : `Done in ${targetHit} of ${plural(periods, noun)} · no target`}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowMeta, { color: theme.subtext }]}>
        {periods === 0
          ? `Nothing to count yet — ${withTarget ? `reach this ${noun}’s target` : `log this ${noun}`} to start`
          : `${entries} ${entries === 1 ? 'entry' : 'entries'} logged`}
        {averageValue !== null
          ? ` · avg ${averageValue.toFixed(1)}/${habit.maxValue}${habit.unit ? ` ${habit.unit}` : ''} per entry`
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 8 },
});
