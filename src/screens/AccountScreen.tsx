import Ionicons from '@expo/vector-icons/Ionicons';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Segmented } from '../components/Segmented';
import { exportHabitsFile, mergeHabits, parseBackup, pickBackupFile, type ParsedBackup } from '../backup';
import { cloudConfigured, downloadHabits, supabase, uploadHabits, useSession } from '../cloud';
import { useStore } from '../store';
import type { Theme } from '../theme';
import type { Habit } from '../types';
import { screenStyles } from './screenStyles';

function errorText(e: unknown): string {
  const msg =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  if (/failed to fetch|network request failed/i.test(msg)) {
    return 'Couldn’t reach the cloud server. Check your internet connection and the Supabase URL in .env.';
  }
  return msg;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function AccountScreen({ theme }: { theme: Theme }) {
  const { session, ready } = useSession();

  return (
    <ScrollView contentContainerStyle={screenStyles.content} keyboardShouldPersistTaps="handled">
      <View style={screenStyles.header}>
        <Text style={[screenStyles.title, { color: theme.text }]}>Account</Text>
        <Text style={{ color: theme.subtext }}>Back up your habits to the cloud and use them on other devices</Text>
      </View>

      {!cloudConfigured ? (
        <NotConfigured theme={theme} />
      ) : !ready ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 30 }} />
      ) : session ? (
        <CloudBackup theme={theme} session={session} />
      ) : (
        <LoginForm theme={theme} />
      )}

      <BackupFile theme={theme} />
    </ScrollView>
  );
}

function BackupFile({ theme }: { theme: Theme }) {
  const { habits, replaceHabits } = useStore();
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const onExport = async () => {
    setMessage(null);
    try {
      await exportHabitsFile(habits);
      setMessage({ text: `Exported ${habits.length} habit${habits.length === 1 ? '' : 's'}.`, error: false });
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    }
  };

  const onImport = async () => {
    setMessage(null);
    setPending(null);
    try {
      const text = await pickBackupFile();
      if (text !== null) setPending(parseBackup(text));
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    }
  };

  const apply = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const skipped = pending.skipped ? ` ${pending.skipped} unreadable habit(s) were skipped.` : '';
    if (mode === 'replace') {
      replaceHabits(pending.habits);
      setMessage({ text: `Replaced your habits with ${pending.habits.length} from the file.${skipped}`, error: false });
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
        Export all {habits.length} habit{habits.length === 1 ? '' : 's'} (settings and full history) to a JSON file,
        and import it later on any device. No account needed.
      </Text>
      <View style={styles.buttons}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button theme={theme} icon="download-outline" label="Export JSON" variant="outline" onPress={onExport} />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button theme={theme} icon="push-outline" label="Import JSON" variant="outline" onPress={onImport} />
        </View>
      </View>

      {pending ? (
        <View style={[styles.importBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
          <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 4 }}>
            Found {pending.habits.length} habit{pending.habits.length === 1 ? '' : 's'}
            {pending.exportedAt ? ` (exported ${formatTime(pending.exportedAt)})` : ''}
          </Text>
          <Text style={{ color: theme.subtext, marginBottom: 12 }} numberOfLines={3}>
            {pending.habits.map((h) => `${h.emoji ? `${h.emoji} ` : ''}${h.name}`).join(', ') || 'No habits in this file.'}
            {pending.skipped ? `
${pending.skipped} unreadable habit(s) will be skipped.` : ''}
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
            Merge keeps your current habits, adds new ones from the file and combines the history of habits that exist
            in both. Replace removes the {habits.length} habit{habits.length === 1 ? '' : 's'} on this device first.
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

function NotConfigured({ theme }: { theme: Theme }) {
  return (
    <View style={[screenStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[screenStyles.sectionTitle, { color: theme.subtext }]}>Cloud backup</Text>
      <Text style={{ color: theme.text, lineHeight: 20 }}>
        Cloud sign-in isn’t set up yet. Create a free Supabase project, run{' '}
        <Text style={styles.code}>supabase/schema.sql</Text> in its SQL editor, then copy{' '}
        <Text style={styles.code}>.env.example</Text> to <Text style={styles.code}>.env</Text> with your project URL and
        key and restart the app. The README has the steps.
      </Text>
    </View>
  );
}

function LoginForm({ theme }: { theme: Theme }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  const submit = async () => {
    if (!supabase || !canSubmit) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
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

function CloudBackup({ theme, session }: { theme: Theme; session: Session }) {
  const { habits, replaceHabits } = useStore();
  const userId = session.user.id;
  const [cloud, setCloud] = useState<{ habits: Habit[]; updatedAt: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);
  const [confirm, setConfirm] = useState<'save' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const refresh = useCallback(() => {
    downloadHabits(userId)
      .then(setCloud)
      .catch((e) => {
        setCloud(null);
        setMessage({ text: errorText(e), error: true });
      });
  }, [userId]);

  useEffect(refresh, [refresh]);

  const save = async () => {
    // Overwriting an existing backup needs a second tap.
    if (cloud && confirm !== 'save') return setConfirm('save');
    setConfirm(null);
    setBusy('save');
    setMessage(null);
    try {
      const updatedAt = await uploadHabits(userId, habits);
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
        <Pressable onPress={() => supabase?.auth.signOut()} hitSlop={8}>
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
  code: { fontFamily: 'monospace', fontSize: 13 },
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
