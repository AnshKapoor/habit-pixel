import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toKey } from './dates';
import { normalizeHabit } from './stats';
import { HABIT_COLORS } from './theme';
import type { Frequency, Habit, HabitKind, TileShape } from './types';

const FORMAT = 'habit-pixel';
/** 2: entries hold a list of values per period and habits have an optional target. Version 1 files still import. */
const VERSION = 2;

function fileName(): string {
  return `habit-pixel-${toKey(new Date())}.json`;
}

export function toBackupJson(habits: Habit[]): string {
  return JSON.stringify({ app: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), habits }, null, 2);
}

/** Web: downloads a .json file. Android: writes the file and opens the share sheet (save to Drive, Files, email…). */
export async function exportHabitsFile(habits: Habit[]): Promise<void> {
  const json = toBackupJson(habits);
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const file = new File(Paths.cache, fileName());
  if (file.exists) file.delete();
  file.create();
  await file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Habit Pixel backup' });
}

/** Let the user pick a backup file and return its text, or null if they cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Android file managers often don't label .json files as JSON, so accept anything and validate the contents.
    type: Platform.OS === 'web' ? ['application/json', '.json'] : '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

export interface ParsedBackup {
  habits: Habit[];
  /** Habits in the file that were unreadable and left out. */
  skipped: number;
  exportedAt: string | null;
}

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly'];
const KINDS: HabitKind[] = ['boolean', 'value'];
const SHAPES: TileShape[] = ['square', 'circle', 'star'];
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Check one habit from a file, filling in defaults for optional settings. Returns null if it can't be used. */
function readHabit(raw: unknown, index: number): Habit | null {
  if (!isObject(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const frequency = raw.frequency as Frequency;
  if (!name || !FREQUENCIES.includes(frequency)) return null;

  const kind: HabitKind = KINDS.includes(raw.kind as HabitKind) ? (raw.kind as HabitKind) : 'boolean';
  const maxValue =
    kind === 'value' && typeof raw.maxValue === 'number' && raw.maxValue >= 1 ? Math.round(raw.maxValue) : kind === 'value' ? 10 : 1;

  // Keep well-formed period keys; normalizeHabit below validates the values (a number in v1, a list in v2).
  const entries: Record<string, unknown> = {};
  if (isObject(raw.entries)) {
    for (const [k, v] of Object.entries(raw.entries)) if (KEY_RE.test(k)) entries[k] = v;
  }

  return normalizeHabit({
    id: typeof raw.id === 'string' && raw.id ? raw.id : `import-${Date.now().toString(36)}-${index}`,
    name,
    emoji: typeof raw.emoji === 'string' ? raw.emoji.slice(0, 16) : '',
    color: typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : HABIT_COLORS[0],
    frequency,
    kind,
    maxValue,
    unit: kind === 'value' && typeof raw.unit === 'string' ? raw.unit : '',
    shape: SHAPES.includes(raw.shape as TileShape) ? (raw.shape as TileShape) : 'square',
    target: typeof raw.target === 'number' ? raw.target : 0,
    createdAt: typeof raw.createdAt === 'string' && KEY_RE.test(raw.createdAt) ? raw.createdAt : toKey(new Date()),
    entries: entries as Habit['entries'],
  });
}

/** Accepts a Habit Pixel export file, or a bare array of habits. Throws with a readable message if unusable. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t valid JSON.');
  }
  const list = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.habits) ? data.habits : null;
  if (!list) throw new Error('This doesn’t look like a Habit Pixel backup (no list of habits found).');

  const habits = list.map(readHabit).filter((h): h is Habit => h !== null);
  if (list.length > 0 && habits.length === 0) throw new Error('None of the habits in this file could be read.');
  return {
    habits,
    skipped: list.length - habits.length,
    exportedAt: isObject(data) && typeof data.exportedAt === 'string' ? data.exportedAt : null,
  };
}

/**
 * Combine imported habits with the current ones. A habit already on this device (same id) takes the imported
 * settings, and its history is combined, with the file's entries winning for periods logged in both. New habits are added.
 */
export function mergeHabits(current: Habit[], imported: Habit[]): { habits: Habit[]; added: number; updated: number } {
  const byId = new Map(imported.map((h) => [h.id, h]));
  let updated = 0;
  const habits = current.map((h) => {
    const inc = byId.get(h.id);
    if (!inc) return h;
    byId.delete(h.id);
    updated++;
    // Entries are only comparable when the frequency matches; otherwise the file's version replaces it.
    const entries = inc.frequency === h.frequency ? { ...h.entries, ...inc.entries } : inc.entries;
    return normalizeHabit({ ...inc, entries, createdAt: h.createdAt < inc.createdAt ? h.createdAt : inc.createdAt });
  });
  const added = [...byId.values()];
  return { habits: [...habits, ...added], added: added.length, updated };
}
