import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { periodNoun, WEEKDAYS } from '../dates';
import { ensureNotificationPermission, remindersSupported } from '../reminders';
import { TIME_RE } from '../stats';
import { HABIT_COLORS, type Theme } from '../theme';
import type { Frequency, Habit, HabitDraft, HabitKind, TileShape } from '../types';
import { IconPicker } from './IconPicker';
import { Segmented } from './Segmented';
import { Tile } from './Tile';
import { Sheet } from './Sheet';

const EMPTY: HabitDraft = {
  name: '',
  emoji: '',
  color: HABIT_COLORS[0],
  frequency: 'daily',
  kind: 'boolean',
  maxValue: 10,
  unit: '',
  shape: 'square',
  target: 0,
  restDays: [],
  reminder: null,
};

const DEFAULT_REMINDER = '20:00';
const REMINDER_STEP = 15; // minutes

/** Move an "HH:MM" time by `minutes`, wrapping around midnight and snapping to the step. */
function shiftTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const snapped = Math.round((h * 60 + m) / REMINDER_STEP) * REMINDER_STEP;
  const t = (((snapped + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const MAX_TARGET = 99;

interface Props {
  visible: boolean;
  /** Habit being edited, or null to create a new one. */
  habit: Habit | null;
  theme: Theme;
  onSave: (draft: HabitDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function HabitEditor({ visible, habit, theme, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<HabitDraft>(EMPTY);
  const [maxText, setMaxText] = useState('10');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeText, setTimeText] = useState(DEFAULT_REMINDER);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Reset the form each time the sheet opens (adjusting state during render, not in an effect).
  const [openedFor, setOpenedFor] = useState<{ visible: boolean; habit: Habit | null }>({ visible: false, habit: null });
  if (openedFor.visible !== visible || openedFor.habit !== habit) {
    setOpenedFor({ visible, habit });
    if (visible) {
      const d: HabitDraft = habit ? { ...habit } : EMPTY;
      setDraft(d);
      setMaxText(String(d.maxValue));
      setConfirmDelete(false);
      setTimeText(d.reminder ?? DEFAULT_REMINDER);
      setPermissionDenied(false);
    }
  }

  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const maxValue = Math.round(Number(maxText));
  const maxValid = draft.kind === 'boolean' || (Number.isFinite(maxValue) && maxValue >= 1 && maxValue <= 1000);
  const canSave = draft.name.trim().length > 0 && maxValid;
  const hasHistory = habit && Object.keys(habit.entries).length > 0;

  const setReminder = (time: string | null) => {
    set('reminder', time);
    if (time) setTimeText(time);
  };

  const toggleReminder = async (on: boolean) => {
    if (!on) return setReminder(null);
    setReminder(draft.reminder ?? timeText);
    if (remindersSupported) setPermissionDenied(!(await ensureNotificationPermission()));
  };

  const toggleRestDay = (d: number) =>
    set('restDays', draft.restDays.includes(d) ? draft.restDays.filter((x) => x !== d) : [...draft.restDays, d].sort());

  const save = () => {
    if (!canSave) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      unit: draft.kind === 'value' ? draft.unit.trim() : '',
      maxValue: draft.kind === 'value' ? maxValue : 1,
      restDays: draft.frequency === 'daily' ? draft.restDays : [],
    });
  };

  const label = (t: string) => <Text style={[styles.label, { color: theme.subtext }]}>{t}</Text>;

  return (
    <Sheet visible={visible} onClose={onClose} theme={theme}>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">

        <Text style={[styles.heading, { color: theme.text }]}>{habit ? 'Edit habit' : 'New habit'}</Text>

        {label('Name')}
        <TextInput
          value={draft.name}
          onChangeText={(t) => set('name', t)}
          placeholder="e.g. Read, Run, Meditate"
          placeholderTextColor={theme.subtext}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          autoFocus={!habit}
        />

        {label('Icon')}
        <IconPicker value={draft.emoji} color={draft.color} theme={theme} onChange={(e) => set('emoji', e)} />

        {label('How often?')}
        <Segmented<Frequency>
          theme={theme}
          accent={draft.color}
          value={draft.frequency}
          onChange={(v) => set('frequency', v)}
          options={[
            ['daily', 'Daily'],
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
          ]}
        />
        {hasHistory && draft.frequency !== habit.frequency && (
          <Text style={[styles.warn, { color: theme.danger }]}>
            Changing the frequency will clear this habit’s history.
          </Text>
        )}

        {label('Target (optional)')}
        <View style={styles.targetRow}>
          {draft.target > 0 ? <Text style={{ color: theme.text, fontSize: 15 }}>At least</Text> : null}
          <View style={[styles.stepper, { borderColor: theme.border }]}>
            <Pressable
              onPress={() => set('target', Math.max(0, draft.target - 1))}
              disabled={draft.target <= 0}
              hitSlop={6}
              accessibilityLabel="Lower target"
              style={[styles.stepBtn, { opacity: draft.target <= 0 ? 0.35 : 1 }]}
            >
              <Ionicons name="remove" size={20} color={theme.text} />
            </Pressable>
            <TextInput
              value={String(draft.target)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/\D/g, ''), 10);
                set('target', Number.isFinite(n) ? Math.min(MAX_TARGET, Math.max(0, n)) : 0);
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              accessibilityLabel="Target"
              style={[styles.stepValue, { color: theme.text }]}
            />
            <Pressable
              onPress={() => set('target', Math.min(MAX_TARGET, draft.target + 1))}
              disabled={draft.target >= MAX_TARGET}
              hitSlop={6}
              accessibilityLabel="Raise target"
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={20} color={theme.text} />
            </Pressable>
          </View>
          <Text style={{ color: draft.target > 0 ? theme.text : theme.subtext, fontSize: 15 }}>
            {draft.target === 0
              ? 'No target'
              : `${draft.target === 1 ? 'time' : 'times'} per ${periodNoun(draft.frequency)}`}
          </Text>
        </View>
        <Text style={[styles.small, { color: theme.subtext, marginTop: 6 }]}>
          {draft.target === 0
            ? `Optional. With no target, any entry marks the ${periodNoun(draft.frequency)} as done. Set 1 or more to track a goal like “3 times a week” in Summary.`
            : `Log each time you do it. A ${periodNoun(draft.frequency)} counts as reached once it has ${draft.target} ${draft.target === 1 ? 'entry' : 'entries'}.`}
        </Text>

        {draft.frequency === 'daily' && (
          <>
            {label('Rest days (optional)')}
            <View style={styles.wrapRow}>
              {WEEKDAYS.map((w, d) => {
                const on = draft.restDays.includes(d);
                return (
                  <Pressable
                    key={w}
                    onPress={() => toggleRestDay(d)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Rest day ${w}`}
                    style={[
                      styles.dayChip,
                      { borderColor: on ? draft.color : theme.border, backgroundColor: on ? draft.color : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: on ? '#fff' : theme.text, fontWeight: '600', fontSize: 13 }}>{w}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.small, { color: theme.subtext, marginTop: 6 }]}>
              Missing a rest day doesn’t break your streak or lower your Summary score. Logging on one still counts.
            </Text>
          </>
        )}

        {label('Reminder (optional)')}
        <View style={styles.targetRow}>
          <Switch
            value={draft.reminder !== null}
            onValueChange={toggleReminder}
            trackColor={{ true: draft.color, false: theme.border }}
            thumbColor="#fff"
            accessibilityLabel="Reminder"
          />
          {draft.reminder !== null ? (
            <View style={[styles.stepper, { borderColor: theme.border }]}>
              <Pressable
                onPress={() => setReminder(shiftTime(draft.reminder ?? timeText, -REMINDER_STEP))}
                hitSlop={6}
                accessibilityLabel="Earlier"
                style={styles.stepBtn}
              >
                <Ionicons name="remove" size={20} color={theme.text} />
              </Pressable>
              <TextInput
                value={timeText}
                onChangeText={(t) => {
                  setTimeText(t);
                  const m = t.trim().match(/^(\d{1,2})[:.](\d{2})$/);
                  const time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
                  if (TIME_RE.test(time)) set('reminder', time);
                }}
                onBlur={() => setTimeText(draft.reminder ?? DEFAULT_REMINDER)}
                keyboardType="numbers-and-punctuation"
                selectTextOnFocus
                maxLength={5}
                accessibilityLabel="Reminder time"
                style={[styles.stepValue, { width: 64, color: theme.text }]}
              />
              <Pressable
                onPress={() => setReminder(shiftTime(draft.reminder ?? timeText, REMINDER_STEP))}
                hitSlop={6}
                accessibilityLabel="Later"
                style={styles.stepBtn}
              >
                <Ionicons name="add" size={20} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: theme.subtext, fontSize: 15 }}>Off</Text>
          )}
        </View>
        <Text style={[styles.small, { color: permissionDenied ? theme.danger : theme.subtext, marginTop: 6 }]}>
          {permissionDenied
            ? 'Notifications are turned off for Habit Pixel. Allow them in your phone’s settings to get reminders.'
            : !remindersSupported
              ? 'Reminders ring on the Android app. Set one here and it carries over with your backup.'
              : draft.frequency === 'daily'
                ? 'A notification at this time each day, skipped once it’s done (and on rest days).'
                : `A notification at the start of each ${periodNoun(draft.frequency)}, then daily nudges when the target is at risk. Skipped once the target is reached.`}
        </Text>

        {label('What do you track?')}
        <Segmented<HabitKind>
          theme={theme}
          accent={draft.color}
          value={draft.kind}
          onChange={(v) => set('kind', v)}
          options={[
            ['boolean', 'Done / not done'],
            ['value', 'Intensity / value'],
          ]}
        />
        {draft.kind === 'value' && (
          <View style={[styles.wrapRow, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.small, { color: theme.subtext }]}>Maximum value</Text>
              <TextInput
                value={maxText}
                onChangeText={setMaxText}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: maxValid ? theme.border : theme.danger }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.small, { color: theme.subtext }]}>Unit (optional)</Text>
              <TextInput
                value={draft.unit}
                onChangeText={(t) => set('unit', t)}
                placeholder="pages, km, min…"
                placeholderTextColor={theme.subtext}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </View>
          </View>
        )}

        {label('Tile shape')}
        <Segmented<TileShape>
          theme={theme}
          accent={draft.color}
          value={draft.shape}
          onChange={(v) => set('shape', v)}
          options={[
            ['square', 'Square'],
            ['circle', 'Circle'],
            ['star', 'Star'],
          ]}
        />

        {label('Colour')}
        <View style={styles.wrapRow}>
          {HABIT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => set('color', c)}
              style={[styles.swatch, { backgroundColor: c, borderColor: draft.color === c ? theme.text : 'transparent' }]}
            />
          ))}
        </View>

        {label('Preview')}
        <View style={[styles.wrapRow, { alignItems: 'center' }]}>
          {(draft.kind === 'value' || draft.target > 1 ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 1, 1, 0, 1, 1]).map((s, i) => (
            <Tile key={i} size={22} shape={draft.shape} color={draft.color} strength={s} theme={theme} />
          ))}
        </View>

        <Pressable
          onPress={save}
          disabled={!canSave}
          style={[styles.primary, { backgroundColor: draft.color, opacity: canSave ? 1 : 0.4 }]}
        >
          <Text style={styles.primaryText}>{habit ? 'Save changes' : 'Add habit'}</Text>
        </Pressable>

        <View style={styles.footer}>
          {habit ? (
            <Pressable onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
              <Text style={{ color: theme.danger, fontWeight: '600' }}>
                {confirmDelete ? 'Tap again to delete permanently' : 'Delete habit'}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onClose}>
            <Text style={{ color: theme.subtext, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  small: { fontSize: 12, marginBottom: 4 },
  warn: { fontSize: 12, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10 },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  stepValue: { width: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', paddingVertical: 6 },
  dayChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  primary: { marginTop: 24, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 4 },
});
