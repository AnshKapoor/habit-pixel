import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPeriod, periodNoun, toKey } from '../dates';
import { canFreeze, firstPeriod, FREEZE_LIMIT, isAvailable, freezesLeft, hasTarget, isFrozen, isRestDay, periodEntries, valueStrength } from '../stats';
import { tileColor, type Theme } from '../theme';
import type { Habit } from '../types';
import { Sheet } from './Sheet';

const MAX_CHIPS = 20;

interface Props {
  habit: Habit | null;
  periodKey: string | null;
  theme: Theme;
  onAdd: (value: number) => void;
  /** Replace the period's entries with this one value (habits without a target). */
  onSet: (value: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  /** Use a streak freeze on this period, or give it back. */
  onToggleFreeze: () => void;
  onClose: () => void;
}

/**
 * One day / week / month of a habit. With a target, a numbered list of entries you add or remove one by one.
 * Without a target there is only one entry per period: done / not done, or a single value for intensity habits.
 */
export function EntriesSheet({ habit, periodKey, theme, onAdd, onSet, onRemove, onClear, onToggleFreeze, onClose }: Props) {
  const [text, setText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (shownFor !== periodKey) {
    setShownFor(periodKey);
    setText('');
    setConfirmClear(false);
  }

  if (!habit || !periodKey) return null;

  // Only periods the habit existed in can be logged (from its creation, or earlier imported history, to today).
  if (!isAvailable(habit, periodKey)) {
    const future = periodKey > toKey(new Date());
    return (
      <Sheet visible onClose={onClose} theme={theme}>
        <Text style={[styles.title, { color: theme.text }]}>
          {habit.emoji ? `${habit.emoji} ` : ''}
          {habit.name}
        </Text>
        <Text style={{ color: theme.subtext }}>{formatPeriod(periodKey, habit.frequency)}</Text>
        <View style={[styles.excuse, { borderColor: theme.danger }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.danger} />
          <Text style={{ color: theme.text, flex: 1 }}>
            {future
              ? 'This is in the future. You can only log up to today.'
              : `${habit.name} didn’t exist yet then. Its history starts ${formatPeriod(toKey(firstPeriod(habit)), habit.frequency)}.`}
          </Text>
        </View>
        <View style={styles.footer}>
          <View />
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: theme.subtext, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
      </Sheet>
    );
  }
  const entries = periodEntries(habit, periodKey);
  const count = entries.length;
  const withTarget = hasTarget(habit);
  const target = Math.max(1, habit.target);
  const reached = count >= target;
  const noun = periodNoun(habit.frequency);
  const unit = habit.unit ? ` ${habit.unit}` : '';
  const isValue = habit.kind === 'value';
  // Without a target, more than one entry per period means nothing: log (or replace) a single one.
  const single = !withTarget;
  // Older data may still hold several entries; then show the list so they can be removed.
  const showList = !single || count > 1;
  const current = single && count === 1 ? entries[0] : null;
  const log = (v: number) => (single ? onSet(v) : onAdd(v));
  const frozen = isFrozen(habit, periodKey);
  const rest = isRestDay(habit, periodKey);
  const left = freezesLeft(habit, periodKey);
  const allowance = habit.frequency === 'monthly' ? 'this year' : 'this month';

  const submitText = () => {
    const n = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(n) || n <= 0) return;
    log(Math.min(habit.maxValue, n));
    setText('');
  };

  const clear = () => {
    if (count > 1 && !confirmClear) return setConfirmClear(true);
    setConfirmClear(false);
    onClear();
  };

  return (
    <Sheet visible onClose={onClose} theme={theme}>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>
          {habit.emoji ? `${habit.emoji} ` : ''}
          {habit.name}
        </Text>
        <Text style={{ color: theme.subtext }}>{formatPeriod(periodKey, habit.frequency)}</Text>

        {/* Progress towards the target */}
        {withTarget ? (
          <View style={styles.progressRow}>
            <Text style={[styles.count, { color: theme.text }]}>
              {count}
              <Text style={[styles.countOf, { color: theme.subtext }]}> / {target}</Text>
            </Text>
            <View style={{ flex: 1 }}>
              <View style={[styles.track, { backgroundColor: theme.empty }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: habit.color, width: `${Math.min(100, Math.round((count / target) * 100))}%` },
                  ]}
                />
              </View>
              <Text
                style={{ color: reached ? habit.color : theme.subtext, fontSize: 12, fontWeight: '600', marginTop: 4 }}
              >
                {reached
                  ? `Target reached${count > target ? ` (+${count - target})` : ''}`
                  : `${target - count} more to reach this ${noun}’s target`}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Status for single-entry habits */}
        {single && !showList ? (
          <View
            style={[
              styles.status,
              { borderColor: count ? habit.color : theme.border, backgroundColor: count ? habit.color : 'transparent' },
            ]}
          >
            <Ionicons
              name={count ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={count ? '#fff' : theme.subtext}
            />
            <Text style={{ color: count ? '#fff' : theme.text, fontSize: 16, fontWeight: '700' }}>
              {count === 0
                ? `Not done this ${noun}`
                : isValue && current !== null
                  ? `Done · ${formatValue(current)} / ${habit.maxValue}${unit}`
                  : 'Done'}
            </Text>
          </View>
        ) : null}

        {/* Logged entries */}
        {showList ? (
          <Text style={[styles.label, { color: theme.subtext }]}>
            {count === 0 ? 'No entries yet' : `${count} ${count === 1 ? 'entry' : 'entries'}`}
          </Text>
        ) : null}
        {showList && entries.map((v, i) => (
          <View key={i} style={[styles.entry, { borderColor: theme.border }]}>
            <View style={[styles.entryNum, { backgroundColor: habit.color }]}>
              <Text style={styles.entryNumText}>{i + 1}</Text>
            </View>
            <Text style={{ color: theme.text, flex: 1, fontSize: 15 }}>
              {isValue ? (
                <>
                  <Text style={{ fontWeight: '700' }}>{formatValue(v)}</Text>
                  <Text style={{ color: theme.subtext }}>
                    {' '}
                    / {habit.maxValue}
                    {unit}
                  </Text>
                </>
              ) : (
                `Entry ${i + 1}`
              )}
            </Text>
            <Pressable
              onPress={() => onRemove(i)}
              hitSlop={8}
              accessibilityLabel={`Remove entry ${i + 1}`}
              style={styles.remove}
            >
              <Ionicons name="close" size={18} color={theme.danger} />
            </Pressable>
          </View>
        ))}

        {/* Add an entry */}
        {single && !isValue ? (
          count === 0 ? (
            <Pressable
              onPress={() => onSet(1)}
              style={({ pressed }) => [
                styles.addBtn,
                { marginTop: 14, backgroundColor: habit.color, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.addText}>Mark as done</Text>
            </Pressable>
          ) : null
        ) : (
          <Text style={[styles.label, { color: theme.subtext }]}>
            {!isValue ? 'Add' : single ? (count ? 'Change value' : 'Value') : 'Add an entry with value'}
          </Text>
        )}
        {single && !isValue ? null : !isValue ? (
          <Pressable
            onPress={() => onAdd(1)}
            style={({ pressed }) => [styles.addBtn, { backgroundColor: habit.color, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>Add entry {count + 1}</Text>
          </Pressable>
        ) : habit.maxValue <= MAX_CHIPS ? (
          <View style={styles.chips}>
            {Array.from({ length: habit.maxValue }, (_, i) => i + 1).map((v) => {
              const strength = valueStrength(habit, v);
              const selected = current === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => log(v)}
                  accessibilityLabel={single ? `Set value ${v}` : `Add entry with value ${v}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: tileColor(habit.color, strength, theme.empty),
                      borderColor: selected ? theme.text : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: strength > 0.55 ? '#fff' : theme.text, fontWeight: '600' }}>{v}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.chips, { alignItems: 'center' }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={`1 – ${habit.maxValue}${unit}`}
              placeholderTextColor={theme.subtext}
              onSubmitEditing={submitText}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable onPress={submitText} style={[styles.button, { backgroundColor: habit.color }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{single ? 'Save' : 'Add'}</Text>
            </Pressable>
          </View>
        )}

        {/* Rest day / streak freeze */}
        {!reached && rest ? (
          <View style={[styles.excuse, { borderColor: theme.border }]}>
            <Ionicons name="moon-outline" size={18} color={theme.subtext} />
            <Text style={{ color: theme.text, flex: 1 }}>Rest day. Skipping it keeps your streak.</Text>
          </View>
        ) : !reached && frozen ? (
          <View style={[styles.excuse, { borderColor: theme.freeze, backgroundColor: theme.freezeBg }]}>
            <Ionicons name="snow" size={18} color={theme.freeze} />
            <Text style={{ color: theme.text, flex: 1 }}>Streak freeze used. This {noun} keeps your streak.</Text>
            <Pressable onPress={onToggleFreeze} hitSlop={8}>
              <Text style={{ color: theme.freeze, fontWeight: '700' }}>Undo</Text>
            </Pressable>
          </View>
        ) : !reached ? (
          <Pressable
            onPress={onToggleFreeze}
            disabled={!canFreeze(habit, periodKey)}
            accessibilityLabel={`Use a streak freeze, ${left} of ${FREEZE_LIMIT} left ${allowance}`}
            style={({ pressed }) => [
              styles.excuse,
              { borderColor: theme.freeze, opacity: !canFreeze(habit, periodKey) ? 0.45 : pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="snow-outline" size={18} color={theme.freeze} />
            <Text style={{ color: theme.text, flex: 1 }}>
              {left > 0 ? 'Use a streak freeze' : `No streak freezes left ${allowance}`}
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 12 }}>
              {left}/{FREEZE_LIMIT} left
            </Text>
          </Pressable>
        ) : frozen ? (
          // Target reached after freezing: the freeze isn't needed any more.
          <Pressable onPress={onToggleFreeze} style={[styles.excuse, { borderColor: theme.border }]}>
            <Ionicons name="snow-outline" size={18} color={theme.subtext} />
            <Text style={{ color: theme.subtext, flex: 1 }}>Target reached, so the freeze isn’t needed.</Text>
            <Text style={{ color: theme.freeze, fontWeight: '700' }}>Give it back</Text>
          </Pressable>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={clear}
            disabled={count === 0}
            style={[styles.zeroBtn, { borderColor: theme.border, opacity: count ? 1 : 0.4 }]}
          >
            <Text style={{ color: theme.danger, fontWeight: '600' }}>
              {confirmClear ? `Tap again to remove all ${count}` : 'Set to 0 · not done'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: theme.subtext, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  count: { fontSize: 30, fontWeight: '800' },
  countOf: { fontSize: 18, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  entryNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  entryNumText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  remove: { padding: 4 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  excuse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 18,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  zeroBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
});
