import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

// Match Fahrzeugakte's fixed Material snackbar and Flutter's default timing.
const transitionMs = 250;
const displayMs = 4000;
const timing = {
  duration: transitionMs,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};
function enter(values: EntryAnimationsValues) {
  'worklet';
  return {
    initialValues: { transform: [{ translateY: values.targetHeight }] },
    animations: { transform: [{ translateY: withTiming(0, timing) }] },
  };
}
function exit(values: ExitAnimationsValues) {
  'worklet';
  return {
    initialValues: { transform: [{ translateY: 0 }] },
    animations: {
      transform: [{ translateY: withTiming(values.currentHeight, timing) }],
    },
  };
}

export function Snackbar({
  id,
  message,
  onDismiss,
}: {
  id: number;
  message: string;
  onDismiss(id: number): void;
}) {
  const c = useTheme();
  const safe = useSafeAreaInsets();
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), transitionMs + displayMs);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);
  return (
    <Animated.View
      entering={enter}
      exiting={exit}
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: 4,
        paddingTop: 14,
        paddingBottom: 14 + safe.bottom,
        paddingLeft: 24 + safe.left,
        paddingRight: 24 + safe.right,
        backgroundColor: c.dark ? '#E0E2E8' : '#2D3135',
        elevation: 6,
      }}
    >
      <Text
        style={{
          fontFamily: 'Roboto',
          fontSize: 14,
          lineHeight: 20,
          letterSpacing: 0.25,
          textAlign: 'center',
          color: c.dark ? '#2D3135' : '#F1F4F7',
        }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
