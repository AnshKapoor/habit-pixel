import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toKey } from './dates';
import type { Habit, HabitDraft } from './types';

const STORAGE_KEY = 'habit-pixel/habits/v1';

interface Store {
  loaded: boolean;
  habits: Habit[];
  addHabit: (draft: HabitDraft) => void;
  updateHabit: (id: string, draft: HabitDraft) => void;
  deleteHabit: (id: string) => void;
  /** `null` or 0 clears the entry for that period. */
  setEntry: (id: string, key: string, value: number | null) => void;
  /** Replace everything, e.g. when restoring a cloud backup. */
  replaceHabits: (habits: Habit[]) => void;
}

const StoreContext = createContext<Store | null>(null);

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setHabits(JSON.parse(raw));
      })
      .catch((e) => console.warn('Failed to load habits', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits)).catch((e) =>
      console.warn('Failed to save habits', e),
    );
  }, [habits, loaded]);

  const addHabit = useCallback((draft: HabitDraft) => {
    setHabits((hs) => [...hs, { ...draft, id: newId(), createdAt: toKey(new Date()), entries: {} }]);
  }, []);

  const updateHabit = useCallback((id: string, draft: HabitDraft) => {
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        let entries = h.entries;
        // Switching frequency invalidates period keys; keep entries only if it didn't change.
        if (draft.frequency !== h.frequency) entries = {};
        // Clamp values when the scale shrinks or the habit becomes yes/no.
        else if (draft.kind === 'boolean' || draft.maxValue < h.maxValue) {
          entries = Object.fromEntries(
            Object.entries(entries).map(([k, v]) => [k, draft.kind === 'boolean' ? 1 : Math.min(v, draft.maxValue)]),
          );
        }
        return { ...h, ...draft, entries };
      }),
    );
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits((hs) => hs.filter((h) => h.id !== id));
  }, []);

  const setEntry = useCallback((id: string, key: string, value: number | null) => {
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        const entries = { ...h.entries };
        if (value && value > 0) entries[key] = value;
        else delete entries[key];
        return { ...h, entries };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ loaded, habits, addHabit, updateHabit, deleteHabit, setEntry, replaceHabits: setHabits }),
    [loaded, habits, addHabit, updateHabit, deleteHabit, setEntry],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
