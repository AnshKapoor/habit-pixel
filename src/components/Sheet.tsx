import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Theme } from '../theme';

const WIDE = 600;

/** Bottom sheet on phones, centred dialog on wide screens (web). */
export function Sheet({
  visible,
  onClose,
  theme,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.wrap, { height, justifyContent: wide ? 'center' : 'flex-end', padding: wide ? 24 : 0 }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            wide ? styles.dialog : styles.bottom,
            // A pixel cap (not a percentage) so the content scrolls instead of overflowing the screen.
            { maxHeight: height * (wide ? 0.9 : 0.92), backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    overflow: 'hidden',
  },
  bottom: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  dialog: { borderRadius: 20 },
});
