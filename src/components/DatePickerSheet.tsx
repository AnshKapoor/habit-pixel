import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addDays,
  addMonths,
  formatPeriod,
  MONTHS,
  periodKey,
  periodNoun,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toKey,
  WEEKDAYS,
} from '../dates';
import { excusal, firstPeriod, isAvailable, periodStrength, targetMet } from '../stats';
import { tileColor, type Theme } from '../theme';
import type { Habit } from '../types';
import { Sheet } from './Sheet';

interface Props {
  habit: Habit | null;
  theme: Theme;
  /** A period of this habit was picked: open its entries. */
  onPick: (key: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Jump to any date of one habit. Only dates the habit existed on can be picked: from its first period
 * (creation, or earlier back-filled history) up to today. Daily and weekly habits get a month calendar
 * (for weekly ones, a day picks its whole week); monthly habits get a year of months.
 */
export function DatePickerSheet({ habit, theme, onPick, onClose }: Props) {
  const today = startOfDay(new Date());
  // Page shown: a month (daily/weekly) or a year (monthly), as its first day. Reset each time a habit opens.
  const [page, setPage] = useState<Date>(startOfMonth(today));
  const [notice, setNotice] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const habitId = habit?.id ?? null;
  if (shownFor !== habitId) {
    setShownFor(habitId);
    setPage(habit?.frequency === 'monthly' ? new Date(today.getFullYear(), 0, 1) : startOfMonth(today));
    setNotice(null);
  }
  if (!habit) return null;

  const f = habit.frequency;
  const first = firstPeriod(habit);
  const yearly = f === 'monthly';
  const minPage = yearly ? new Date(first.getFullYear(), 0, 1) : startOfMonth(first);
  const maxPage = yearly ? new Date(today.getFullYear(), 0, 1) : startOfMonth(today);
  const step = yearly ? 12 : 1;
  const prev = addMonths(page, -step);
  const next = addMonths(page, step);
  const canPrev = prev >= minPage;
  const canNext = next <= maxPage;
  const go = (d: Date) => {
    setPage(d);
    setNotice(null);
  };

  const firstLabel = formatPeriod(toKey(first), f);
  const createdLabel = formatPeriod(habit.createdAt, 'daily');

  /** Tap on a day (or month): open it if the habit existed then, otherwise say why not. */
  const pick = (d: Date) => {
    const key = periodKey(d, f);
    if (d > today) return setNotice('That’s in the future. You can only log up to today.');
    if (!isAvailable(habit, key)) {
      return setNotice(
        firstLabel === createdLabel
          ? `${habit.name} didn’t exist yet then. It was added on ${createdLabel}.`
          : `${habit.name} didn’t exist yet then. Its history starts ${firstLabel}.`,
      );
    }
    onPick(key);
  };

  const cell = (d: Date, label: string, wide: boolean, dim = false) => {
    const key = periodKey(d, f);
    const available = d <= today && isAvailable(habit, key);
    const strength = available ? periodStrength(habit, key) : 0;
    const excused = available ? excusal(habit, key) : null;
    const done = available && targetMet(habit, key);
    const isToday = !yearly && toKey(d) === toKey(today);
    return (
      <Pressable
        key={toKey(d)}
        onPress={() => pick(d)}
        accessibilityLabel={`${formatPeriod(key, f)}${available ? (done ? ', done' : '') : ', not available'}`}
        accessibilityState={{ disabled: !available }}
        style={({ pressed }) => [
          wide ? styles.monthCell : styles.dayCell,
          {
            // Same look as the grid: freezes in ice blue, missed rest days as an outline.
            backgroundColor: available
              ? excused === 'freeze'
                ? theme.freezeBg
                : excused === 'rest'
                  ? 'transparent'
                  : tileColor(habit.color, strength, theme.empty)
              : 'transparent',
            borderColor: isToday
              ? theme.text
              : excused === 'freeze'
                ? theme.freeze
                : excused === 'rest'
                  ? theme.empty
                  : 'transparent',
            opacity: !available ? 0.3 : dim ? 0.55 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: strength > 0.55 ? '#fff' : theme.text,
            fontWeight: isToday || done ? '700' : '500',
            fontSize: wide ? 14 : 13,
            textDecorationLine: available ? 'none' : 'line-through',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  let body;
  if (yearly) {
    body = (
      <View style={styles.monthGrid}>
        {MONTHS.map((m, i) => cell(new Date(page.getFullYear(), i, 1), m, true))}
      </View>
    );
  } else {
    // Six Monday-first rows cover any month.
    const start = startOfWeek(page);
    const rows = Array.from({ length: 6 }, (_, w) => addDays(start, 7 * w)).filter(
      (monday, w) => w < 4 || monday.getMonth() === page.getMonth(),
    );
    body = (
      <View>
        <View style={styles.row}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={[styles.weekday, { color: theme.subtext }]}>
              {w.slice(0, 2)}
            </Text>
          ))}
        </View>
        {rows.map((monday) => (
          <View key={toKey(monday)} style={styles.row}>
            {Array.from({ length: 7 }, (_, d) => {
              const day = addDays(monday, d);
              return cell(day, String(day.getDate()), false, day.getMonth() !== page.getMonth());
            })}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Sheet visible onClose={onClose} theme={theme}>
      <Text style={[styles.title, { color: theme.text }]}>
        {habit.emoji ? `${habit.emoji} ` : ''}
        {habit.name}: go to a {yearly ? 'month' : f === 'weekly' ? 'week' : 'date'}
      </Text>
      <Text style={{ color: theme.subtext, fontSize: 13 }}>
        Available from {firstLabel} to today.{f === 'weekly' ? ' Tap any day to open its week.' : ''}
      </Text>

      <View style={styles.nav}>
        <Pressable
          onPress={() => go(prev)}
          disabled={!canPrev}
          hitSlop={8}
          accessibilityLabel={yearly ? 'Previous year' : 'Previous month'}
          style={[styles.navBtn, { opacity: canPrev ? 1 : 0.25 }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.navTitle, { color: theme.text }]}>
          {yearly ? page.getFullYear() : `${MONTH_NAMES[page.getMonth()]} ${page.getFullYear()}`}
        </Text>
        <Pressable
          onPress={() => go(next)}
          disabled={!canNext}
          hitSlop={8}
          accessibilityLabel={yearly ? 'Next year' : 'Next month'}
          style={[styles.navBtn, { opacity: canNext ? 1 : 0.25 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.text} />
        </Pressable>
      </View>

      {body}

      {notice ? (
        <View style={[styles.notice, { borderColor: theme.danger }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.danger} />
          <Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable onPress={() => pick(today)} hitSlop={8}>
          <Text style={{ color: habit.color, fontWeight: '700' }}>{f === 'daily' ? 'Today' : `This ${periodNoun(f)}`}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: theme.subtext, fontWeight: '600' }}>Close</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  navBtn: { padding: 6 },
  navTitle: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  weekday: { width: 40, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  monthCell: {
    width: '30%',
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
});
