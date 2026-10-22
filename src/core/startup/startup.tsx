import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

export const startupColor = '#176B75';

// Run before any React rendering. Router must not dismiss the native surface
// as soon as navigation mounts, while fonts or the first query are still pending.
void SplashScreen.preventAutoHideAsync().catch(console.warn);
SplashScreen.setOptions({ duration: 180, fade: true });

const StartupContext = createContext({
  pending: true,
  holds: 0,
  hold: (): (() => void) => () => {},
  reveal: () => {},
});

export function StartupProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(true);
  const [holds, setHolds] = useState(0);
  const hold = useCallback(() => {
    setHolds((n) => n + 1);
    return () => setHolds((n) => n - 1);
  }, []);
  const reveal = useCallback(() => {
    setPending(false);
    SplashScreen.hide();
  }, []);
  const value = useMemo(
    () => ({ pending, holds, hold, reveal }),
    [pending, holds, hold, reveal],
  );
  return (
    <StartupContext.Provider value={value}>{children}</StartupContext.Provider>
  );
}

export function useStartup() {
  return useContext(StartupContext);
}

// Nested initial content (for example saved reports) can also hold the cover.
export function useStartupHold(loading: boolean) {
  const { pending, hold } = useStartup();
  useLayoutEffect(() => {
    if (pending && loading) return hold();
  }, [pending, loading, hold]);
}

// Called by the focused Page, or the bootstrap error view outside navigation.
// Readiness includes query errors so the splash never covers a recoverable error.
export function useStartupLayout(ready: boolean, background: string) {
  const { pending, holds, reveal } = useStartup();
  const [laidOut, setLaidOut] = useState(false);
  const onLayout = useCallback(() => setLaidOut(true), []);
  useEffect(() => {
    if (!pending || holds || !ready || !laidOut) return;
    let active = true;
    let frame = 0;
    void SystemUI.setBackgroundColorAsync(background)
      .catch(console.warn)
      .then(() => {
        if (!active) return;
        // Allow the ready render and header options to reach the native view
        // before removing its cover. No fixed minimum display time.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (active) reveal();
          });
        });
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [background, holds, laidOut, pending, ready, reveal]);
  return onLayout;
}

export function StartupPending() {
  return (
    <View
      accessible
      accessibilityLabel="AquariumLog wird gestartet"
      style={{
        flex: 1,
        backgroundColor: startupColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <StatusBar style="light" />
      <Image
        source={require('../../../assets/icon-foreground.png')}
        style={{ width: 256, height: 256 }}
        resizeMode="contain"
        accessible={false}
        fadeDuration={0}
      />
    </View>
  );
}

export function StartupError({
  message,
  retry,
}: {
  message: string;
  retry(): void;
}) {
  const onLayout = useStartupLayout(true, startupColor);
  return (
    <ScrollView
      onLayout={onLayout}
      style={{ flex: 1, backgroundColor: startupColor }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 32,
        gap: 24,
      }}
    >
      <StatusBar style="light" />
      <Text
        accessibilityRole="alert"
        style={{ color: '#FFFFFF', fontSize: 18 }}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{
          minHeight: 56,
          padding: 16,
          borderRadius: 28,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{ color: startupColor, fontSize: 16, textAlign: 'center' }}
        >
          Erneut versuchen
        </Text>
      </Pressable>
    </ScrollView>
  );
}
