import * as XLSX from 'xlsx';
import { fromKey, periodStart, toKey, WEEKDAYS } from './dates';
import type { Frequency, Habit, HabitKind, TileShape } from './types';

/**
 * Spreadsheet version of a backup, readable and editable in Excel, Google Sheets or LibreOffice.
 *
 * - "Habits": one row per habit with its settings.
 * - "Entries": one row per logged entry (habit, period start, entry number, value).
 * - "How to edit": notes for people editing the file by hand (ignored on import).
 */

export const HABITS_SHEET = 'Habits';
export const ENTRIES_SHEET = 'Entries';
const HELP_SHEET = 'How to edit';

const HABIT_HEADERS = ['ID', 'Name', 'Icon', 'Colour', 'How often', 'Kind', 'Max value', 'Unit', 'Shape', 'Target', 'Created', 'Rest days', 'Reminder', 'Freezes'];
const ENTRY_HEADERS = ['Habit ID', 'Habit', 'Period start', 'Entry #', 'Value'];

const FREQ_LABEL: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const KIND_LABEL: Record<HabitKind, string> = { boolean: 'Done / not done', value: 'Intensity' };
const SHAPE_LABEL: Record<TileShape, string> = { square: 'Square', circle: 'Circle', star: 'Star' };

const HELP_ROWS = [
  ['Habit Pixel spreadsheet backup'],
  [],
  ['Habits tab', 'One row per habit. Keep the ID column as it is so imports update the same habit; leave it empty for a new habit.'],
  ['How often', 'Daily, Weekly or Monthly'],
  ['Kind', '“Done / not done” or “Intensity” (each entry then has a value from 1 to Max value)'],
  ['Target', 'Entries per day/week/month that count as reaching the goal; 0 or empty = no target'],
  ['Shape', 'Square, Circle or Star'],
  ['Colour', 'A hex colour such as #2DA44E (optional)'],
  ['Rest days', 'Daily habits only: planned rest days such as “Sat, Sun” (optional)'],
  ['Reminder', 'Reminder time as HH:MM, e.g. 20:30 (optional)'],
  ['Freezes', 'Period start dates covered by a streak freeze, e.g. “2026-11-03, 2026-11-10” (optional)'],
  [],
  ['Entries tab', 'One row per time you did a habit. Add rows to backfill history; delete rows to remove entries.'],
  ['Habit ID / Habit', 'Which habit the entry belongs to. The ID is used first, then the name.'],
  ['Period start', 'A date, preferably YYYY-MM-DD. Any day inside the week or month works; it is grouped automatically.'],
  ['Value', 'For intensity habits, the value of this entry. For done / not done habits it can be left empty.'],
  [],
  ['Import', 'In Habit Pixel: Account → Import file, or paste a Google Sheets link (shared as “Anyone with the link”).'],
];

/** Build an .xlsx workbook of all habits and their entries. */
export function habitsToXlsx(habits: Habit[]): Uint8Array {
  const habitRows = habits.map((h) => [
    h.id,
    h.name,
    h.emoji,
    h.color,
    FREQ_LABEL[h.frequency],
    KIND_LABEL[h.kind],
    h.kind === 'value' ? h.maxValue : '',
    h.unit,
    SHAPE_LABEL[h.shape],
    h.target,
    h.createdAt,
    h.restDays.map((d) => WEEKDAYS[d]).join(', '),
    h.reminder ?? '',
    h.freezes.join(', '),
  ]);

  const entryRows: (string | number)[][] = [];
  for (const h of habits) {
    for (const key of Object.keys(h.entries).sort()) {
      h.entries[key].forEach((v, i) => entryRows.push([h.id, h.name, key, i + 1, h.kind === 'value' ? v : 1]));
    }
  }

  const wb = XLSX.utils.book_new();
  const habitsSheet = XLSX.utils.aoa_to_sheet([HABIT_HEADERS, ...habitRows]);
  habitsSheet['!cols'] = [14, 22, 6, 10, 10, 16, 10, 10, 8, 8, 12, 14, 9, 24].map((wch) => ({ wch }));
  const entriesSheet = XLSX.utils.aoa_to_sheet([ENTRY_HEADERS, ...entryRows]);
  entriesSheet['!cols'] = [14, 22, 12, 8, 8].map((wch) => ({ wch }));
  const helpSheet = XLSX.utils.aoa_to_sheet(HELP_ROWS);
  helpSheet['!cols'] = [{ wch: 18 }, { wch: 100 }];

  XLSX.utils.book_append_sheet(wb, habitsSheet, HABITS_SHEET);
  XLSX.utils.book_append_sheet(wb, entriesSheet, ENTRIES_SHEET);
  XLSX.utils.book_append_sheet(wb, helpSheet, HELP_SHEET);
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer);
}

/** Lower-case letters and digits only, so “Max value”, “max_value” and “MaxValue” all match. */
function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet | null {
  const match = wb.SheetNames.find((n) => norm(n) === norm(name));
  return match ? wb.Sheets[match] : null;
}

type Row = Record<string, unknown>;

/** Rows keyed by normalised header. */
function rowsOf(sheet: XLSX.WorkSheet): Row[] {
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { raw: true, defval: '' });
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), v])));
}

function pick(row: Row, ...names: string[]): unknown {
  for (const n of names) {
    const v = row[norm(n)];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

function str(v: unknown): string {
  return typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validKey(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * A date cell as YYYY-MM-DD. Accepts spreadsheet date numbers, YYYY-MM-DD (or with / or .),
 * DD.MM.YYYY, and D/M/YYYY or M/D/YYYY (day first when the first number is over 12, otherwise month first).
 */
export function toDateKey(v: unknown): string | null {
  if (typeof v === 'number' && v > 0) {
    // Days since 1899-12-30 in the spreadsheet's calendar; read it as a plain date, ignoring time zones.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return validKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = str(v);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validKey(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return validKey(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return +m[1] > 12 ? validKey(+m[3], +m[2], +m[1]) : validKey(+m[3], +m[1], +m[2]);
  return null;
}

function parseFrequency(v: unknown): Frequency | null {
  const s = norm(v);
  if (s.startsWith('day') || s === 'daily') return 'daily';
  if (s.startsWith('week')) return 'weekly';
  if (s.startsWith('month')) return 'monthly';
  return null;
}

function parseKind(v: unknown): HabitKind {
  const s = norm(v);
  return s.startsWith('intens') || s.startsWith('value') || s === 'number' ? 'value' : 'boolean';
}

function parseShape(v: unknown): TileShape {
  const s = norm(v);
  return s === 'circle' || s === 'star' ? s : 'square';
}

/** "Sat, Sun" or "Saturday Sunday" → [5, 6]. */
function parseWeekdays(v: unknown): number[] {
  return str(v)
    .split(/[\s,;]+/)
    .map((w) => WEEKDAYS.findIndex((d) => norm(w).slice(0, 3) === norm(d)))
    .filter((i) => i >= 0);
}

/** "20:30", "8:05" or a spreadsheet time (fraction of a day) → "HH:MM". */
function parseTime(v: unknown): string | null {
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 1440) % 1440;
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const m = str(v).match(/^(\d{1,2})[:.](\d{2})/);
  return m && +m[1] < 24 && +m[2] < 60 ? `${pad(+m[1])}:${m[2]}` : null;
}

/** A list of dates, each filed under the start of its period. */
function parseDateList(v: unknown, frequency: Frequency | null): string[] {
  if (!frequency) return [];
  const parts = typeof v === 'number' ? [v] : str(v).split(/[\s,;]+/);
  return parts
    .map(toDateKey)
    .filter((k): k is string => k !== null)
    .map((k) => toKey(periodStart(fromKey(k), frequency)));
}

function slug(name: string): string {
  return (
    'sheet-' +
    norm(name).slice(0, 24) +
    '-' +
    Array.from(name).reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7).toString(36)
  );
}

export interface SheetImport {
  /** Habit objects in the JSON backup shape, still to be validated by the backup reader. */
  habits: unknown[];
  /** Entry rows that were left out (unknown habit or unreadable date/value). */
  skippedEntries: number;
}

/** Read a Habit Pixel spreadsheet (.xlsx, .xls, .ods…) back into habits. Throws with a readable message. */
export function xlsxToHabits(bytes: Uint8Array): SheetImport {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new Error('This file couldn’t be read as a spreadsheet.');
  }
  const habitsSheet = findSheet(wb, HABITS_SHEET);
  if (!habitsSheet) {
    throw new Error(`No “${HABITS_SHEET}” tab found. Export from Habit Pixel once to see the expected layout.`);
  }

  const habits: (Omit<Habit, 'entries'> & { entries: Record<string, number[]> })[] = [];
  const byId = new Map<string, (typeof habits)[number]>();
  const byName = new Map<string, (typeof habits)[number]>();

  for (const row of rowsOf(habitsSheet)) {
    const name = str(pick(row, 'Name', 'Habit'));
    const frequency = parseFrequency(pick(row, 'How often', 'Frequency'));
    if (!name && !frequency) continue; // blank row
    const kind = parseKind(pick(row, 'Kind', 'Type'));
    let id = str(pick(row, 'ID')) || slug(name);
    // A copied row would otherwise create two habits with the same ID.
    for (let n = 2; byId.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    const created = toDateKey(pick(row, 'Created', 'Created at'));
    const habit = {
      id,
      name,
      emoji: str(pick(row, 'Icon', 'Emoji')),
      color: str(pick(row, 'Colour', 'Color')),
      // Left invalid on purpose when missing, so the backup reader skips and counts it.
      frequency: (frequency ?? '') as Frequency,
      kind,
      maxValue: num(pick(row, 'Max value', 'Max')) ?? (kind === 'value' ? 10 : 1),
      unit: str(pick(row, 'Unit')),
      shape: parseShape(pick(row, 'Shape')),
      target: Math.max(0, Math.round(num(pick(row, 'Target')) ?? 0)),
      createdAt: created ?? toKey(new Date()),
      restDays: parseWeekdays(pick(row, 'Rest days', 'Rest')),
      reminder: parseTime(pick(row, 'Reminder', 'Reminder time')),
      freezes: parseDateList(pick(row, 'Freezes', 'Frozen'), frequency),
      entries: {} as Record<string, number[]>,
    };
    habits.push(habit);
    byId.set(id, habit);
    if (name) byName.set(norm(name), habit);
  }

  let skippedEntries = 0;
  const entriesSheet = findSheet(wb, ENTRIES_SHEET);
  if (entriesSheet) {
    const rows = rowsOf(entriesSheet)
      .map((row) => ({
        habit: byId.get(str(pick(row, 'Habit ID', 'ID'))) ?? byName.get(norm(pick(row, 'Habit', 'Name'))),
        date: toDateKey(pick(row, 'Period start', 'Date', 'Period')),
        order: num(pick(row, 'Entry #', 'Entry', 'Entry number')) ?? 0,
        value: num(pick(row, 'Value')),
        blank: Object.values(row).every((v) => v === ''),
      }))
      .filter((r) => !r.blank);
    rows.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.order - b.order);

    for (const r of rows) {
      const h = r.habit;
      if (!h || !r.date || !h.frequency) {
        skippedEntries++;
        continue;
      }
      const value = h.kind === 'value' ? r.value : (r.value ?? 1);
      if (value === null || value <= 0) {
        skippedEntries++;
        continue;
      }
      // Any day inside the period counts: file it under the period's start.
      const key = toKey(periodStart(fromKey(r.date), h.frequency));
      (h.entries[key] ??= []).push(h.kind === 'value' ? value : 1);
    }
  }

  return { habits, skippedEntries };
}

/** True when the bytes look like a zip-based (xlsx/ods) or legacy Excel (xls) file. */
export function looksLikeSpreadsheet(bytes: Uint8Array): boolean {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || ole;
}

/**
 * The download address for a Google Sheets link: a normal share link (…/spreadsheets/d/<id>/edit),
 * a “Publish to web” link (…/d/e/<id>/pubhtml) or a bare spreadsheet ID.
 */
export function googleSheetDownloadUrl(link: string): string | null {
  const s = link.trim();
  const published = s.match(/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=xlsx`;
  const shared = s.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]+)/);
  if (shared) return `https://docs.google.com/spreadsheets/d/${shared[1]}/export?format=xlsx`;
  if (/^[\w-]{30,}$/.test(s)) return `https://docs.google.com/spreadsheets/d/${s}/export?format=xlsx`;
  return null;
}

/** Download a Google Sheet as .xlsx. It must be shared as “Anyone with the link” (or published to the web). */
export async function fetchGoogleSheet(link: string): Promise<Uint8Array> {
  const url = googleSheetDownloadUrl(link);
  if (!url) throw new Error('That doesn’t look like a Google Sheets link. Copy it from Share → Copy link.');
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      'Couldn’t download the sheet. Check your internet connection and that it is shared as “Anyone with the link”.',
    );
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.includes('text/html')) {
    throw new Error(
      'Google didn’t share this sheet with the app. In Google Sheets choose Share → General access → “Anyone with the link” (Viewer), then try again.',
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!looksLikeSpreadsheet(bytes)) throw new Error('Google returned something that isn’t a spreadsheet.');
  return bytes;
}
