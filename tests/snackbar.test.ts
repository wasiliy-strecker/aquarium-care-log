import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { Snackbar } from '../src/core/ui/snackbar';

vi.mock('react-native', () => ({ Text: 'Text' }));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'View' },
  Easing: { bezier: () => undefined },
  withTiming: vi.fn(),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('../src/core/ui/theme', () => ({ useTheme: () => ({ dark: false }) }));
afterEach(() => vi.useRealTimers());

it.each([undefined, 8000])(
  'keeps feedback visible for the requested duration (%s)',
  async (durationMs) => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const dismiss = vi.fn();
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        createElement(Snackbar, {
          id: 1,
          message: 'Test',
          durationMs,
          onDismiss: dismiss,
        }),
      );
    });
    try {
      await act(async () => {
        vi.advanceTimersByTime(250 + (durationMs ?? 4000) - 1);
      });
      expect(dismiss).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(dismiss).toHaveBeenCalledExactlyOnceWith(1);
    } finally {
      await act(async () => renderer.unmount());
    }
  },
);
