import { Text } from 'react-native';
import icons from './icons.json';
import { useTheme } from './theme';
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={{
        fontFamily: 'MaterialIcons',
        fontSize: size,
        lineHeight: size,
        color: color ?? theme.ink,
      }}
    >
      {String.fromCodePoint(icons[name])}
    </Text>
  );
}
