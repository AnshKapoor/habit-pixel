import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE;

  return (
    // Draw under the status and navigation bars on Android (edge-to-edge) and pad for them ourselves,
    // so the bottom of the sheet is never hidden behind the gesture / button bar.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.wrap, { justifyContent: wide ? 'center' : 'flex-end', padding: wide ? 24 : 0 }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            wide ? styles.dialog : styles.bottom,
            // A pixel cap (not a percentage) so the content scrolls instead of overflowing the screen.
            {
              maxHeight: wide ? height * 0.9 : height - insets.top - 24,
              paddingBottom: wide ? 20 : 20 + insets.bottom,
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', alignItems: 'center' },
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
