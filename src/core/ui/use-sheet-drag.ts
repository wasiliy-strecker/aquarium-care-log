import { useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** A downward drag dismisses sheets. Scrolling and ordinary taps stay native. */
export function useSheetDrag(
  enabled: boolean,
  resetKey: unknown,
  onDismiss: () => void,
) {
  const translation = useSharedValue(0);
  const height = useSharedValue(0);
  const scrollTop = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scrollOwnsTouch = useSharedValue(false);
  const dragging = useSharedValue(false);
  const closing = useSharedValue(false);

  useEffect(() => {
    // Keep a dismissed sheet below the window during Modal's fade-out.
    if (resetKey === undefined) return;
    translation.set(0);
    scrollOffset.set(0);
    closing.set(false);
    dragging.set(false);
  }, [enabled, resetKey, translation, scrollOffset, closing, dragging]);

  const nativeScroll = Gesture.Native().enabled(enabled);
  const pan = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .manualActivation(true)
    .simultaneousWithExternalGesture(nativeScroll)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      startX.set(touch.absoluteX);
      startY.set(touch.absoluteY);
      // The handle/title can always drag. A scrolled list must first scroll
      // back to its top, then a new downward gesture may dismiss the sheet.
      scrollOwnsTouch.set(touch.y >= scrollTop.get() && scrollOffset.get() > 1);
    })
    .onTouchesMove((event, manager) => {
      if (dragging.get()) return;
      const touch = event.allTouches[0];
      if (!touch || event.numberOfTouches !== 1 || closing.get()) {
        manager.fail();
        return;
      }
      const dx = Math.abs(touch.absoluteX - startX.get());
      const dy = touch.absoluteY - startY.get();
      if (dy < -10 || (dx > 10 && dx > Math.abs(dy)) || scrollOwnsTouch.get()) {
        manager.fail();
      } else if (dy > 10 && dy > dx) {
        manager.activate();
      }
    })
    .onStart(() => {
      dragging.set(true);
    })
    .onUpdate((event) => {
      translation.set(Math.max(0, event.absoluteY - startY.get()));
    })
    .onEnd((event) => {
      const distance = Math.min(120, height.get() * 0.25);
      const dragged = event.absoluteY - startY.get();
      if (dragged > distance || (dragged > 16 && event.velocityY > 800)) {
        closing.set(true);
        translation.set(
          withTiming(height.get() + 24, { duration: 180 }, (finished) => {
            if (finished) scheduleOnRN(onDismiss);
          }),
        );
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      if (!closing.get() && translation.get() > 0) {
        translation.set(withSpring(0, { damping: 24, stiffness: 260 }));
      }
    });

  return {
    pan,
    nativeScroll,
    style: useAnimatedStyle(() => ({
      transform: [{ translateY: translation.get() }],
    })),
    onLayout: (event: LayoutChangeEvent) =>
      height.set(event.nativeEvent.layout.height),
    onScrollLayout: (event: LayoutChangeEvent) =>
      scrollTop.set(event.nativeEvent.layout.y),
    onScroll: useAnimatedScrollHandler((event) => {
      scrollOffset.set(Math.max(0, event.contentOffset.y));
    }),
  };
}
