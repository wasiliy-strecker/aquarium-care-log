import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Field, useTheme } from './components';
import { useScrollHost } from './scroll-host';
import { usePageOverlay } from './page-overlay';
import { suggestionGap, suggestionLayout } from './suggestion-layout';

type Placement = {
  list: ViewStyle;
  field: { left: number; top: number; width: number; height: number };
};

export function SuggestionField({
  label,
  placeholder,
  helper,
  helperStyle,
  value,
  suggestions,
  onChange,
  onOpenChange,
  disabled = false,
  autoFocus = false,
  showAllOnFocus = false,
  error,
}: {
  label: string;
  placeholder?: string;
  helper: string;
  helperStyle?: StyleProp<TextStyle>;
  value: string;
  suggestions: string[];
  onChange(value: string): void;
  onOpenChange?(open: boolean): void;
  disabled?: boolean;
  autoFocus?: boolean;
  showAllOnFocus?: boolean;
  error?: string;
}) {
  const c = useTheme();
  const host = useScrollHost();
  const overlay = usePageOverlay();
  const [owner] = useState(() => Symbol('suggestions'));
  const { height, width, fontScale } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const anchor = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const [editedSinceFocus, setEditedSinceFocus] = useState(false);
  const [fieldHeight, setFieldHeight] = useState(56);
  const [layout, setLayout] = useState<Placement | null>(null);
  const query =
    showAllOnFocus && !editedSinceFocus
      ? ''
      : value.trim().toLocaleLowerCase('de-DE');
  const options = suggestions.filter((s) =>
    s.toLocaleLowerCase('de-DE').includes(query),
  );
  const desiredHeight = Math.min(
    220,
    options.length * Math.max(48, 28 + 24 * fontScale) + 2,
  );
  const open = focused && !disabled && !!options.length;
  useLayoutEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [onOpenChange, open]);
  const close = useCallback(() => {
    setFocused(false);
    Keyboard.dismiss();
  }, []);
  useLayoutEffect(() => {
    if (!focused || disabled || !options.length) return;
    let active = true;
    let frame = 0;
    let sequence = 0;
    let keyboardTop = Keyboard.metrics()?.screenY;
    function measure() {
      cancelAnimationFrame(frame);
      const request = ++sequence;
      frame = requestAnimationFrame(() => {
        anchor.current?.measureInWindow(
          (left, top, fieldWidth, measuredHeight) => {
            function place(pageTop: number, pageHeight: number) {
              if (!active || request !== sequence) return;
              const placement = suggestionLayout(
                { top, height: measuredHeight },
                {
                  top: Math.max(safe.top, pageTop),
                  bottom: Math.min(
                    height - safe.bottom,
                    pageTop + pageHeight,
                    keyboardTop ?? Infinity,
                  ),
                },
                desiredHeight,
              );
              overlay.ref.current?.measureInWindow(
                (x, y, _width, overlayHeight) => {
                  if (!active || request !== sequence) return;
                  setLayout({
                    field: {
                      left: left - x,
                      top: top - y,
                      width: fieldWidth,
                      height: measuredHeight,
                    },
                    list: {
                      left: left - x,
                      width: fieldWidth,
                      maxHeight: placement.maxHeight,
                      ...(placement.above
                        ? { bottom: y + overlayHeight - top + suggestionGap }
                        : { top: top + measuredHeight - y + suggestionGap }),
                    },
                  });
                },
              );
            }
            const page = host?.ref.current?.getNativeScrollRef();
            if (page)
              page.measureInWindow((_, pageTop, _width, pageHeight) =>
                place(pageTop, pageHeight),
              );
            else place(safe.top, height - safe.top - safe.bottom);
          },
        );
      });
    }
    function keyboardChanged(event: KeyboardEvent) {
      keyboardTop = event.endCoordinates.screenY;
      measure();
    }
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', keyboardChanged),
      Keyboard.addListener('keyboardDidChangeFrame', keyboardChanged),
      // Android Back can hide the keyboard while leaving the input focused.
      // Blur it as well so the next tap can reopen the suggestions normally.
      Keyboard.addListener('keyboardDidHide', close),
      BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      }),
    ];
    const unsubscribe = host?.subscribe(measure);
    measure();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      subscriptions.forEach((subscription) => subscription.remove());
      unsubscribe?.();
    };
  }, [
    focused,
    disabled,
    options.length,
    desiredHeight,
    fieldHeight,
    height,
    width,
    safe.top,
    safe.bottom,
    host,
    overlay,
    close,
  ]);
  useLayoutEffect(() => {
    if (!open || !layout?.list.maxHeight) return;
    // Consume outside taps without covering the input itself. The list, drawn
    // last, receives its own gestures independently from the form ScrollView.
    const field = layout.field;
    const outside: ViewStyle[] = [
      { top: 0, left: 0, right: 0, height: Math.max(0, field.top) },
      { top: field.top + field.height, left: 0, right: 0, bottom: 0 },
      {
        top: field.top,
        left: 0,
        width: Math.max(0, field.left),
        height: field.height,
      },
      {
        top: field.top,
        left: field.left + field.width,
        right: 0,
        height: field.height,
      },
    ];
    overlay.show(
      owner,
      <>
        {outside.map((region, index) => (
          <Pressable
            key={index}
            accessible={false}
            onPress={close}
            style={{ position: 'absolute', ...region }}
          />
        ))}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{
            ...layout.list,
            position: 'absolute',
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            backgroundColor: c.card,
            elevation: 8,
          }}
        >
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: option === value }}
              onPress={() => {
                onChange(option);
                close();
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 16,
                paddingVertical: 14,
                minHeight: 48,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Body style={{ fontSize: 16, lineHeight: 24 }}>{option}</Body>
            </Pressable>
          ))}
        </ScrollView>
      </>,
    );
    return () => overlay.hide(owner);
  }, [
    open,
    options,
    layout,
    overlay,
    owner,
    onChange,
    close,
    value,
    c.border,
    c.card,
  ]);
  return (
    <View style={{ zIndex: focused ? 20 : 0, gap: 4 }}>
      <View
        ref={anchor}
        collapsable={false}
        onLayout={(e) => setFieldHeight(e.nativeEvent.layout.height)}
      >
        <Field
          label={label}
          error={error}
          value={value}
          onChangeText={(text) => {
            setEditedSinceFocus(true);
            onChange(text);
          }}
          editable={!disabled}
          autoFocus={autoFocus}
          autoCapitalize="sentences"
          returnKeyType="done"
          placeholder={placeholder}
          onFocus={() => {
            setLayout(null);
            setEditedSinceFocus(false);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={close}
        />
      </View>
      <Body
        muted
        style={[{ paddingHorizontal: 16, fontSize: 12 }, helperStyle]}
      >
        {helper}
      </Body>
    </View>
  );
}
