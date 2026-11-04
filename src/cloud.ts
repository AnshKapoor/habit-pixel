import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { parseBackup } from './backup';
import type { Habit } from './types';

/** Supabase project the app backs up to. Entered in the Account tab, or baked in via `.env`. */
export interface CloudConfig {
  url: string;
  key: string;
}

const CONFIG_KEY = 'habit-pixel/cloud-config/v1';
const TABLE = 'habit_backups';

const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const envConfig: CloudConfig | null = envUrl && envKey ? { url: envUrl, key: envKey } : null;

let config: CloudConfig | null = envConfig;
let client: SupabaseClient | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function buildClient(c: CloudConfig | null): SupabaseClient | null {
  if (!c) return null;
  return createClient(c.url, c.key, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
}

function emit() {
  listeners.forEach((l) => l());
}

const loading = AsyncStorage.getItem(CONFIG_KEY)
  .then((raw) => {
    if (raw) config = JSON.parse(raw);
  })
  .catch((e) => console.warn('Failed to load cloud settings', e))
  .finally(() => {
    client = buildClient(config);
    loaded = true;
    emit();
  });

// On native, only refresh the auth token while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (!client) return;
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}

/** Accepts a project URL or just the project ref, e.g. `abcd1234`. */
export function normalizeUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, '');
  if (/^[a-z0-9]{15,30}$/i.test(u)) u = `https://${u}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/(rest|auth)\/v1.*$/i, '');
}

/**
 * Checks the URL and key reach a Supabase project that has the backup table,
 * then saves them on this device. Throws a readable error otherwise.
 */
export async function connectCloud(input: CloudConfig): Promise<void> {
  const next = { url: normalizeUrl(input.url), key: input.key.trim() };
  try {
    new URL(next.url);
  } catch {
    throw new Error('That doesn’t look like a web address. It should look like https://abcd1234.supabase.co');
  }
  if (!next.key) throw new Error('Paste the project’s anon / publishable key.');
  if (/^sb_secret_/.test(next.key) || /service_role/.test(decodeJwtRole(next.key))) {
    throw new Error('That is the secret (service_role) key. Use the anon / publishable key instead — never put the secret key in an app.');
  }

  const test = buildClient(next)!;
  let error: { message: string; code?: string } | null;
  try {
    ({ error } = await test.from(TABLE).select('user_id').limit(1));
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) };
  }
  if (error) {
    if (/failed to fetch|network request failed/i.test(error.message)) {
      throw new Error('Couldn’t reach that URL. Check the address and your internet connection.');
    }
    if (/api key|jwt|unauthori[sz]ed|401/i.test(error.message)) {
      throw new Error('The project rejected this key. Copy the anon / publishable key again.');
    }
    if (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find the table/i.test(error.message)) {
      throw new Error('Connected, but the habit_backups table is missing. Run the setup SQL (see “How to set up”).');
    }
    throw new Error(error.message);
  }

  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  await client?.auth.signOut({ scope: 'local' }).catch(() => {});
  config = next;
  client = test;
  emit();
}

/** Forget the project on this device (signs out first). Falls back to the `.env` project, if any. */
export async function disconnectCloud(): Promise<void> {
  await client?.auth.signOut({ scope: 'local' }).catch(() => {});
  await AsyncStorage.removeItem(CONFIG_KEY);
  config = envConfig;
  client = buildClient(config);
  emit();
}

function decodeJwtRole(key: string): string {
  try {
    const part = key.split('.')[1];
    if (!part) return '';
    const json = globalThis.atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return String(JSON.parse(json).role ?? '');
  } catch {
    return '';
  }
}

export function useCloud(): { client: SupabaseClient | null; config: CloudConfig | null; loaded: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    loading.then(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { client, config, loaded };
}

export function useSession(c: SupabaseClient | null): { session: Session | null; ready: boolean } {
  // Remember which client the session belongs to, so switching projects never shows a stale login.
  const [state, setState] = useState<{ client: SupabaseClient | null; session: Session | null }>({
    client: null,
    session: null,
  });

  useEffect(() => {
    if (!c) return;
    let live = true;
    c.auth.getSession().then(({ data }) => live && setState({ client: c, session: data.session }));
    const { data } = c.auth.onAuthStateChange((_event, s) => live && setState({ client: c, session: s }));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [c]);

  if (!c) return { session: null, ready: true };
  return state.client === c ? { session: state.session, ready: true } : { session: null, ready: false };
}

/** Overwrite this account's cloud backup with the habits on this device. Returns the save time. */
export async function uploadHabits(c: SupabaseClient, userId: string, habits: Habit[]): Promise<string> {
  const { data, error } = await c
    .from(TABLE)
    .upsert({ user_id: userId, data: habits, updated_at: new Date().toISOString() })
    .select('updated_at')
    .single();
  if (error) throw error;
  return data.updated_at;
}

export async function downloadHabits(
  c: SupabaseClient,
  userId: string,
): Promise<{ habits: Habit[]; updatedAt: string } | null> {
  const { data, error } = await c.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Same checks as importing a file, so a damaged backup can't break the app.
  return { habits: parseBackup(JSON.stringify(data.data)).habits, updatedAt: data.updated_at };
}
