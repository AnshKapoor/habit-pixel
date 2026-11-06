import Ionicons from '@expo/vector-icons/Ionicons';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConnectSheet, FaqSheet, HelpLink } from '../components/CloudSetup';
import { Segmented } from '../components/Segmented';
import {
  exportHabitsFile,
  mergeHabits,
  parseImport,
  pickImportFile,
  type ExportFormat,
  type ParsedBackup,
} from '../backup';
import { fetchGoogleSheet } from '../spreadsheet';
import { downloadHabits, uploadHabits, useCloud, useSession, type CloudConfig } from '../cloud';
import { useStore } from '../store';
import type { Theme } from '../theme';
import type { Habit } from '../types';
import { screenStyles } from './screenStyles';

function errorText(e: unknown): string {
  const msg =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  if (/failed to fetch|network request failed/i.test(msg)) {
    return 'Couldn’t reach the cloud server. Check your internet connection and the project URL under Cloud connection.';
  }
  return msg;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function AccountScreen({ theme }: { theme: Theme }) {
  const { client, config, loaded } = useCloud();
  const { session, ready } = useSession(client);
  const [sheet, setSheet] = useState<'connect' | 'faq' | null>(null);
  const openFaq = () => setSheet('faq');

  return (
    <ScrollView contentContainerStyle={screenStyles.content} keyboardShouldPersistTaps="handled">
      <View style={screenStyles.header}>
        <Text style={[screenStyles.title, { color: theme.text }]}>Account</Text>
        <Text style={{ color: theme.subtext }}>Back up your habits to the cloud and use them on other devices</Text>
      </View>

      {!loaded || (client && !ready) ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 30 }} />
      ) : !client || !config ? (
        <NotConnected theme={theme} onConnect={() => setSheet('connect')} onHelp={openFaq} />
      ) : (
        <>
          <Connection theme={theme} config={config} onChange={() => setSheet('connect')} onHelp={openFaq} />
          {session ? (
            <CloudBackup theme={theme} client={client} session={session} />
          ) : (
            <LoginForm theme={theme} client={client} />
          )}
        </>
      )}

      <BackupFile theme={theme} />

      <ConnectSheet
        visible={sheet === 'connect'}
        theme={theme}
        current={config}
        onClose={() => setSheet(null)}
        onHelp={openFaq}
      />
      <FaqSheet visible={sheet === 'faq'} theme={theme} onClose={() => setSheet(null)} />
    </ScrollView>
  );
}

function BackupFile({ theme }: { theme: Theme }) {
  const { habits, replaceHabits } = useStore();
  const [pending, setPending] = useState<(ParsedBackup & { source: string }) | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetLink, setSheetLink] = useState('');
  const [loadingSheet, setLoadingSheet] = useState(false);

  const onExport = async (format: ExportFormat) => {
    setMessage(null);
    try {
      await exportHabitsFile(habits, format);
      const what = format === 'xlsx' ? 'an Excel file' : 'JSON';
      setMessage({ text: `Exported ${habits.length} habit${habits.length === 1 ? '' : 's'} as ${what}.`, error: false });
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    }
  };

  const onImport = async () => {
    setMessage(null);
    setPending(null);
    try {
      const bytes = await pickImportFile();
      if (bytes !== null) setPending({ ...parseImport(bytes), source: 'the file' });
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    }
  };

  const onLoadSheet = async () => {
    if (!sheetLink.trim() || loadingSheet) return;
    setMessage(null);
    setPending(null);
    setLoadingSheet(true);
    try {
      const bytes = await fetchGoogleSheet(sheetLink);
      setPending({ ...parseImport(bytes), source: 'the Google Sheet' });
      setSheetOpen(false);
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    } finally {
      setLoadingSheet(false);
    }
  };

  const apply = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const skipped =
      (pending.skipped ? ` ${pending.skipped} unreadable habit(s) were skipped.` : '') +
      (pending.skippedEntries ? ` ${pending.skippedEntries} unreadable entry row(s) were skipped.` : '');
    if (mode === 'replace') {
      replaceHabits(pending.habits);
      setMessage({
        text: `Replaced your habits with ${pending.habits.length} from ${pending.source}.${skipped}`,
        error: false,
      });
    } else {
      const { habits: merged, added, updated } = mergeHabits(habits, pending.habits);
      replaceHabits(merged);
      setMessage({ text: `Imported: ${added} added, ${updated} updated.${skipped}`, error: false });
    }
    setPending(null);
  };

  return (
    <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[screenStyles.sectionTitle, { color: theme.subtext }]}>Backup file</Text>
      <Text style={{ color: theme.text, marginBottom: 12, lineHeight: 20 }}>
        Export all {habits.length} habit{habits.length === 1 ? '' : 's'} (settings and full history) and import them
        later on any device. No account needed. The Excel file opens in Excel and Google Sheets, with one tab for
        habits and one for entries that you can view, edit and import again.
      </Text>

      <Text style={[styles.label, { color: theme.subtext, marginTop: 0 }]}>Export</Text>
      <View style={styles.buttons}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            theme={theme}
            icon="grid-outline"
            label="Excel (.xlsx)"
            variant="outline"
            onPress={() => onExport('xlsx')}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            theme={theme}
            icon="code-slash-outline"
            label="JSON"
            variant="outline"
            onPress={() => onExport('json')}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: theme.subtext }]}>Import</Text>
      <View style={styles.buttons}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            theme={theme}
            icon="document-attach-outline"
            label="Excel or JSON file"
            variant="outline"
            onPress={onImport}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            theme={theme}
            icon="link-outline"
            label="Google Sheets link"
            variant="outline"
            onPress={() => {
              setSheetOpen((o) => !o);
              setMessage(null);
            }}
          />
        </View>
      </View>

      {sheetOpen ? (
        <View style={[styles.importBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
          <TextInput
            value={sheetLink}
            onChangeText={setSheetLink}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            placeholderTextColor={theme.subtext}
            onSubmitEditing={onLoadSheet}
            style={[screenStyles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          />
          <Text style={[styles.hint, { color: theme.subtext }]}>
            The sheet needs a Habits tab and an Entries tab, like an Excel export uploaded to Google Drive. In Google
            Sheets choose Share → General access → “Anyone with the link” (Viewer), then copy the link. The app only
            reads the sheet; it never changes it.
          </Text>
          <View style={{ marginTop: 10 }}>
            <Button
              theme={theme}
              icon="cloud-download-outline"
              label={loadingSheet ? 'Loading…' : 'Load sheet'}
              onPress={onLoadSheet}
              busy={loadingSheet}
              disabled={!sheetLink.trim() || loadingSheet}
            />
          </View>
        </View>
      ) : null}

      {pending ? (
        <View style={[styles.importBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
          <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 4 }}>
            Found {pending.habits.length} habit{pending.habits.length === 1 ? '' : 's'} in {pending.source}
            {pending.exportedAt ? ` (exported ${formatTime(pending.exportedAt)})` : ''}
          </Text>
          <Text style={{ color: theme.subtext, marginBottom: 12 }} numberOfLines={3}>
            {pending.habits.map((h) => `${h.emoji ? `${h.emoji} ` : ''}${h.name}`).join(', ') || 'No habits in this file.'}
            {pending.skipped ? `\n${pending.skipped} unreadable habit(s) will be skipped.` : ''}
            {pending.skippedEntries ? `\n${pending.skippedEntries} unreadable entry row(s) will be skipped.` : ''}
          </Text>
          <View style={styles.buttons}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button theme={theme} label="Merge with mine" onPress={() => apply('merge')} />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button theme={theme} label="Replace all mine" variant="outline" onPress={() => apply('replace')} />
            </View>
          </View>
          <Text style={[styles.hint, { color: theme.subtext }]}>
            Merge keeps your current habits, adds new ones from {pending.source} and combines the history of habits
            that exist in both. Replace removes the {habits.length} habit{habits.length === 1 ? '' : 's'} on this device first.
          </Text>
          <Pressable onPress={() => setPending(null)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
            <Text style={{ color: theme.subtext, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <Text style={[styles.msg, { color: message.error ? theme.danger : theme.accent }]}>{message.text}</Text>
      ) : null}
    </View>
  );
}

function NotConnected({ theme, onConnect, onHelp }: { theme: Theme; onConnect: () => void; onHelp: () => void }) {
  return (
    <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[screenStyles.sectionTitle, { color: theme.subtext }]}>Cloud backup</Text>
      <Text style={{ color: theme.text, lineHeight: 20, marginBottom: 14 }}>
        Connect your own free Supabase project to back up your habits and restore them on other devices.
      </Text>
      <View style={[styles.buttons, { alignItems: 'center' }]}>
        <View style={{ flexGrow: 1, minWidth: 170 }}>
          <Button theme={theme} icon="cloud-outline" label="Connect cloud" onPress={onConnect} />
        </View>
        <HelpLink theme={theme} onPress={onHelp} />
      </View>
    </View>
  );
}

function Connection({
  theme,
  config,
  onChange,
  onHelp,
}: {
  theme: Theme;
  config: CloudConfig;
  onChange: () => void;
  onHelp: () => void;
}) {
  let host = config.url;
  try {
    host = new URL(config.url).host;
  } catch {}
  return (
    <View style={[styles.connRow, { borderColor: theme.border }]}>
      <Ionicons name="cloud-done-outline" size={18} color={theme.accent} />
      <Text style={{ color: theme.subtext, flex: 1, fontSize: 13 }} numberOfLines={1}>
        Connected to <Text style={{ color: theme.text, fontWeight: '600' }}>{host}</Text>
      </Text>
      <Pressable onPress={onChange} hitSlop={8}>
        <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 13 }}>Change</Text>
      </Pressable>
      <Pressable onPress={onHelp} hitSlop={8} accessibilityLabel="Cloud backup FAQ">
        <Ionicons name="help-circle-outline" size={20} color={theme.accent} />
      </Pressable>
    </View>
  );
}

function LoginForm({ theme, client }: { theme: Theme; client: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setMessage({ text: 'Account created. Check your inbox to confirm your email, then sign in.', error: false });
          setMode('signin');
        }
      }
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.loginIcon}>
        <Ionicons name="cloud-outline" size={36} color={theme.accent} />
      </View>
      <Text style={[styles.loginTitle, { color: theme.text }]}>
        {mode === 'signin' ? 'Sign in to back up your habits' : 'Create your account'}
      </Text>

      <Segmented
        theme={theme}
        accent={theme.accent}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setMessage(null);
        }}
        options={[
          ['signin', 'Sign in'],
          ['signup', 'Create account'],
        ]}
      />

      <Text style={[styles.label, { color: theme.subtext }]}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={theme.subtext}
        style={[screenStyles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <Text style={[styles.label, { color: theme.subtext }]}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        placeholder="At least 6 characters"
        placeholderTextColor={theme.subtext}
        onSubmitEditing={submit}
        style={[screenStyles.input, { color: theme.text, borderColor: theme.border }]}
      />

      <View style={{ marginTop: 18 }}>
        <Button
          theme={theme}
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submit}
          disabled={!canSubmit}
          busy={busy}
        />
      </View>
      {message ? (
        <Text style={[styles.msg, { color: message.error ? theme.danger : theme.accent }]}>{message.text}</Text>
      ) : null}
    </View>
  );
}

function CloudBackup({ theme, client, session }: { theme: Theme; client: SupabaseClient; session: Session }) {
  const { habits, replaceHabits } = useStore();
  const userId = session.user.id;
  const [cloud, setCloud] = useState<{ habits: Habit[]; updatedAt: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);
  const [confirm, setConfirm] = useState<'save' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const refresh = useCallback(() => {
    downloadHabits(client, userId)
      .then(setCloud)
      .catch((e) => {
        setCloud(null);
        setMessage({ text: errorText(e), error: true });
      });
  }, [client, userId]);

  useEffect(refresh, [refresh]);

  const save = async () => {
    // Overwriting an existing backup needs a second tap.
    if (cloud && confirm !== 'save') return setConfirm('save');
    setConfirm(null);
    setBusy('save');
    setMessage(null);
    try {
      const updatedAt = await uploadHabits(client, userId, habits);
      setCloud({ habits, updatedAt });
      setMessage({ text: `Saved ${habits.length} habits to the cloud.`, error: false });
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const restore = () => {
    if (!cloud) return;
    if (confirm !== 'restore') return setConfirm('restore');
    setConfirm(null);
    replaceHabits(cloud.habits);
    setMessage({ text: `Restored ${cloud.habits.length} habits from the cloud.`, error: false });
  };

  return (
    <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[screenStyles.sectionTitle, { color: theme.subtext }]}>Cloud backup</Text>
      <View style={styles.userRow}>
        <Ionicons name="person-circle-outline" size={28} color={theme.subtext} />
        <Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>
          {session.user.email}
        </Text>
        <Pressable onPress={() => client.auth.signOut()} hitSlop={8}>
          <Text style={{ color: theme.danger, fontWeight: '600' }}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={{ color: theme.text, marginVertical: 12 }}>
        {cloud === undefined
          ? 'Checking for a cloud backup…'
          : cloud
            ? `Cloud backup: ${cloud.habits.length} habits, saved ${formatTime(cloud.updatedAt)}.`
            : 'No cloud backup yet.'}
      </Text>

      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <Button
            theme={theme}
            icon="cloud-upload-outline"
            label={confirm === 'save' ? 'Tap again to overwrite' : 'Save to cloud'}
            onPress={save}
            busy={busy === 'save'}
            disabled={busy !== null || cloud === undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            theme={theme}
            icon="cloud-download-outline"
            label={confirm === 'restore' ? 'Tap again to replace' : 'Restore from cloud'}
            variant="outline"
            onPress={restore}
            disabled={!cloud || busy !== null}
          />
        </View>
      </View>
      {confirm === 'save' && cloud ? (
        <Text style={[styles.msg, { color: theme.danger }]}>
          This replaces the cloud backup from {formatTime(cloud.updatedAt)} with the {habits.length} habits on this
          device.
        </Text>
      ) : confirm === 'restore' && cloud ? (
        <Text style={[styles.msg, { color: theme.danger }]}>
          This replaces the {habits.length} habits on this device with the {cloud.habits.length} from the cloud.
        </Text>
      ) : message ? (
        <Text style={[styles.msg, { color: message.error ? theme.danger : theme.accent }]}>{message.text}</Text>
      ) : null}
    </View>
  );
}

function Button({
  theme,
  label,
  onPress,
  icon,
  variant = 'solid',
  disabled,
  busy,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  busy?: boolean;
}) {
  const solid = variant === 'solid';
  const color = solid ? '#fff' : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        screenStyles.button,
        styles.buttonRow,
        solid ? { backgroundColor: theme.accent } : { borderWidth: 1, borderColor: theme.border },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={color} />
      ) : null}
      <Text style={[screenStyles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  loginIcon: { alignItems: 'center', marginBottom: 6 },
  loginTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  msg: { fontSize: 13, marginTop: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  email: { flex: 1, fontSize: 15, fontWeight: '600' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  importBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  buttonRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
});
