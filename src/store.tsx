import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fromKey, toKey, weekdayIndex } from './dates';
import { canFreeze, isFrozen, normalizeHabit } from './stats';
import type { Habit, HabitDraft } from './types';

const STORAGE_KEY = 'habit-pixel/habits/v1';

interface Store {
  loaded: boolean;
  habits: Habit[];
  addHabit: (draft: HabitDraft) => void;
  updateHabit: (id: string, draft: HabitDraft) => void;
  deleteHabit: (id: string) => void;
  /** Log one more entry (value 1 for done / not done habits) in the period starting at `key`. */
  addEntry: (id: string, key: string, value: number) => void;
  /** Make `value` the only entry in that period (habits without a target log once per period). */
  setOnlyEntry: (id: string, key: string, value: number) => void;
  /** Remove the entry at `index` from that period. */
  removeEntry: (id: string, key: string, index: number) => void;
  /** Remove every entry in that period (back to 0 / not done). */
  clearPeriod: (id: string, key: string) => void;
  /** Use a streak freeze on that period, or give it back if it already has one. */
  toggleFreeze: (id: string, key: string) => void;
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
        // normalizeHabit upgrades data saved by older versions (one value per period, no target).
        if (raw) setHabits((JSON.parse(raw) as Habit[]).map(normalizeHabit));
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
    setHabits((hs) => [...hs, { ...draft, id: newId(), createdAt: toKey(new Date()), entries: {}, freezes: [] }]);
  }, []);

  const updateHabit = useCallback((id: string, draft: HabitDraft) => {
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        let entries = h.entries;
        let freezes = h.freezes;
        // Switching frequency invalidates period keys; keep entries and freezes only if it didn't change.
        if (draft.frequency !== h.frequency) {
          entries = {};
          freezes = [];
        }
        // Clamp values when the scale shrinks or the habit becomes yes/no.
        else if (draft.kind === 'boolean' || draft.maxValue < h.maxValue) {
          entries = Object.fromEntries(
            Object.entries(entries).map(([k, list]) => [
              k,
              list.map((v) => (draft.kind === 'boolean' ? 1 : Math.min(v, draft.maxValue))),
            ]),
          );
        }
        const restDays = draft.frequency === 'daily' ? draft.restDays : [];
        // A rest day can't also use a freeze.
        if (restDays.length) freezes = freezes.filter((k) => !restDays.includes(weekdayIndex(fromKey(k))));
        return { ...h, ...draft, restDays, entries, freezes };
      }),
    );
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits((hs) => hs.filter((h) => h.id !== id));
  }, []);

  const changeEntries = useCallback((id: string, key: string, change: (list: number[]) => number[]) => {
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        const entries = { ...h.entries };
        const list = change(entries[key] ?? []);
        if (list.length) entries[key] = list;
        else delete entries[key];
        return { ...h, entries };
      }),
    );
  }, []);

  const addEntry = useCallback(
    (id: string, key: string, value: number) => {
      if (value > 0) changeEntries(id, key, (list) => [...list, value]);
    },
    [changeEntries],
  );
  const setOnlyEntry = useCallback(
    (id: string, key: string, value: number) => {
      if (value > 0) changeEntries(id, key, () => [value]);
    },
    [changeEntries],
  );
  const removeEntry = useCallback(
    (id: string, key: string, index: number) => changeEntries(id, key, (list) => list.filter((_, i) => i !== index)),
    [changeEntries],
  );
  const clearPeriod = useCallback((id: string, key: string) => changeEntries(id, key, () => []), [changeEntries]);

  const toggleFreeze = useCallback((id: string, key: string) => {
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        if (isFrozen(h, key)) return { ...h, freezes: h.freezes.filter((k) => k !== key) };
        return canFreeze(h, key) ? { ...h, freezes: [...h.freezes, key].sort() } : h;
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
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
      replaceHabits: setHabits,
    }),
    [loaded, habits, addHabit, updateHabit, deleteHabit, addEntry, setOnlyEntry, removeEntry, clearPeriod, toggleFreeze],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
