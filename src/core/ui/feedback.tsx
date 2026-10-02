import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icon';
import { useTheme } from './theme';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSheetDrag } from './use-sheet-drag';
import { Snackbar } from './snackbar';
import { DialogActions } from './dialog-actions';
export type Choice = {
  value: string;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  danger?: boolean;
  filled?: boolean;
  outlined?: boolean;
};
export type MenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type Question = {
  title: string;
  message?: string;
  options: Choice[];
  optionStyle?: 'cards' | 'plain';
  dialog?: boolean;
  stackedActions?: boolean;
  anchor?: MenuAnchor;
};
type Feedback = {
  choose(q: Question): Promise<string | null>;
  confirm(
    title: string,
    message: string,
    accept?: string,
    danger?: boolean,
    cancelLabel?: string,
  ): Promise<boolean>;
  notify(message: string): void;
};
const Context = createContext<Feedback | null>(null);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const c = useTheme();
  const safe = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [question, setQuestion] = useState<Question>();
  const cardOptions =
    question?.optionStyle === 'cards' && !question.dialog && !question.anchor;
  const plainMenu = question?.optionStyle === 'plain' && !!question.anchor;
  const plainMenuWidth = Math.min(
    window.width - 16,
    168 * Math.max(1, window.fontScale),
  );
  const plainMenuHeight =
    (question?.options.length ?? 0) * Math.max(48, 20 * window.fontScale + 24) +
    16;
  const resolve = useRef<((v: string | null) => void) | null>(null);
  const nextNoticeId = useRef(0);
  const [notice, setNotice] = useState<{ id: number; message: string }>();
  const notify = useCallback((message: string) => {
    setNotice(message ? { id: ++nextNoticeId.current, message } : undefined);
  }, []);
  const dismissNotice = useCallback((id: number) => {
    setNotice((current) => (current?.id === id ? undefined : current));
  }, []);
  const choose = useCallback(
    (q: Question) =>
      new Promise<string | null>((done) => {
        resolve.current?.(null);
        resolve.current = done;
        setQuestion(q);
      }),
    [],
  );
  const finish = useCallback((value: string | null) => {
    setQuestion(undefined);
    resolve.current?.(value);
    resolve.current = null;
  }, []);
  const dismiss = useCallback(() => finish(null), [finish]);
  const sheet = useSheetDrag(
    !!question && !question.dialog && !question.anchor,
    question,
    dismiss,
  );
  const confirm = useCallback(
    async (
      title: string,
      message: string,
      accept = 'Löschen',
      danger = true,
      cancelLabel = 'Abbrechen',
    ) =>
      (await choose({
        title,
        message,
        dialog: true,
        stackedActions: danger,
        options: danger
          ? [
              {
                value: 'yes',
                label: accept,
                danger: true,
                filled: true,
                icon: accept === 'Löschen' ? 'delete_outline' : undefined,
              },
              { value: 'cancel', label: cancelLabel, outlined: true },
            ]
          : [
              { value: 'cancel', label: cancelLabel },
              { value: 'yes', label: accept, filled: true },
            ],
      })) === 'yes',
    [choose],
  );
  useEffect(
    () => () => {
      resolve.current?.(null);
    },
    [],
  );
  const text = {
    fontFamily: 'Roboto',
    fontSize: 14,
    lineHeight: 20,
    color: c.ink,
  } as const;
  return (
    <Context.Provider value={{ choose, confirm, notify }}>
      {children}
      {notice && (
        <Snackbar key={notice.id} {...notice} onDismiss={dismissNotice} />
      )}
      <Modal
        visible={!!question}
        transparent
        animationType="fade"
        onRequestClose={() => finish(null)}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              justifyContent: question?.dialog ? 'center' : 'flex-end',
              backgroundColor: question?.anchor ? 'transparent' : '#00000066',
              padding: question?.dialog ? 24 : 0,
            }}
          >
            <Pressable
              accessibilityLabel="Abbrechen"
              onPress={() => finish(null)}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <GestureDetector gesture={sheet.pan}>
              <Animated.View
                accessibilityViewIsModal
                onLayout={sheet.onLayout}
                style={[
                  {
                    backgroundColor: c.card,
                    borderRadius: 28,
                    borderBottomLeftRadius: question?.dialog ? 28 : 0,
                    borderBottomRightRadius: question?.dialog ? 28 : 0,
                    padding: question?.dialog ? 24 : 16,
                    paddingTop: cardOptions ? 22 : question?.dialog ? 24 : 16,
                    paddingBottom: question?.dialog ? 24 : safe.bottom + 20,
                    maxHeight: '85%',
                    maxWidth: question?.dialog ? 560 : 640,
                    width: '100%',
                    alignSelf: 'center',
                    gap: 12,
                    ...(question?.anchor
                      ? ({
                          position: 'absolute',
                          left: Math.max(
                            8,
                            Math.min(
                              question.anchor.x,
                              window.width -
                                Math.min(
                                  320,
                                  Math.max(224, question.anchor.width),
                                ) -
                                8,
                            ),
                          ),
                          top: Math.max(
                            safe.top + 8,
                            Math.min(
                              question.anchor.y + question.anchor.height,
                              window.height -
                                safe.bottom -
                                Math.min(
                                  400,
                                  question.options.length *
                                    56 *
                                    Math.max(1, window.fontScale) +
                                    16,
                                ) -
                                8,
                            ),
                          ),
                          width: Math.min(
                            window.width - 16,
                            Math.max(224, question.anchor.width),
                          ),
                          maxWidth: 400,
                          maxHeight: Math.min(
                            400,
                            window.height - safe.top - safe.bottom - 32,
                          ),
                          borderRadius: 4,
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4,
                          padding: 8,
                          paddingBottom: 8,
                          gap: 0,
                          elevation: 8,
                        } as const)
                      : {}),
                    ...(plainMenu && question?.anchor
                      ? {
                          left: Math.max(
                            8,
                            Math.min(
                              question.anchor.x +
                                question.anchor.width -
                                plainMenuWidth,
                              window.width - plainMenuWidth - 8,
                            ),
                          ),
                          top: Math.max(
                            safe.top + 8,
                            Math.min(
                              question.anchor.y,
                              window.height - safe.bottom - plainMenuHeight - 8,
                            ),
                          ),
                          width: plainMenuWidth,
                          paddingHorizontal: 0,
                          paddingVertical: 8,
                          paddingBottom: 8,
                        }
                      : {}),
                  },
                  sheet.style,
                ]}
              >
                {!question?.dialog && !question?.anchor && (
                  <View
                    style={{
                      width: 32,
                      height: 4,
                      backgroundColor: cardOptions ? c.muted : c.outline,
                      borderRadius: 4,
                      alignSelf: 'center',
                      marginBottom: cardOptions ? 10 : 8,
                    }}
                  />
                )}
                {!question?.dialog && !question?.anchor && (
                  <View style={{ gap: cardOptions ? 6 : 12 }}>
                    <Text
                      accessibilityRole="header"
                      style={[
                        text,
                        {
                          fontSize: 22,
                          lineHeight: 28,
                          fontFamily: 'RobotoBold',
                        },
                      ]}
                    >
                      {question?.title}
                    </Text>
                    {!!question?.message && (
                      <Text style={[text, { color: c.muted }]}>
                        {question.message}
                      </Text>
                    )}
                  </View>
                )}
                {!!question?.anchor && !!question.message && (
                  <Text style={[text, { color: c.muted }]}>
                    {question.message}
                  </Text>
                )}
                {question?.dialog ? (
                  <ScrollView
                    style={{ flexGrow: 0, flexShrink: 1 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ gap: 12 }}
                  >
                    <Text
                      accessibilityRole="header"
                      style={{ ...text, fontSize: 24, lineHeight: 32 }}
                    >
                      {question.title}
                    </Text>
                    {!!question.message && (
                      <Text style={text}>{question.message}</Text>
                    )}
                    <DialogActions
                      stacked={question.stackedActions}
                      actions={question.options.map((option) => ({
                        ...option,
                        onPress: () => finish(option.value),
                      }))}
                    />
                  </ScrollView>
                ) : (
                  <GestureDetector gesture={sheet.nativeScroll}>
                    <Animated.ScrollView
                      onLayout={sheet.onScrollLayout}
                      onScroll={sheet.onScroll}
                      scrollEventThrottle={16}
                      overScrollMode="never"
                      bounces={false}
                      contentContainerStyle={{ gap: plainMenu ? 0 : 8 }}
                    >
                      {question?.options.map((o) => (
                        <Pressable
                          key={o.value}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: o.disabled }}
                          disabled={o.disabled}
                          onPress={() => finish(o.value)}
                          style={({ pressed }) => ({
                            minHeight: 48,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 16,
                            borderRadius: 12,
                            opacity:
                              !cardOptions && !plainMenu && o.disabled
                                ? 0.38
                                : pressed && !o.disabled
                                  ? 0.8
                                  : 1,
                            ...(plainMenu
                              ? {
                                  paddingHorizontal: 12,
                                  paddingVertical: 12,
                                  borderRadius: 0,
                                }
                              : {}),
                            ...(cardOptions
                              ? ({
                                  minHeight: 72,
                                  backgroundColor: c.card,
                                  borderWidth: 1,
                                  borderColor: c.border,
                                  borderRadius: 18,
                                  overflow: 'hidden',
                                  // Flutter paints the border over the ListTile padding.
                                  paddingLeft: 15,
                                  paddingRight: 23,
                                  paddingVertical: 7,
                                } as const)
                              : {}),
                          })}
                        >
                          {!!o.icon && (
                            <Icon
                              name={o.icon}
                              color={
                                cardOptions && o.disabled
                                  ? c.ink + '61'
                                  : o.danger
                                    ? c.danger
                                    : c.primary
                              }
                            />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                text,
                                {
                                  fontFamily: plainMenu
                                    ? 'Roboto'
                                    : cardOptions
                                      ? 'RobotoBold'
                                      : 'RobotoMedium',
                                  fontSize: plainMenu ? 14 : 16,
                                  ...(plainMenu ? { letterSpacing: 0.25 } : {}),
                                  ...(cardOptions
                                    ? { lineHeight: 24, letterSpacing: 0.15 }
                                    : {}),
                                  color:
                                    (cardOptions || plainMenu) && o.disabled
                                      ? c.ink + '61'
                                      : o.danger
                                        ? c.danger
                                        : c.ink,
                                },
                              ]}
                            >
                              {o.label}
                            </Text>
                            {!!o.description && (
                              <Text
                                style={[
                                  text,
                                  {
                                    color: c.muted,
                                    marginTop: cardOptions ? 0 : 4,
                                  },
                                  cardOptions && { letterSpacing: 0.25 },
                                ]}
                              >
                                {o.description}
                              </Text>
                            )}
                          </View>
                          {cardOptions && !o.disabled && (
                            <Icon name="chevron_right" color={c.muted} />
                          )}
                        </Pressable>
                      ))}
                    </Animated.ScrollView>
                  </GestureDetector>
                )}
              </Animated.View>
            </GestureDetector>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </Context.Provider>
  );
}
export function useFeedback() {
  const value = useContext(Context);
  if (!value) throw new Error('FeedbackProvider fehlt.');
  return value;
}
