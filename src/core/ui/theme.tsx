import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { StartupError, StartupPending } from '../startup/startup';
export const light = {
  background: '#F2F7F7',
  card: '#FFFFFF',
  input: '#E8F1F2',
  ink: '#15282C',
  muted: '#40575D',
  primary: '#176B75',
  onPrimary: '#FFFFFF',
  soft: '#C6EEF0',
  onSoft: '#00505A',
  secondaryContainer: '#D7E8EA',
  onSecondaryContainer: '#354F55',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  border: '#BDD2D6',
  outline: '#687F85',
  danger: '#BA1A1A',
  onDanger: '#FFFFFF',
  elevated: '#E3EFF0',
  disabled: '#D2DEE0',
  destructive: '#BA1A1A',
  onDestructive: '#FFFFFF',
  destructiveContainer: '#FFDAD6',
  selection: '#176B7540',
  dark: false,
};
export const dark: typeof light = {
  background: '#101D21',
  card: '#1B2E33',
  input: '#0C181C',
  ink: '#DFEBED',
  muted: '#B6CDD2',
  primary: '#7FD3D8',
  onPrimary: '#00383E',
  soft: '#00505A',
  onSoft: '#C6EEF0',
  secondaryContainer: '#354F55',
  onSecondaryContainer: '#D7E8EA',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  border: '#3C565D',
  outline: '#879EA4',
  danger: '#FF5449',
  onDanger: '#690005',
  elevated: '#263D43',
  disabled: '#2D4147',
  destructive: '#FF5449',
  onDestructive: '#210000',
  destructiveContainer: '#690005',
  selection: '#7FD3D840',
  dark: true,
};
const ThemeContext = createContext(light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <FontThemeProvider key={attempt} retry={() => setAttempt((n) => n + 1)}>
      {children}
    </FontThemeProvider>
  );
}
function FontThemeProvider({
  children,
  retry,
}: {
  children: ReactNode;
  retry(): void;
}) {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    Roboto: require('../../../assets/ui/Roboto-Regular.ttf'),
    RobotoMedium: require('../../../assets/ui/Roboto-Medium.ttf'),
    RobotoBold: require('../../../assets/ui/Roboto-Bold.ttf'),
    RobotoBlack: require('../../../assets/ui/Roboto-Black.ttf'),
    MaterialIcons: require('../../../assets/ui/MaterialIcons-Regular.otf'),
  });
  if (error)
    return (
      <StartupError
        message="Die Schriftarten konnten nicht geladen werden."
        retry={retry}
      />
    );
  if (!loaded) return <StartupPending />;
  return (
    <ThemeContext.Provider value={scheme === 'dark' ? dark : light}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
