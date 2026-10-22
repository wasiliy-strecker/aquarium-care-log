import { Stack, router } from 'expo-router';
import {
  ThemeProvider as NavigationThemeProvider,
  DefaultTheme,
  DarkTheme,
} from 'expo-router/react-navigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { ServicesProvider } from '../core/composition';
import { ThemeProvider, useTheme } from '../core/ui/theme';
import { FeedbackProvider } from '../core/ui/feedback';
import { IconButton } from '../core/ui/components';
import { StartupProvider, useStartup } from '../core/startup/startup';
function Routes() {
  const { pending } = useStartup();
  const c = useTheme(),
    safe = useSafeAreaInsets();
  const theme = c.dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...theme,
        colors: {
          ...theme.colors,
          background: c.background,
          card: c.background,
          text: c.ink,
          primary: c.primary,
          border: c.border,
        },
      }}
    >
      <StatusBar style={pending || c.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: c.background },
          // Android duration: 200 ms via resources in with-aquarium-android.
          animation: 'slide_from_right',
          header: ({ options, back, route }) => (
            <View
              style={{ paddingTop: safe.top, backgroundColor: c.background }}
            >
              <View
                style={{
                  height: 56,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: back ? 4 : 16,
                  paddingRight: 4,
                  gap: 4,
                }}
              >
                {!!back && (
                  <IconButton
                    icon="arrow_back"
                    label="Zurück"
                    onPress={() => {
                      if (router.canGoBack()) router.back();
                      else router.replace('/');
                    }}
                  />
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: 'Roboto',
                    fontSize: 22,
                    color: c.ink,
                    flex: 1,
                    marginLeft: back ? 16 : 0,
                  }}
                >
                  {options.title ?? 'AquariumLog'}
                </Text>
                {options.headerRight?.({ tintColor: c.ink, canGoBack: !!back })}
                {route.name === 'index' && (
                  <IconButton
                    icon="settings_outlined"
                    label="Einstellungen"
                    onPress={() => router.push('/settings')}
                  />
                )}
              </View>
            </View>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'AquariumLog' }} />
        <Stack.Screen name="aquarium/[id]" options={{ title: 'Aquarium' }} />
        <Stack.Screen
          name="aquarium/edit"
          options={{ title: 'Aquarium anlegen' }}
        />
        <Stack.Screen
          name="aquarium/history"
          options={{ title: 'Pflegeverlauf' }}
        />
        <Stack.Screen
          name="entry/edit"
          options={{ title: 'Eintrag erfassen' }}
        />
        <Stack.Screen name="entry/[id]" options={{ title: 'Eintrag' }} />
        <Stack.Screen
          name="pdf/[id]"
          options={{ title: 'Aquariumpflegeprotokoll' }}
        />
        <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StartupProvider>
          <ThemeProvider>
            <FeedbackProvider>
              <ServicesProvider>
                <Routes />
              </ServicesProvider>
            </FeedbackProvider>
          </ThemeProvider>
        </StartupProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
