import { StyleSheet } from 'react-native';

export const screenStyles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { marginBottom: 16, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
