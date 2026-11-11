import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HabitCard } from '../components/HabitCard';
import { HabitEditor } from '../components/HabitEditor';
import { EntriesSheet } from '../components/EntriesSheet';
import { formatPeriod, toKey } from '../dates';
import { successHaptic, tapHaptic } from '../haptics';
import { periodCount } from '../stats';
import { useStore } from '../store';
import type { Theme } from '../theme';
import type { Habit } from '../types';
import { screenStyles } from './screenStyles';

export function HabitsScreen({ theme }: { theme: Theme }) {
  const {
    loaded,
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    addEntry,
    setOnlyEntry,
    removeEntry,
    clearPeriod,
    toggleFreeze,
  } = useStore();

  // `undefined` = editor closed, `null` = creating a new habit.
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined);
  const [logging, setLogging] = useState<{ id: string; key: string } | null>(null);
  const loggingHabit = logging ? (habits.find((h) => h.id === logging.id) ?? null) : null;

  /** Log an entry with haptic feedback: a light tap, or a stronger one when it reaches the target. */
  const logEntry = (value: number, replace: boolean) => {
    if (!logging || !loggingHabit || value <= 0) return;
    const before = periodCount(loggingHabit, logging.key);
    const after = replace ? 1 : before + 1;
    const goal = Math.max(1, loggingHabit.target);
    if (before < goal && after >= goal) successHaptic();
    else tapHaptic();
    if (replace) setOnlyEntry(logging.id, logging.key, value);
    else addEntry(logging.id, logging.key, value);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[screenStyles.content, { paddingBottom: 110 }]}>
        <View style={screenStyles.header}>
          <Text style={[screenStyles.title, { color: theme.text }]}>Habit Pixel</Text>
          <Text style={{ color: theme.subtext }}>{formatPeriod(toKey(new Date()), 'daily')}</Text>
        </View>

        {!loaded ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
        ) : habits.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Ionicons name="grid-outline" size={40} color={theme.subtext} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No habits yet</Text>
            <Text style={{ color: theme.subtext, textAlign: 'center' }}>
              Tap the + button to add something you want to do daily, weekly or monthly.
            </Text>
          </View>
        ) : (
          habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              theme={theme}
              onEdit={() => setEditing(h)}
              onLog={(key) => setLogging({ id: h.id, key })}
            />
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => setEditing(null)}
        accessibilityLabel="Add habit"
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <HabitEditor
        visible={editing !== undefined}
        habit={editing ?? null}
        theme={theme}
        onClose={() => setEditing(undefined)}
        onSave={(draft) => {
          if (editing) updateHabit(editing.id, draft);
          else addHabit(draft);
          setEditing(undefined);
        }}
        onDelete={() => {
          if (editing) deleteHabit(editing.id);
          setEditing(undefined);
        }}
      />

      <EntriesSheet
        habit={loggingHabit}
        periodKey={logging?.key ?? null}
        theme={theme}
        onClose={() => setLogging(null)}
        onAdd={(value) => logEntry(value, false)}
        onSet={(value) => logEntry(value, true)}
        onRemove={(index) => logging && removeEntry(logging.id, logging.key, index)}
        onClear={() => logging && clearPeriod(logging.id, logging.key)}
        onToggleFreeze={() => {
          if (!logging) return;
          tapHaptic();
          toggleFreeze(logging.id, logging.key);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 8,
    padding: 32,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    marginTop: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
