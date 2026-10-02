import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, type IconName } from './icon';
import { calendarCells, parseDateInput } from './date-time-model';
import { DialogActions } from './dialog-actions';

type Request = {
  mode: 'date' | 'time';
  value: Date;
  first: Date;
  last: Date;
  yearFirst?: boolean;
  calendarOnly?: boolean;
  title?: string;
};
const dateText = (date: Date) =>
  date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
const two = (n: number) => String(n).padStart(2, '0');
export function useMaterialDateTime() {
  const [request, setRequest] = useState<Request>();
  const resolve = useRef<((date: Date | null) => void) | undefined>(undefined);
  function close(date: Date | null) {
    Keyboard.dismiss();
    setRequest(undefined);
    const done = resolve.current;
    resolve.current = undefined;
    done?.(date);
  }
  useEffect(() => () => resolve.current?.(null), []);
  function open(options: Partial<Request> & Pick<Request, 'mode' | 'value'>) {
    Keyboard.dismiss();
    resolve.current?.(null);
    setRequest({
      first: new Date(2000, 0, 1),
      last: new Date(2100, 11, 31),
      ...options,
    });
    return new Promise<Date | null>((done) => {
      resolve.current = done;
    });
  }
  return {
    date: (value: Date, options?: Partial<Omit<Request, 'mode' | 'value'>>) =>
      open({ mode: 'date', value, ...options }),
    time: (value: Date) => open({ mode: 'time', value }),
    dialog: request ? (
      <Picker
        key={`${request.mode}-${request.value.getTime()}`}
        request={request}
        close={close}
      />
    ) : null,
  };
}
function Picker({
  request: r,
  close,
}: {
  request: Request;
  close(date: Date | null): void;
}) {
  const c = useTheme(),
    safe = useSafeAreaInsets(),
    window = useWindowDimensions();
  const [date, setDate] = useState(
    () =>
      new Date(
        Math.max(
          r.first.getTime(),
          Math.min(r.last.getTime(), r.value.getTime()),
        ),
      ),
  );
  const [month, setMonth] = useState(
    () => new Date(date.getFullYear(), date.getMonth(), 1),
  );
  const [years, setYears] = useState(!!r.yearFirst);
  const [input, setInput] = useState(false),
    [error, setError] = useState('');
  const [dateInput, setDateInput] = useState(dateText(date));
  const [hour, setHour] = useState(r.value.getHours()),
    [minute, setMinute] = useState(r.value.getMinutes());
  const [hourInput, setHourInput] = useState(two(hour)),
    [minuteInput, setMinuteInput] = useState(two(minute));
  const [selectHour, setSelectHour] = useState(true);
  const text = { fontFamily: 'Roboto', fontSize: 16, color: c.ink };
  function icon(
    name: IconName,
    label: string,
    action: () => void,
    disabled = false,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={action}
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.38 : 1,
        }}
      >
        <Icon name={name} />
      </Pressable>
    );
  }
  function toggleInput() {
    Keyboard.dismiss();
    setError('');
    setDateInput(dateText(date));
    setHourInput(two(hour));
    setMinuteInput(two(minute));
    setInput(!input);
  }
  function confirm() {
    if (r.mode === 'date') {
      const result = input ? parseDateInput(dateInput, r.first, r.last) : date;
      if (!result) {
        setError('Bitte ein gültiges Datum im erlaubten Zeitraum eingeben.');
        return;
      }
      close(result);
    } else {
      const h = input ? Number(hourInput) : hour,
        m = input ? Number(minuteInput) : minute;
      if (
        !/^\d{1,2}$/.test(input ? hourInput : String(h)) ||
        !/^\d{1,2}$/.test(input ? minuteInput : String(m)) ||
        h > 23 ||
        m > 59
      ) {
        setError('Bitte eine gültige Uhrzeit eingeben.');
        return;
      }
      const result = new Date(r.value);
      result.setHours(h, m, 0, 0);
      close(result);
    }
  }
  const firstMonth = new Date(
    r.first.getFullYear(),
    r.first.getMonth(),
    1,
  ).getTime();
  const lastMonth = new Date(
    r.last.getFullYear(),
    r.last.getMonth(),
    1,
  ).getTime();
  function field(
    value: string,
    change: (value: string) => void,
    label: string,
    width?: number,
  ) {
    return (
      <View style={{ gap: 6, flex: width ? undefined : 1, width }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={change}
          keyboardType={
            r.mode === 'time' ? 'number-pad' : 'numbers-and-punctuation'
          }
          placeholder={r.mode === 'date' ? 'TT.MM.JJJJ' : undefined}
          placeholderTextColor={c.muted}
          maxLength={r.mode === 'time' ? 2 : 10}
          style={{
            ...text,
            fontSize: r.mode === 'time' ? 48 : 16,
            textAlign: r.mode === 'time' ? 'center' : 'left',
            padding: 12,
            borderWidth: 1,
            borderRadius: 8,
            borderColor: error ? c.danger : c.outline,
            backgroundColor: c.input,
          }}
        />
        <Text style={{ ...text, fontSize: 12, color: c.muted }}>{label}</Text>
      </View>
    );
  }
  let content: ReactNode;
  if (r.mode === 'date') {
    content = (
      <>
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 16,
            gap: 24,
          }}
        >
          <Text style={{ ...text, fontSize: 14 }}>
            {r.title ?? 'Datum auswählen'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...text, fontSize: 32, flex: 1 }}>
              {date.toLocaleDateString('de-DE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            {!r.calendarOnly &&
              icon(
                input ? 'calendar_today' : 'edit_outlined',
                input ? 'Zum Kalender wechseln' : 'Datum eingeben',
                toggleInput,
              )}
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: c.border }} />
        {input ? (
          <View style={{ padding: 24 }}>
            {field(dateInput, setDateInput, 'Datum')}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 12 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', height: 56 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jahr auswählen"
                onPress={() => setYears(!years)}
                style={{
                  flex: 1,
                  paddingLeft: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ ...text, fontSize: 14 }}>
                  {month.toLocaleDateString('de-DE', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Icon name="arrow_drop_down" />
              </Pressable>
              {!years && (
                <>
                  {icon(
                    'chevron_left',
                    'Vorheriger Monat',
                    () =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      ),
                    month.getTime() <= firstMonth,
                  )}
                  {icon(
                    'chevron_right',
                    'Nächster Monat',
                    () =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      ),
                    month.getTime() >= lastMonth,
                  )}
                </>
              )}
            </View>
            {years ? (
              <ScrollView
                nestedScrollEnabled
                style={{ height: 294 }}
                contentOffset={{
                  x: 0,
                  y:
                    Math.max(
                      0,
                      Math.floor(
                        (date.getFullYear() - r.first.getFullYear()) / 3,
                      ) - 2,
                    ) * 52,
                }}
                contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}
              >
                {Array.from(
                  { length: r.last.getFullYear() - r.first.getFullYear() + 1 },
                  (_, i) => r.first.getFullYear() + i,
                ).map((year) => (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: date.getFullYear() === year,
                    }}
                    onPress={() => {
                      setMonth(new Date(year, month.getMonth(), 1));
                      setYears(false);
                    }}
                    style={{
                      width: '33.333%',
                      height: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...text,
                        padding: 10,
                        borderRadius: 20,
                        color:
                          year === date.getFullYear() ? c.onPrimary : c.ink,
                        backgroundColor:
                          year === date.getFullYear() ? c.primary : undefined,
                      }}
                    >
                      {year}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                <View style={{ flexDirection: 'row' }}>
                  {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((day, i) => (
                    <Text
                      key={i}
                      style={{
                        ...text,
                        flex: 1,
                        textAlign: 'center',
                        height: 48,
                        textAlignVertical: 'center',
                        fontSize: 16,
                      }}
                    >
                      {day}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {calendarCells(month).map((day, i) => {
                    const candidate = day
                      ? new Date(month.getFullYear(), month.getMonth(), day)
                      : null;
                    const selected =
                      !!candidate &&
                      candidate.toDateString() === date.toDateString();
                    const today =
                      candidate?.toDateString() === new Date().toDateString();
                    const disabled =
                      !candidate || candidate < r.first || candidate > r.last;
                    return (
                      <View
                        key={i}
                        style={{
                          width: `${100 / 7}%`,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Pressable
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={
                            candidate ? dateText(candidate) : undefined
                          }
                          accessibilityState={{ selected, disabled }}
                          onPress={() => candidate && setDate(candidate)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: selected ? c.primary : undefined,
                            borderWidth: today && !selected ? 1 : 0,
                            borderColor: c.primary,
                          }}
                        >
                          <Text
                            style={{
                              ...text,
                              fontSize: 16,
                              color: disabled
                                ? c.outline
                                : selected
                                  ? c.onPrimary
                                  : today
                                    ? c.primary
                                    : c.ink,
                            }}
                          >
                            {day ?? ''}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}
      </>
    );
  } else {
    content = (
      <View style={{ padding: 24, gap: 24 }}>
        <Text style={{ ...text, fontSize: 14 }}>Uhrzeit auswählen</Text>
        {input ? (
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}
          >
            {field(hourInput, setHourInput, 'Stunde', 96)}
            <Text style={{ ...text, fontSize: 48 }}>:</Text>
            {field(minuteInput, setMinuteInput, 'Minute', 96)}
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {(['hour', 'minute'] as const).map((part, i) => (
                <View
                  key={part}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  {!!i && <Text style={{ ...text, fontSize: 52 }}>:</Text>}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      part === 'hour' ? 'Stunde auswählen' : 'Minute auswählen'
                    }
                    onPress={() => setSelectHour(part === 'hour')}
                    style={{
                      width: 96,
                      borderRadius: 8,
                      paddingVertical: 8,
                      alignItems: 'center',
                      backgroundColor:
                        (part === 'hour') === selectHour ? c.soft : c.input,
                    }}
                  >
                    <Text
                      style={{
                        ...text,
                        fontSize: 56,
                        color:
                          (part === 'hour') === selectHour ? c.onSoft : c.ink,
                      }}
                    >
                      {two(part === 'hour' ? hour : minute)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <ClockDial
              hour={hour}
              minute={minute}
              selectHour={selectHour}
              change={(value) =>
                selectHour ? setHour(value) : setMinute(value)
              }
              complete={() => setSelectHour(false)}
            />
          </>
        )}
      </View>
    );
  }
  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => close(null)}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 24,
          paddingHorizontal: r.mode === 'date' && !input ? 16 : 24,
          backgroundColor: '#00000066',
        }}
      >
        <Pressable
          accessibilityLabel="Abbrechen"
          onPress={() => close(null)}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: r.mode === 'date' && !input ? 360 : 328,
            maxHeight: window.height - safe.top - safe.bottom - 48,
            backgroundColor: c.card,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {content}
            {!!error && (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  ...text,
                  fontSize: 14,
                  color: c.danger,
                  paddingHorizontal: 24,
                }}
              >
                {error}
              </Text>
            )}
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            {r.mode === 'time' &&
              icon(
                input ? 'schedule' : 'keyboard_outlined',
                input ? 'Zur Uhr wechseln' : 'Uhrzeit eingeben',
                toggleInput,
              )}
            <View style={{ flex: 1 }}>
              <DialogActions
                actions={[
                  { label: 'Abbrechen', onPress: () => close(null) },
                  {
                    label: r.calendarOnly ? 'Übernehmen' : 'OK',
                    onPress: confirm,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function ClockDial({
  hour,
  minute,
  selectHour,
  change,
  complete,
}: {
  hour: number;
  minute: number;
  selectHour: boolean;
  change(value: number): void;
  complete(): void;
}) {
  const c = useTheme(),
    { width } = useWindowDimensions();
  const size = Math.min(256, width - 96),
    center = size / 2,
    outer = center - 26,
    inner = outer * 0.65;
  const dial = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const value = selectHour ? hour : minute;
  const angle = ((selectHour ? hour % 12 : minute / 5) * Math.PI) / 6;
  const radius = selectHour && (hour === 0 || hour > 12) ? inner : outer;
  const x = Math.sin(angle) * radius,
    y = -Math.cos(angle) * radius;
  const pick = (px: number, py: number) => {
    const dx = px - center,
      dy = py - center;
    const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    if (selectHour) {
      const h = Math.round((a / (Math.PI * 2)) * 12) % 12;
      change(
        Math.hypot(dx, dy) < (inner + outer) / 2
          ? h === 0
            ? 0
            : h + 12
          : h || 12,
      );
    } else change(Math.round((a / (Math.PI * 2)) * 60) % 60);
  };
  // PanResponder stores these callbacks. Ref reads occur only on touch events.
  // eslint-disable-next-line react-hooks/refs
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      dial.current?.measureInWindow((x, y) => {
        origin.current = { x, y };
        pick(pageX - x, pageY - y);
      });
    },
    onPanResponderMove: (e) =>
      pick(
        e.nativeEvent.pageX - origin.current.x,
        e.nativeEvent.pageY - origin.current.y,
      ),
    onPanResponderRelease: () => complete(),
  });
  const values = selectHour
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i * 5);
  return (
    <View
      ref={dial}
      {...pan.panHandlers}
      style={{
        width: size,
        height: size,
        borderRadius: center,
        backgroundColor: c.input,
        alignSelf: 'center',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: center - 1,
          top: center - radius / 2,
          width: 2,
          height: radius,
          backgroundColor: c.primary,
          transform: [
            { translateX: x / 2 },
            { translateY: y / 2 },
            { rotate: `${angle}rad` },
          ],
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: center - 4,
          top: center - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: c.primary,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: center + x - 22,
          top: center + y - 22,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.primary,
        }}
      />
      {values.map((n) => {
        const a = ((selectHour ? n % 12 : n / 5) * Math.PI) / 6;
        const rad = selectHour && (n === 0 || n > 12) ? inner : outer;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${selectHour ? 'Uhr' : 'Minuten'}`}
            accessibilityState={{ selected: n === value }}
            onPress={() => {
              change(n);
              complete();
            }}
            style={{
              position: 'absolute',
              left: center + Math.sin(a) * rad - 22,
              top: center - Math.cos(a) * rad - 22,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Roboto',
                fontSize: 16,
                color: n === value ? c.onPrimary : c.ink,
              }}
            >
              {selectHour && n !== 0 ? n : two(n)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
