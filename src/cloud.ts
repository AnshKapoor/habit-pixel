import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { parseBackup } from './backup';
import type { Habit } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** False until a Supabase project is configured in `.env` (see README). */
export const cloudConfigured = Boolean(url && key);

export const supabase = cloudConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// On native, only refresh the auth token while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const TABLE = 'habit_backups';

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase;
}

/** Overwrite this account's cloud backup with the habits on this device. Returns the save time. */
export async function uploadHabits(userId: string, habits: Habit[]): Promise<string> {
  const { data, error } = await client()
    .from(TABLE)
    .upsert({ user_id: userId, data: habits, updated_at: new Date().toISOString() })
    .select('updated_at')
    .single();
  if (error) throw error;
  return data.updated_at;
}

export async function downloadHabits(userId: string): Promise<{ habits: Habit[]; updatedAt: string } | null> {
  const { data, error } = await client().from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Same checks as importing a file, so a damaged backup can't break the app.
  return { habits: parseBackup(JSON.stringify(data.data)).habits, updatedAt: data.updated_at };
}
