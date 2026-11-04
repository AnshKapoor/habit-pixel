import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Theme } from '../theme';

const CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  { id: 'popular', label: 'Popular', emojis: ['🏃', '📚', '💧', '🧘', '💪', '✍️', '🎸', '🥗', '😴', '🧹', '💻', '🌱', '🚭', '💊', '🙏', '📵'] },
  { id: 'fitness', label: 'Fitness', emojis: ['🏃', '🚶', '🚴', '🏊', '🏋️', '🤸', '🧗', '⚽', '🏀', '🎾', '🏸', '🥊', '⛹️', '🛹', '⛷️', '🥾', '🧎', '🤾'] },
  { id: 'health', label: 'Health', emojis: ['💧', '🥗', '🍎', '🥦', '🍳', '😴', '💊', '🦷', '🧴', '🚭', '🍷', '☕', '🍬', '🩺', '⚖️', '🫁', '❤️', '🛁'] },
  { id: 'mind', label: 'Mind', emojis: ['🧘', '🙏', '🧠', '📓', '😊', '🌅', '🌙', '🕯️', '🎯', '💭', '🫶', '📵', '🌬️', '☮️', '✨', '🪷'] },
  { id: 'learn', label: 'Learning', emojis: ['📚', '📖', '✍️', '🎓', '🧮', '🔬', '🌍', '🗣️', '🈯', '💡', '📝', '🎧', '♟️', '🧩'] },
  { id: 'work', label: 'Work', emojis: ['💻', '📧', '📅', '⏰', '📈', '💰', '🗂️', '📞', '🧑‍💻', '⌨️', '🚀', '✅'] },
  { id: 'home', label: 'Home', emojis: ['🧹', '🧺', '🍽️', '🛏️', '🪴', '🐕', '🐈', '👶', '🛒', '🔧', '🗑️', '🧽'] },
  { id: 'hobbies', label: 'Hobbies', emojis: ['🎸', '🎹', '🥁', '🎨', '📷', '🎮', '🧶', '🪡', '🎤', '🎬', '🍰', '🌱', '🎣', '🏕️'] },
  { id: 'social', label: 'Social', emojis: ['👨‍👩‍👧', '📞', '💌', '🤝', '🎁', '👫', '💬', '🫂', '🥳', '🙋'] },
];

type SegmenterCtor = new (l?: string, o?: { granularity: 'grapheme' }) => {
  segment: (s: string) => Iterable<{ segment: string }>;
};

/** Split into user-perceived characters, keeping flags, skin tones and ZWJ sequences (👨‍👩‍👧) whole. */
function graphemes(text: string): string[] {
  const Seg = (Intl as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return (
    text.match(
      /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|./gsu,
    ) ?? []
  );
}

export function IconPicker({
  value,
  color,
  theme,
  onChange,
}: {
  value: string;
  color: string;
  theme: Theme;
  onChange: (emoji: string) => void;
}) {
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [custom, setCustom] = useState('');
  const emojis = CATEGORIES.find((c) => c.id === cat)!.emojis;

  const onCustom = (t: string) => {
    // Keep only the newest emoji typed, so the field always holds one icon.
    const g = graphemes(t.trim()).pop() ?? '';
    setCustom(g);
    if (g) onChange(g);
  };

  return (
    <View>
      <View style={styles.top}>
        <View style={[styles.preview, { borderColor: value ? color : theme.border, backgroundColor: theme.empty }]}>
          {value ? (
            <Text style={styles.previewText}>{value}</Text>
          ) : (
            <Ionicons name="image-outline" size={24} color={theme.subtext} />
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.customWrap, { borderColor: theme.border }]}>
            <Ionicons name="happy-outline" size={18} color={theme.subtext} />
            <TextInput
              value={custom}
              onChangeText={onCustom}
              placeholder="Type or paste any emoji"
              placeholderTextColor={theme.subtext}
              autoCorrect={false}
              style={[styles.customInput, { color: theme.text }]}
              accessibilityLabel="Custom icon"
            />
          </View>
          <Text style={{ color: theme.subtext, fontSize: 12 }}>
            Tip: switch your keyboard to emoji to pick anything.
          </Text>
        </View>
        {value ? (
          <Pressable
            onPress={() => {
              onChange('');
              setCustom('');
            }}
            hitSlop={8}
            accessibilityLabel="Remove icon"
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={22} color={theme.subtext} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {CATEGORIES.map((c) => {
          const active = c.id === cat;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCat(c.id)}
              style={[
                styles.tab,
                { borderColor: active ? color : theme.border, backgroundColor: active ? color : 'transparent' },
              ]}
            >
              <Text style={{ color: active ? '#fff' : theme.text, fontSize: 13, fontWeight: active ? '700' : '500' }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.grid}>
        {emojis.map((e) => {
          const selected = value === e;
          return (
            <Pressable
              key={e}
              onPress={() => {
                onChange(selected ? '' : e);
                setCustom('');
              }}
              style={[
                styles.cell,
                { borderColor: selected ? color : theme.border },
                selected && { backgroundColor: theme.empty, borderWidth: 2 },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 56, height: 56, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  previewText: { fontSize: 30 },
  customWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  customInput: { flex: 1, paddingVertical: 9, fontSize: 16 },
  clear: { alignSelf: 'flex-start' },
  tabs: { gap: 6, paddingVertical: 12 },
  tab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
