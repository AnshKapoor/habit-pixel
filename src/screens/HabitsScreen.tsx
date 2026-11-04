import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HabitCard } from '../components/HabitCard';
import { HabitEditor } from '../components/HabitEditor';
import { LogValueSheet } from '../components/LogValueSheet';
import { formatPeriod, toKey } from '../dates';
import { useStore } from '../store';
import type { Theme } from '../theme';
import type { Habit } from '../types';
import { screenStyles } from './screenStyles';

export function HabitsScreen({ theme }: { theme: Theme }) {
  const { loaded, habits, addHabit, updateHabit, deleteHabit, setEntry } = useStore();

  // `undefined` = editor closed, `null` = creating a new habit.
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined);
  const [logging, setLogging] = useState<{ id: string; key: string } | null>(null);
  const loggingHabit = logging ? (habits.find((h) => h.id === logging.id) ?? null) : null;

  const onLog = (habit: Habit, key: string) => {
    if (habit.kind === 'boolean') setEntry(habit.id, key, habit.entries[key] ? null : 1);
    else setLogging({ id: habit.id, key });
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
              onLog={(key) => onLog(h, key)}
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

      <LogValueSheet
        habit={loggingHabit}
        periodKey={logging?.key ?? null}
        theme={theme}
        onClose={() => setLogging(null)}
        onSave={(value) => {
          if (logging) setEntry(logging.id, logging.key, value);
          setLogging(null);
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
