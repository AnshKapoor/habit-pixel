import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { connectCloud, disconnectCloud, type CloudConfig } from '../cloud';
import { SCHEMA_SQL } from '../schemaSql';
import type { Theme } from '../theme';
import { Sheet } from './Sheet';

/** Text-style button that opens the setup FAQ. */
export function HelpLink({ theme, onPress, label = 'How to set up' }: { theme: Theme; onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.helpLink} accessibilityRole="link">
      <Ionicons name="help-circle-outline" size={18} color={theme.accent} />
      <Text style={{ color: theme.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Enter (or change) the Supabase project URL and key. */
export function ConnectSheet({
  visible,
  theme,
  current,
  onClose,
  onHelp,
}: {
  visible: boolean;
  theme: Theme;
  current: CloudConfig | null;
  onClose: () => void;
  onHelp: () => void;
}) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Refill the form each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setUrl(current?.url ?? '');
      setKey(current?.key ?? '');
      setError(null);
      setConfirmDisconnect(false);
    }
  }

  const canSubmit = url.trim().length > 0 && key.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await connectCloud({ url, key });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirmDisconnect) return setConfirmDisconnect(true);
    await disconnectCloud();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} theme={theme}>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: theme.text }]}>{current ? 'Cloud connection' : 'Connect cloud backup'}</Text>
        <Text style={{ color: theme.subtext, lineHeight: 20 }}>
          Paste the URL and anon / publishable key of your Supabase project. They are stored only on this device.
        </Text>

        <Text style={[styles.label, { color: theme.subtext }]}>Project URL</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://abcd1234.supabase.co"
          placeholderTextColor={theme.subtext}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <Text style={[styles.label, { color: theme.subtext }]}>Anon / publishable key</Text>
        <TextInput
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="sb_publishable_… or eyJhbGci…"
          placeholderTextColor={theme.subtext}
          multiline
          style={[styles.input, styles.keyInput, { color: theme.text, borderColor: theme.border }]}
        />

        {error ? <Text style={[styles.msg, { color: theme.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.primary, { backgroundColor: theme.accent, opacity: canSubmit ? 1 : 0.45 }]}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="link" size={18} color="#fff" />}
          <Text style={styles.primaryText}>{busy ? 'Checking…' : current ? 'Save connection' : 'Connect'}</Text>
        </Pressable>

        <View style={styles.footer}>
          <HelpLink theme={theme} onPress={onHelp} label="Where do I find these?" />
          <Pressable onPress={onClose}>
            <Text style={{ color: theme.subtext, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
        {current ? (
          <Pressable onPress={disconnect} style={{ marginTop: 18, alignSelf: 'flex-start' }}>
            <Text style={{ color: theme.danger, fontWeight: '600' }}>
              {confirmDisconnect ? 'Tap again to disconnect and sign out' : 'Disconnect this project'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

interface Faq {
  q: string;
  a: (theme: Theme) => ReactNode;
}

const FAQS: Faq[] = [
  {
    q: 'What is cloud backup?',
    a: () =>
      'Your habits are saved to a free Supabase project that you own. Sign in with the same email on another phone or the web app to restore them. Each account keeps one backup, replaced on every save. Your data never goes anywhere else.',
  },
  {
    q: 'Step 1 — Create a free Supabase project',
    a: (theme) => (
      <P theme={theme}>
        Go to{' '}
        <Text style={{ color: theme.accent, fontWeight: '600' }} onPress={() => Linking.openURL('https://supabase.com/dashboard')}>
          supabase.com/dashboard
        </Text>
        , sign up and click <B>New project</B>. Any name, password and region will do. Wait a minute while it starts.
      </P>
    ),
  },
  {
    q: 'Step 2 — Create the backup table',
    a: (theme) => <SqlStep theme={theme} />,
  },
  {
    q: 'Step 3 — Copy the URL and key',
    a: (theme) => (
      <P theme={theme}>
        In your project click <B>Connect</B> at the top (or open <B>Project Settings → API Keys</B>). Copy the{' '}
        <B>Project URL</B> and the <B>anon</B> or <B>publishable</B> key, then tap <B>Connect cloud</B> in the app and
        paste them.
      </P>
    ),
  },
  {
    q: 'Step 4 — Create an account and save',
    a: (theme) => (
      <P theme={theme}>
        After connecting, choose <B>Create account</B>, enter your email and a password, then tap{' '}
        <B>Save to cloud</B>. On another device, connect the same project, sign in and tap <B>Restore from cloud</B>.
      </P>
    ),
  },
  {
    q: 'Which key should I never use?',
    a: (theme) => (
      <P theme={theme}>
        The <B>service_role</B> / <B>secret</B> key. It bypasses all access rules, so it must never be put in an app.
        Habit Pixel refuses it. The anon / publishable key is safe because the table only lets each signed-in user see
        their own backup.
      </P>
    ),
  },
  {
    q: 'I never got the confirmation email',
    a: (theme) => (
      <P theme={theme}>
        Supabase asks new users to confirm their email. Check spam, or turn it off under{' '}
        <B>Authentication → Sign In / Providers → Email → Confirm email</B> and sign up again.
      </P>
    ),
  },
  {
    q: 'It says the habit_backups table is missing',
    a: () => 'Step 2 has not been run in this project yet. Run the SQL there, then try connecting again.',
  },
];

function P({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <Text style={{ color: theme.text, lineHeight: 20 }}>{children}</Text>;
}

function B({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: '700' }}>{children}</Text>;
}

function SqlStep({ theme }: { theme: Theme }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View>
      <Text style={{ color: theme.text, lineHeight: 20 }}>
        In the project open <B>SQL Editor → New query</B>, paste the SQL below and click <B>Run</B>. It creates a{' '}
        <B>habit_backups</B> table where each user can only read and change their own row.
      </Text>
      <Pressable
        onPress={copy}
        style={[styles.copyBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        accessibilityLabel="Copy setup SQL"
      >
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={theme.accent} />
        <Text style={{ color: theme.accent, fontWeight: '600' }}>{copied ? 'Copied' : 'Copy SQL'}</Text>
      </Pressable>
      <ScrollView horizontal style={[styles.codeBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Text selectable style={[styles.code, { color: theme.text }]}>
          {SCHEMA_SQL}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Step-by-step setup guide as an expandable FAQ. */
export function FaqSheet({ visible, theme, onClose }: { visible: boolean; theme: Theme; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(1);

  return (
    <Sheet visible={visible} onClose={onClose} theme={theme}>
      <Text style={[styles.heading, { color: theme.text }]}>Cloud backup — FAQ</Text>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
        {FAQS.map((f, i) => {
          const expanded = open === i;
          const body = f.a(theme);
          return (
            <View key={f.q} style={[styles.faqItem, { borderColor: theme.border }]}>
              <Pressable
                onPress={() => setOpen(expanded ? null : i)}
                style={styles.faqQ}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <Text style={[styles.faqQText, { color: theme.text }]}>{f.q}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.subtext} />
              </Pressable>
              {expanded ? (
                <View style={[styles.faqA, { backgroundColor: theme.bg }]}>
                  {typeof body === 'string' ? <P theme={theme}>{body}</P> : body}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <Pressable onPress={onClose} style={{ alignSelf: 'flex-end', marginTop: 14 }}>
        <Text style={{ color: theme.subtext, fontWeight: '600' }}>Close</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  keyInput: { minHeight: 64, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 13 },
  msg: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  primary: {
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  helpLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  faqItem: { borderBottomWidth: StyleSheet.hairlineWidth },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  faqQText: { flex: 1, fontSize: 15, fontWeight: '600' },
  faqA: { borderRadius: 10, padding: 12, marginBottom: 12 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  codeBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  code: { fontFamily: 'monospace', fontSize: 11, lineHeight: 15 },
});
