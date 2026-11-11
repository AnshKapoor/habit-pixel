import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a missing vibrator or an unsupported browser surface as an error.
const ignore = () => {};

/** A light tap, e.g. after logging an entry. */
export function tapHaptic(): void {
  if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(ignore);
  else if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

/** A stronger confirmation, e.g. when an entry reaches the target and extends the streak. */
export function successHaptic(): void {
  if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(ignore);
  else if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}
