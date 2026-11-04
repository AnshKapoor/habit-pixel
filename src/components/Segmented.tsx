import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../theme';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  theme,
  accent,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  theme: Theme;
  accent: string;
}) {
  return (
    <View style={[styles.segmented, { borderColor: theme.border }]}>
      {options.map(([v, text]) => {
        const active = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} style={[styles.segment, active && { backgroundColor: accent }]}>
            <Text style={{ color: active ? '#fff' : theme.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
});
