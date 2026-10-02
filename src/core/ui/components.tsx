import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollContext } from './scroll-host';
import { useMaterialDateTime } from './material-date-time';
import { localDate } from './date-time-model';
import { light, useTheme } from './theme';
import { Icon, type IconName } from './icon';
import { useFeedback, type MenuAnchor } from './feedback';
import { useIsFocused } from 'expo-router/react-navigation';
import { useStartupLayout } from '../startup/startup';
export { useTheme } from './theme';
export const colors = light;
export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Roboto',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  subtitle: { fontFamily: 'Roboto', fontSize: 14, lineHeight: 20 },
  label: { fontFamily: 'RobotoMedium', fontSize: 14 },
});
export function Page({
  children,
  fab,
  bottom,
  top,
  scroll = true,
  ready = true,
}: {
  children: ReactNode;
  nested?: boolean;
  fab?: ReactNode;
  bottom?: ReactNode;
  top?: ReactNode;
  scroll?: boolean;
  /** Initial route data has settled. Later navigation never reopens the splash. */
  ready?: boolean;
}) {
  const focused = useIsFocused();
  const c = useTheme(),
    safe = useSafeAreaInsets();
  const onStartupLayout = useStartupLayout(ready && focused, c.background);
  const { fontScale } = useWindowDimensions();
  const Component = ScrollView;
  const ref = useRef<ScrollView>(null),
    offset = useRef(0),
    height = useRef(0),
    content = useRef(0);
  const host = useMemo(() => ({ ref, offset, height, content }), []);
  return (
    <ScrollContext.Provider value={host}>
      <KeyboardAvoidingView
        onLayout={onStartupLayout}
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {top}
        {scroll ? (
          <Component
            ref={ref}
            onScroll={(e) => {
              offset.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onLayout={(e) => {
              height.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={(_, h) => {
              content.current = h;
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: fab
                ? Math.max(112, 56 * fontScale + 48) + safe.bottom
                : bottom
                  ? 24
                  : safe.bottom + 32,
              gap: 12,
              width: '100%',
              maxWidth: 800,
              alignSelf: 'center',
              flexGrow: 1,
            }}
          >
            {children}
          </Component>
        ) : (
          children
        )}
        {!!fab && (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              right: 16,
              bottom: safe.bottom + 16,
              left: 16,
              alignItems: 'flex-end',
            }}
          >
            {fab}
          </View>
        )}
        {!!bottom && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: safe.bottom + 16,
              backgroundColor: c.background,
              gap: 12,
            }}
          >
            {bottom}
          </View>
        )}
      </KeyboardAvoidingView>
    </ScrollContext.Provider>
  );
}
export function Body({
  children,
  muted = false,
  style,
  strong = false,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  strong?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      style={[
        styles.text,
        {
          color: muted ? c.muted : c.ink,
          fontFamily: strong ? 'RobotoBold' : 'Roboto',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: 'RobotoBlack',
          fontSize: 24,
          lineHeight: 32,
          color: c.ink,
        }}
      >
        {children}
      </Text>
      {!!subtitle && <Body muted>{subtitle}</Body>}
    </View>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: 'RobotoBold',
        fontSize: 22,
        lineHeight: 28,
        color: c.ink,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const s: StyleProp<ViewStyle> = [
    {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 16,
      gap: 12,
      overflow: 'hidden',
    },
    style,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  color,
  menu = false,
}: {
  icon: IconName;
  label: string;
  onPress(anchor?: MenuAnchor): void;
  disabled?: boolean;
  color?: string;
  menu?: boolean;
}) {
  const c = useTheme();
  const anchor = useRef<View>(null);
  return (
    <Pressable
      ref={anchor}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={() =>
        menu
          ? anchor.current?.measureInWindow((x, y, width, height) =>
              onPress({ x, y, width, height }),
            )
          : onPress()
      }
      disabled={disabled}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.38 : pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} color={color ?? c.ink} />
    </Pressable>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  testID,
  icon,
  textOnly = false,
  menu = false,
}: {
  title: string;
  onPress(anchor?: MenuAnchor): void;
  menu?: boolean;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: IconName;
  textOnly?: boolean;
}) {
  const c = useTheme();
  const anchor = useRef<View>(null);
  const foreground = disabled
    ? c.ink + '61'
    : secondary || textOnly
      ? danger
        ? c.danger
        : c.primary
      : danger
        ? '#FFFFFF'
        : c.onPrimary;
  return (
    <Pressable
      ref={anchor}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() =>
        menu
          ? anchor.current?.measureInWindow((x, y, width, height) =>
              onPress({ x, y, width, height }),
            )
          : onPress()
      }
      style={({ pressed }) => ({
        minHeight: 56,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 40,
        borderWidth: secondary ? 1 : 0,
        borderColor: disabled ? c.ink + '1F' : danger ? c.danger : c.outline,
        backgroundColor:
          secondary || textOnly
            ? 'transparent'
            : disabled
              ? c.disabled
              : danger
                ? c.danger
                : c.primary,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: pressed ? 0.8 : 1,
        overflow: 'hidden',
        flexShrink: 1,
      })}
    >
      {!!icon && <Icon name={icon} size={22} color={foreground} />}
      <Text
        style={{
          fontFamily: 'RobotoMedium',
          fontWeight: '600',
          fontSize: 16,
          lineHeight: 20,
          color: foreground,
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Fab({
  title,
  icon = 'add',
  onPress,
}: {
  title: string;
  icon?: IconName;
  onPress(): void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.soft,
        minHeight: 56,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        maxWidth: '100%',
        elevation: 1,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} color={c.onSoft} size={22} />
      <Text
        style={{
          fontFamily: 'RobotoMedium',
          fontWeight: '600',
          fontSize: 16,
          lineHeight: 20,
          color: c.onSoft,
          flexShrink: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function ActionRow({ children }: { children: ReactNode[] }) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: width < 352 || fontScale >= 1.5 ? 'column' : 'row',
        gap: 12,
      }}
    >
      {children.map((child, i) => (
        <View
          key={i}
          style={width < 352 || fontScale >= 1.5 ? undefined : { flex: 1 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
export function Field({
  label,
  leading,
  trailing,
  onTrailingPress,
  suffix,
  error,
  ...props
}: TextInputProps & {
  label: string;
  leading?: IconName;
  trailing?: IconName;
  onTrailingPress?: () => void;
  suffix?: string;
  error?: string;
}) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const floated = focused || !!props.value;
  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          borderWidth: focused ? 2 : 1,
          borderColor: error ? c.danger : focused ? c.primary : c.muted,
          borderRadius: 14,
          backgroundColor: c.input,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: props.multiline ? 'flex-start' : 'center',
        }}
      >
        {floated && (
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -10,
              left: 12,
              paddingHorizontal: 4,
              backgroundColor: c.background,
              color: error ? c.danger : focused ? c.primary : c.muted,
              fontFamily: 'Roboto',
              fontSize: 12,
              lineHeight: 18,
              zIndex: 2,
            }}
          >
            {label}
          </Text>
        )}
        {!!leading && (
          <View style={{ paddingLeft: 12, paddingRight: 4 }}>
            <Icon name={leading} color={c.muted} />
          </View>
        )}
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholder={
            focused ? props.placeholder : floated ? props.placeholder : label
          }
          placeholderTextColor={c.muted}
          selectionColor={c.primary}
          style={[
            {
              flex: 1,
              fontFamily: 'Roboto',
              fontSize: 16,
              letterSpacing: 0.5,
              color: c.ink,
              paddingHorizontal: 16,
              paddingVertical: 16,
              minHeight: 54,
            },
            props.multiline && { minHeight: 100, textAlignVertical: 'top' },
            props.style,
          ]}
        />
        {!!suffix && (
          <Body muted style={{ marginRight: 16 }}>
            {suffix}
          </Body>
        )}
        {!!trailing && (
          <IconButton
            icon={trailing}
            label={label + ' auswählen'}
            onPress={onTrailingPress ?? (() => {})}
            disabled={props.editable === false}
          />
        )}
      </View>
      {!!error && (
        <Body style={{ fontSize: 12, color: c.danger, paddingHorizontal: 16 }}>
          {error}
        </Body>
      )}
    </View>
  );
}
export function SelectField({
  label,
  value,
  options,
  onChange,
  icon,
  disabled = false,
}: {
  label: string;
  value: string;
  options: (string | { label: string; value: string })[];
  onChange(value: string): void;
  icon?: IconName;
  disabled?: boolean;
}) {
  const c = useTheme(),
    feedback = useFeedback();
  const anchor = useRef<View>(null);
  const normalized = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );
  async function open(position: MenuAnchor) {
    const choice = await feedback.choose({
      title: label,
      anchor: position,
      options: normalized.map((o) => ({
        ...o,
        icon: o.value === value ? 'check' : undefined,
      })),
    });
    if (choice !== null) onChange(choice);
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      ref={anchor}
      accessibilityValue={{ text: value }}
      disabled={disabled}
      onPress={() =>
        anchor.current?.measureInWindow(
          (x, y, width, height) => void open({ x, y, width, height }),
        )
      }
      style={{
        minHeight: 56,
        borderWidth: 1,
        borderColor: c.muted,
        borderRadius: 14,
        backgroundColor: c.input,
        paddingLeft: 16,
        paddingRight: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          position: 'absolute',
          top: -10,
          left: 12,
          paddingHorizontal: 4,
          backgroundColor: c.background,
          color: c.muted,
          fontFamily: 'Roboto',
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {label}
      </Text>
      {!!icon && <Icon name={icon} color={c.muted} />}
      <Text
        style={{
          fontFamily: 'Roboto',
          fontSize: 16,
          letterSpacing: 0.5,
          color: c.ink,
          flex: 1,
        }}
      >
        {normalized.find((o) => o.value === value)?.label ?? value}
      </Text>
      <Icon name="arrow_drop_down" color={c.muted} />
    </Pressable>
  );
}
export function Choices({
  values,
  selected,
  onSelect,
}: {
  values: string[];
  selected?: string;
  onSelect(v: string): void;
}) {
  return (
    <SelectField
      label="Auswählen"
      value={selected ?? ''}
      options={values}
      onChange={onSelect}
    />
  );
}
export function DateField({
  label,
  value,
  onChange,
  time = false,
  optional = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  time?: boolean;
  optional?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme(),
    picker = useMaterialDateTime();
  const date = value ? localDate(value) : new Date();
  async function pick() {
    const next = await picker.date(
      date,
      optional
        ? {
            first: new Date(1800, 0, 1),
            last: new Date(2100, 11, 31),
            yearFirst: true,
            calendarOnly: true,
            title: 'Einbau / Anschaffung wählen',
          }
        : undefined,
    );
    if (!next) return;
    if (time) {
      next.setHours(date.getHours(), date.getMinutes());
      const timed = await picker.time(next);
      if (timed) onChange(timed.toISOString());
    } else
      onChange(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
      );
  }
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.muted,
        borderRadius: 14,
        backgroundColor: c.input,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
      }}
    >
      {picker.dialog}
      <Text
        style={{
          position: 'absolute',
          top: -10,
          left: 12,
          paddingHorizontal: 4,
          backgroundColor: c.background,
          color: c.muted,
          fontFamily: 'Roboto',
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => void pick()}
        style={{ flex: 1, padding: 16 }}
      >
        <Text
          style={{
            fontFamily: 'Roboto',
            fontSize: 16,
            color: value ? c.ink : c.muted,
          }}
        >
          {value
            ? time
              ? date.toLocaleString('de-DE', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : date.toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
            : 'Datum auswählen'}
        </Text>
      </Pressable>
      {!!value && optional && (
        <IconButton
          icon="close"
          label="Datum entfernen"
          disabled={disabled}
          onPress={() => onChange('')}
        />
      )}
      <IconButton
        icon="calendar_today"
        label="Datum auswählen"
        disabled={disabled}
        onPress={() => void pick()}
      />
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text?: string;
  error?: boolean;
}) {
  const c = useTheme();
  return text ? (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: c.card,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <Icon
        name={error ? 'error_outline' : 'info_outline'}
        color={error ? c.danger : c.primary}
      />
      <Text
        accessibilityRole={error ? 'alert' : undefined}
        style={[styles.text, { color: error ? c.danger : c.muted, flex: 1 }]}
      >
        {text}
      </Text>
    </View>
  ) : null;
}
export function Busy({ label = 'Wird verarbeitet …' }: { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ padding: 20, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={c.primary} />
      <Body>{label}</Body>
    </View>
  );
}
export function BusyOverlay({
  visible,
  label,
}: {
  visible: boolean;
  label: string;
}) {
  const c = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: c.card,
            borderRadius: 28,
            padding: 24,
            width: '100%',
            maxWidth: 560,
            maxHeight: '85%',
            alignSelf: 'center',
          }}
        >
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ alignItems: 'center', gap: 20 }}
          >
            <ActivityIndicator color={c.primary} />
            <Body style={{ textAlign: 'center' }}>{label}</Body>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error)
    return 'Bitte die Pflichtfelder und das Format deiner Angaben prüfen.';
  return error instanceof Error
    ? error.message
    : 'Die Aktion konnte nicht abgeschlossen werden. Deine gespeicherten Daten bleiben erhalten.';
}

export function MaterialSwitch({
  value,
  onValueChange,
  disabled = false,
  label,
}: {
  value: boolean;
  onValueChange(value: boolean): void;
  disabled?: boolean;
  label: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{
        minWidth: 56,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: value ? c.primary : c.outline,
          backgroundColor: value ? c.primary : c.elevated,
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
          paddingHorizontal: value ? 2 : 6,
        }}
      >
        <View
          style={{
            width: value ? 24 : 16,
            height: value ? 24 : 16,
            borderRadius: 12,
            backgroundColor: value ? c.onPrimary : c.outline,
          }}
        />
      </View>
    </Pressable>
  );
}
