import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Body, Field, useTheme } from './components';

export function SuggestionField({
  label,
  placeholder,
  helper,
  helperStyle,
  value,
  suggestions,
  onChange,
  disabled = false,
  autoFocus = false,
  showAllOnFocus = false,
}: {
  label: string;
  placeholder?: string;
  helper: string;
  helperStyle?: StyleProp<TextStyle>;
  value: string;
  suggestions: string[];
  onChange(value: string): void;
  disabled?: boolean;
  autoFocus?: boolean;
  showAllOnFocus?: boolean;
}) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [editedSinceFocus, setEditedSinceFocus] = useState(false);
  const [fieldHeight, setFieldHeight] = useState(56);
  const query =
    showAllOnFocus && !editedSinceFocus
      ? ''
      : value.trim().toLocaleLowerCase('de-DE');
  const options = suggestions.filter((s) =>
    s.toLocaleLowerCase('de-DE').includes(query),
  );
  function close() {
    setFocused(false);
    Keyboard.dismiss();
  }
  return (
    <View style={{ zIndex: focused ? 20 : 0, gap: 4 }}>
      <View onLayout={(e) => setFieldHeight(e.nativeEvent.layout.height)}>
        <Field
          label={label}
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
      {focused && !disabled && !!options.length && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{
            position: 'absolute',
            top: fieldHeight + 2,
            left: 0,
            right: 0,
            maxHeight: 220,
            borderRadius: 4,
            backgroundColor: c.card,
            elevation: 8,
            zIndex: 20,
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
      )}
    </View>
  );
}
