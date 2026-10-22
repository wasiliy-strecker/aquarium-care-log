import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './icon';
import { useTheme } from './theme';

type DialogAction = {
  label: string;
  onPress(): void;
  filled?: boolean;
  outlined?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: IconName;
};

export function DialogActions({
  actions,
  stacked = false,
}: {
  actions: DialogAction[];
  stacked?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: stacked ? 'column' : 'row',
        flexWrap: stacked ? 'nowrap' : 'wrap',
        justifyContent: 'flex-end',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? 12 : 8,
        paddingTop: stacked ? 8 : 0,
      }}
    >
      {actions.map((action) => {
        const color = action.disabled
          ? c.ink + '61'
          : action.filled
            ? action.danger
              ? c.onDestructive
              : c.onPrimary
            : action.danger
              ? c.destructive
              : c.primary;
        return (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: action.disabled }}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }) => ({
              minHeight: 56,
              maxWidth: '100%',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 40,
              borderWidth: action.outlined ? 1 : 0,
              borderColor: action.disabled
                ? c.ink + '1F'
                : action.danger
                  ? c.destructive
                  : c.primary,
              backgroundColor: action.filled
                ? action.disabled
                  ? c.disabled
                  : action.danger
                    ? c.destructiveContainer
                    : c.primary
                : 'transparent',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              overflow: 'hidden',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {action.icon && <Icon name={action.icon} color={color} size={22} />}
            <Text
              style={{
                fontFamily: 'RobotoMedium',
                fontSize: 16,
                fontWeight: '600',
                lineHeight: 20,
                color,
                textAlign: 'center',
                flexShrink: 1,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
