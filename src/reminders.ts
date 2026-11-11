import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { addDays, nextPeriod, periodNoun, periodStart, startOfDay, toKey } from './dates';
import { isFrozen, isRestDay, periodCount } from './stats';
import type { Habit } from './types';

/** Scheduled notifications only exist on phones; the web and Windows apps hide the reminder setting. */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

const CHANNEL = 'reminders';
/** How far ahead reminders are planned. They're re-planned whenever habits change and when the app opens. */
const HORIZON_DAYS = 14;
/** iOS keeps at most 64 pending notifications; stay below it on every platform. */
const MAX_SCHEDULED = 60;

export interface PlannedReminder {
  habitId: string;
  date: Date;
  title: string;
  body: string;
}

/** Call once at startup: show reminders while the app is open, and create the Android channel. */
export function configureNotifications(): void {
  if (!remindersSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Habit reminders',
      // Exported through a nested `export *` that eslint-plugin-import can't follow; TypeScript checks it.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch((e) => console.warn('Failed to create notification channel', e));
  }
}

/** Ask for notification permission if needed. Resolves to whether reminders can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function reminderAt(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/**
 * The reminders to schedule for the coming days. Pure, so it can be reasoned about without a device.
 *
 * - Daily habits: every day at the reminder time, except rest days, frozen days and days already done.
 * - Weekly / monthly habits: on the first day of the period, plus a nudge every day once the target is at risk
 *   (as many entries still needed as days left, plus one), e.g. "1 more to hit 3 this week · 2 days left".
 * - Nothing is sent for a period that already reached its target or uses a streak freeze.
 */
export function planReminders(habits: Habit[], now = new Date()): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const today = startOfDay(now);
  for (const habit of habits) {
    if (!habit.reminder) continue;
    const f = habit.frequency;
    const title = `${habit.emoji ? `${habit.emoji} ` : ''}${habit.name}`;
    const target = Math.max(1, habit.target);
    const noun = periodNoun(f);
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const day = addDays(today, i);
      const date = reminderAt(day, habit.reminder);
      if (date <= now) continue;
      const start = periodStart(day, f);
      const key = toKey(start);
      if (isFrozen(habit, key) || isRestDay(habit, key)) continue;
      const needed = target - periodCount(habit, key);
      if (needed <= 0) continue;
      const when = f === 'daily' ? 'today' : `this ${noun}`;
      const progress =
        habit.target <= 1
          ? null
          : needed === habit.target
            ? `None yet: aim for ${habit.target} ${when}`
            : `${needed} more to hit ${habit.target} ${when}`;

      if (f === 'daily') {
        planned.push({ habitId: habit.id, date, title, body: progress ?? 'Not done yet today.' });
        continue;
      }
      const daysLeft = Math.round((nextPeriod(start, f).getTime() - day.getTime()) / 86400000);
      const atRisk = daysLeft <= needed + 1;
      if (!atRisk && day.getTime() !== start.getTime()) continue;
      const left = daysLeft === 1 ? 'last day!' : `${daysLeft} days left`;
      const body = atRisk
        ? `${progress ?? `Not done yet this ${noun}`} · ${left}`
        : habit.target >= 1
          ? `New ${noun}: aim for ${habit.target}×.`
          : `New ${noun}. Log it when you do it.`;
      planned.push({ habitId: habit.id, date, title, body });
    }
  }
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

/**
 * Replace every scheduled reminder with a fresh plan. Never prompts: if permission wasn't granted
 * (it's asked for when a reminder is turned on), nothing is scheduled.
 */
export async function syncReminders(habits: Habit[]): Promise<void> {
  if (!remindersSupported) return;
  const { granted } = await Notifications.getPermissionsAsync();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!granted) return;
  for (const r of planReminders(habits)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { habitId: r.habitId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Keep scheduled reminders in step with the habits: re-plan shortly after any change (logging an entry
 * cancels that day's reminder) and whenever the app comes back to the foreground (a new day may have started).
 */
export function useReminderSync(habits: Habit[], loaded: boolean): void {
  const latest = useRef(habits);
  useEffect(() => {
    latest.current = habits;
  }, [habits]);

  const sync = useCallback(() => {
    // Run one sync at a time, always with the newest habits.
    syncing = syncing.then(() => syncReminders(latest.current)).catch((e) => console.warn('Failed to schedule reminders', e));
  }, []);

  useEffect(() => {
    if (!remindersSupported || !loaded) return;
    const t = setTimeout(sync, 800);
    return () => clearTimeout(t);
  }, [habits, loaded, sync]);

  useEffect(() => {
    if (!remindersSupported || !loaded) return;
    const sub = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => sub.remove();
  }, [loaded, sync]);
}
