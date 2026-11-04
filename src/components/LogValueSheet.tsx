import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPeriod } from '../dates';
import { intensity } from '../stats';
import { tileColor, type Theme } from '../theme';
import type { Habit } from '../types';
import { Sheet } from './Sheet';

const MAX_CHIPS = 20;

interface Props {
  habit: Habit | null;
  periodKey: string | null;
  theme: Theme;
  onSave: (value: number | null) => void;
  onClose: () => void;
}

/** Pick how strongly a `value` habit was performed for one period. */
export function LogValueSheet({ habit, periodKey, theme, onSave, onClose }: Props) {
  const current = habit && periodKey ? habit.entries[periodKey] : undefined;
  const [text, setText] = useState('');

  useEffect(() => setText(current ? String(current) : ''), [current, periodKey]);

  if (!habit || !periodKey) return null;
  const max = habit.maxValue;
  const values = Array.from({ length: max }, (_, i) => i + 1);

  const submitText = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) onSave(Math.max(0, Math.min(max, n)));
  };

  return (
    <Sheet visible onClose={onClose} theme={theme}>
      <Text style={[styles.title, { color: theme.text }]}>
        {habit.emoji} {habit.name}
      </Text>
      <Text style={{ color: theme.subtext, marginBottom: 16 }}>
        {formatPeriod(periodKey, habit.frequency)} · {current ? `logged ${current}/${max}` : 'not logged'}
      </Text>

      {max <= MAX_CHIPS ? (
        <View style={styles.chips}>
          {values.map((v) => {
            const selected = v === current;
            const strength = intensity(habit, v);
            return (
              <Pressable
                key={v}
                onPress={() => onSave(v)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: tileColor(habit.color, strength, theme.empty),
                    borderColor: selected ? theme.text : 'transparent',
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
            placeholder={`0 – ${max}`}
            placeholderTextColor={theme.subtext}
            onSubmitEditing={submitText}
            autoFocus
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Pressable onPress={submitText} style={[styles.button, { backgroundColor: habit.color }]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
          </Pressable>
        </View>
      )}
      {habit.unit ? <Text style={{ color: theme.subtext, marginTop: 6 }}>Unit: {habit.unit}</Text> : null}

      <View style={styles.footer}>
        <Pressable onPress={() => onSave(null)} disabled={!current} style={{ opacity: current ? 1 : 0.4 }}>
          <Text style={{ color: theme.danger, fontWeight: '600' }}>Clear</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={{ color: theme.subtext, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
});
