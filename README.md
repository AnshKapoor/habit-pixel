# Habit Pixel

**Track your habits as GitHub-style contribution tiles.** Log daily, weekly or monthly habits, as simple yes/no checks or with an intensity (e.g. "read 7/10"), and watch your history fill in as a colourful calendar grid. One codebase runs on **Android** and in the **browser**, built with React Native + Expo.

<p align="center">
  <img src="docs/screenshots/habits.png" width="240" alt="Habit cards with daily contribution grids" />
  <img src="docs/screenshots/weekly-monthly.png" width="240" alt="Weekly and monthly habits with star tiles" />
  <img src="docs/screenshots/summary.png" width="240" alt="Summary page with efficiency per habit" />
</p>

## Features

- **Any frequency.** Daily habits show a 53-week grid like GitHub's contribution graph (one column per week, Mon–Sun). Weekly habits show one column per month with a tile per week. Monthly habits show a row per year.
- **Yes/no or intensity.** Yes/no habits fill a tile in full colour. Intensity habits have a maximum you choose (e.g. 10, or 8 glasses), and the tile fades with how much you did: 3/10 is faint, 10/10 is full colour.
- **Your style.** Square, circle or star tiles, 8 colours, an emoji icon and an optional unit.
- **Quick logging.** The round button on each card logs today, this week or this month. Tap any past tile to backfill or correct it.
- **Streaks.** Current streak, best streak and total for every habit.
- **Summary page.** Efficiency per habit and overall, over 30 days, 90 days, 12 months or all time, plus habits done today and active streaks.
- **Backups.** Export everything to a JSON file and import it on any device, merging with or replacing what's there. Optional cloud backup with an email login (Supabase).
- **Light and dark mode**, following your system setting. Works offline; data stays on the device unless you back it up.

## Screenshots

| Add a habit | Log an intensity | Account & backups | Dark mode |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/add-habit.png" width="190" alt="New habit form" /> | <img src="docs/screenshots/log-value.png" width="190" alt="Value picker for an intensity habit" /> | <img src="docs/screenshots/account.png" width="190" alt="Account screen with JSON export and import" /> | <img src="docs/screenshots/habits-dark.png" width="190" alt="Habits in dark mode" /> |

On a wide screen (web):

<img src="docs/screenshots/desktop.png" alt="Habit Pixel in a desktop browser" />

## How efficiency is calculated

Efficiency is counted per **period**: a day, week or month, depending on the habit.

| Habit type | Efficiency |
| --- | --- |
| Yes / no | periods done ÷ periods counted |
| Intensity | average of `value ÷ max` over all periods; periods not logged count as **0** |

- Counting starts when the habit was created, or at its earliest logged entry if you backfilled.
- The current day, week or month only counts once it's logged, so an unfinished today doesn't lower your score.
- **Overall efficiency** is the average across habits, so every habit counts equally whatever its frequency.

Example: reading 5/10 every day for 30 days gives 50%. Doing it 10/10 on 15 of those days and skipping the rest also gives 50%.

## Getting started

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/AnshKapoor/habit-pixel.git
cd habit-pixel
npm install
npm run web        # opens http://localhost:8081
```

### On an Android phone

**Quickest (no build):** install **Expo Go** from the Play Store, run `npm start`, and scan the QR code. Your phone and computer need to be on the same Wi-Fi.

**Installable APK:** build in the cloud with [EAS](https://docs.expo.dev/build/introduction/). This needs a free Expo account.

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

When the build finishes (about 10–20 minutes), open the link on your phone to download and install the APK.

## Backups

### JSON file (no account needed)

In the **Account** tab:

- **Export JSON** saves every habit with its settings and full history. On the web it downloads `habit-pixel-YYYY-MM-DD.json`; on Android it opens the share sheet, so you can save the file to Drive or Files, or email it.
- **Import JSON** shows what's in the file before changing anything, then lets you choose:
  - **Merge with mine:** keeps your habits, adds new ones, and combines the history of habits found in both (matched by id; the file's settings win).
  - **Replace all mine:** swaps your habits for the file's.

Imported files are checked: unreadable habits are skipped, missing settings get defaults, and out-of-range values are capped. A bare JSON array of habits works too, so you can write habits by hand:

```json
[
  { "name": "Read", "emoji": "📚", "frequency": "daily", "kind": "value", "maxValue": 10,
    "entries": { "2026-11-01": 6, "2026-11-02": 9 } },
  { "name": "Call family", "frequency": "monthly", "kind": "boolean", "shape": "star",
    "entries": { "2026-10-01": 1 } }
]
```

Entry keys are the start of each period: the date for daily habits, the **Monday** for weekly ones, and the **1st** for monthly ones.

### Cloud backup (optional, Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates a `habit_backups` table with row-level security, so each user can only access their own backup.
3. Copy `.env.example` to `.env`, then fill in the project URL and the **anon / publishable** key from **Project Settings → API**. Never put the `service_role` / secret key in the app.
4. Restart the dev server; Expo reads `.env` only at startup.

You can then create an account in the **Account** tab and use **Save to cloud** / **Restore from cloud**. Each account keeps one backup, replaced on every save. Supabase asks new users to confirm their email by default; you can turn this off under **Authentication → Sign In / Providers → Email** while testing.

For an APK build, add the two `EXPO_PUBLIC_SUPABASE_*` values as [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), because `.env` is not uploaded.

## Project structure

| Path | Purpose |
| --- | --- |
| `App.tsx` | Tab bar: Habits / Summary / Account |
| `src/screens/` | The three screens |
| `src/components/Heatmap.tsx` | Daily, weekly and monthly grids |
| `src/components/HabitCard.tsx` | A habit card with stats and its grid |
| `src/components/HabitEditor.tsx` | Add/edit habit form |
| `src/components/LogValueSheet.tsx` | Value picker for intensity habits |
| `src/store.tsx` | Habit state, saved with AsyncStorage (localStorage on web) |
| `src/dates.ts` | Period keys: day, Monday of the week, 1st of the month |
| `src/stats.ts` | Intensity, streaks, totals |
| `src/summary.ts` | Efficiency calculation |
| `src/backup.ts` | JSON export/import, validation, merge |
| `src/cloud.ts` | Supabase client, login session, cloud save/restore |
| `supabase/schema.sql` | Database table and access rules for cloud backups |

**Tech:** Expo SDK 58 · React Native 0.88 · TypeScript · react-native-web · Supabase · AsyncStorage

## License

[MIT](LICENSE)
