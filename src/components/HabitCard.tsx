import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { periodKey, periodNoun } from '../dates';
import { bestStreak, currentStreak, periodEntries, periodStrength, totalEntries } from '../stats';
import { tileColor, type Theme } from '../theme';
import type { Habit } from '../types';
import { Heatmap } from './Heatmap';
import { Tile } from './Tile';

interface Props {
  habit: Habit;
  theme: Theme;
  onEdit: () => void;
  /** Tap on a tile or the round button: open the entries for the period starting at `key`. */
  onLog: (key: string) => void;
}

const FREQ_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } as const;

export function HabitCard({ habit, theme, onEdit, onLog }: Props) {
  const nowKey = periodKey(new Date(), habit.frequency);
  const nowEntries = periodEntries(habit, nowKey);
  const count = nowEntries.length;
  const strength = periodStrength(habit, nowKey);
  // Round button label: progress when there's a target, otherwise the value (or how many entries).
  const badge =
    habit.target > 1
      ? `${count}/${habit.target}`
      : count > 1
        ? `×${count}`
        : count === 1 && habit.kind === 'value'
          ? String(nowEntries[0])
          : null;
  const streak = currentStreak(habit);
  const best = bestStreak(habit);
  const noun = periodNoun(habit.frequency);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Pressable onPress={onEdit} style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {habit.emoji ? `${habit.emoji} ` : ''}
            {habit.name}
          </Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            {FREQ_LABEL[habit.frequency]}
            {habit.target >= 1 ? ` · goal ${habit.target}×/${noun}` : ''}
            {habit.kind === 'value' ? ` · 0–${habit.maxValue}${habit.unit ? ` ${habit.unit}` : ''}` : ''}
            {'  ·  '}🔥 {streak} {noun}
            {streak === 1 ? '' : 's'}
            {'  ·  '}best {best}
            {'  ·  '}
            {totalEntries(habit)} total
          </Text>
        </Pressable>

        <Pressable onPress={onEdit} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.subtext} />
        </Pressable>

        <Pressable
          onPress={() => onLog(nowKey)}
          accessibilityLabel={`Entries for ${habit.name} this ${noun}: ${count}${habit.target >= 1 ? ` of ${habit.target}` : ''}`}
          style={[
            styles.check,
            {
              backgroundColor: tileColor(habit.color, strength, 'transparent'),
              borderColor: strength > 0 ? habit.color : theme.border,
            },
          ]}
        >
          {badge ? (
            <Text
              style={[styles.checkText, badge.length > 3 && { fontSize: 12 }, { color: strength > 0.55 ? '#fff' : theme.text }]}
            >
              {badge}
            </Text>
          ) : (
            <Ionicons
              name={habit.kind === 'value' || count === 0 ? 'add' : habit.shape === 'star' ? 'star' : 'checkmark'}
              size={22}
              color={strength > 0 ? '#fff' : theme.subtext}
            />
          )}
        </Pressable>
      </View>

      <Heatmap habit={habit} theme={theme} onTilePress={onLog} />

      {(habit.kind === 'value' || habit.target > 1) && (
        <View style={styles.legend}>
          <Text style={[styles.legendText, { color: theme.subtext }]}>Less</Text>
          {[0, 0.25, 0.5, 0.75, 1].map((s) => (
            <View key={s} style={{ marginHorizontal: 2 }}>
              <Tile size={11} shape={habit.shape} color={habit.color} strength={s} theme={theme} />
            </View>
          ))}
          <Text style={[styles.legendText, { color: theme.subtext }]}>More</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleWrap: { flex: 1, marginRight: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6, marginRight: 6 },
  check: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 16, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 },
  legendText: { fontSize: 10, marginHorizontal: 4 },
});
