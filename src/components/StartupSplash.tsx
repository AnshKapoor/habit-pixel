import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, useWindowDimensions } from 'react-native';

/** How long the logo stays on screen when the app starts (native splash + this overlay). */
const SHOW_MS = 2500;
const FADE_MS = 350;

const native = Platform.OS !== 'web';

// Keep the native splash up until the overlay below has drawn, so there is no flash in between.
if (native) SplashScreen.preventAutoHideAsync().catch(() => {});

function hideNativeSplash() {
  if (native) SplashScreen.hideAsync().catch(() => {});
}

/**
 * Full Habit Pixel logo (artwork + wordmark) shown over the app for a couple of seconds at startup.
 * On Android/iOS the native splash (which can only show a small icon on Android 12+) hands over to
 * this overlay; on web it is the whole splash screen.
 */
export function StartupSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (gone) return;
    const t = setTimeout(() => {
      setMinTimePassed(true);
      // Safety net in case the logo image never reports loading.
      hideNativeSplash();
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [gone]);

  useEffect(() => {
    if (gone || !minTimePassed || !ready) return;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: native }).start(() => setGone(true));
  }, [gone, minTimePassed, ready, opacity]);

  if (gone) return null;
  const size = Math.min(width * 0.78, height * 0.5, 420);

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onLoadEnd={hideNativeSplash}
        accessibilityLabel="Habit Pixel"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
});
