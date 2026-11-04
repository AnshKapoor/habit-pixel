import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from './src/screens/AccountScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { StoreProvider } from './src/store';
import { useTheme, type Theme } from './src/theme';

type Tab = 'habits' | 'summary' | 'account';

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'habits', label: 'Habits', icon: 'grid' },
  { id: 'summary', label: 'Summary', icon: 'stats-chart' },
  { id: 'account', label: 'Account', icon: 'person-circle' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('habits');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'habits' && <HabitsScreen theme={theme} />}
        {tab === 'summary' && <SummaryScreen theme={theme} />}
        {tab === 'account' && <AccountScreen theme={theme} />}
      </View>
      <TabBar theme={theme} tab={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

function TabBar({ theme, tab, onChange }: { theme: Theme; tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.tabBar,
        { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {TABS.map((t) => {
        const active = t.id === tab;
        const color = active ? theme.accent : theme.subtext;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={active ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={color} />
            <Text style={[styles.tabLabel, { color, fontWeight: active ? '700' : '500' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11 },
});
