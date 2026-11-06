import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toKey } from './dates';
import { habitsToXlsx, looksLikeSpreadsheet, xlsxToHabits } from './spreadsheet';
import { normalizeHabit } from './stats';
import { HABIT_COLORS } from './theme';
import type { Frequency, Habit, HabitKind, TileShape } from './types';

const FORMAT = 'habit-pixel';
/** 2: entries hold a list of values per period and habits have an optional target. Version 1 files still import. */
const VERSION = 2;

export type ExportFormat = 'json' | 'xlsx';

const MIME: Record<ExportFormat, string> = {
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function fileName(format: ExportFormat): string {
  return `habit-pixel-${toKey(new Date())}.${format}`;
}

export function toBackupJson(habits: Habit[]): string {
  return JSON.stringify({ app: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), habits }, null, 2);
}

/**
 * Save all habits as JSON (exact backup) or Excel (.xlsx, opens in Excel and Google Sheets).
 * Web/desktop: downloads the file. Android: writes it and opens the share sheet (Drive, Files, email…).
 */
export async function exportHabitsFile(habits: Habit[], format: ExportFormat = 'json'): Promise<void> {
  const content = format === 'xlsx' ? habitsToXlsx(habits) : toBackupJson(habits);
  const name = fileName(format);
  if (Platform.OS === 'web') {
    const blob = new Blob([content as BlobPart], { type: MIME[format] });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: MIME[format], dialogTitle: 'Save Habit Pixel backup' });
}

/** Let the user pick a backup file (JSON or spreadsheet) and return its bytes, or null if they cancelled. */
export async function pickImportFile(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Android file managers often mislabel .json/.xlsx files, so accept anything there and check the contents.
    type:
      Platform.OS === 'web'
        ? ['application/json', '.json', MIME.xlsx, '.xlsx', '.xls', '.ods', 'application/vnd.ms-excel']
        : '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  return new File(asset.uri).bytes();
}

/** Read an imported file: a Habit Pixel spreadsheet (.xlsx/.xls/.ods) or a JSON backup. */
export function parseImport(bytes: Uint8Array): ParsedBackup {
  if (looksLikeSpreadsheet(bytes)) {
    const sheet = xlsxToHabits(bytes);
    return { ...readHabitList(sheet.habits, 'spreadsheet'), skippedEntries: sheet.skippedEntries, exportedAt: null };
  }
  return parseBackup(utf8(bytes));
}

/** Bytes → text. Uses TextDecoder when the JS engine has it, otherwise decodes UTF-8 by hand. */
function utf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp = b;
    if (b >= 0xf0) cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xe0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xc0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out.replace(/^\uFEFF/, '');
}

export interface ParsedBackup {
  habits: Habit[];
  /** Habits in the file that were unreadable and left out. */
  skipped: number;
  /** Spreadsheet entry rows that were left out (unknown habit, bad date or value). */
  skippedEntries?: number;
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

  return {
    ...readHabitList(list, 'file'),
    exportedAt: isObject(data) && typeof data.exportedAt === 'string' ? data.exportedAt : null,
  };
}

/** Validate a list of habit objects (from JSON or a spreadsheet). */
function readHabitList(list: unknown[], source: string): { habits: Habit[]; skipped: number } {
  const habits = list.map(readHabit).filter((h): h is Habit => h !== null);
  if (list.length > 0 && habits.length === 0) throw new Error(`None of the habits in this ${source} could be read.`);
  return { habits, skipped: list.length - habits.length };
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
