import { createElement, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { useReminderStatusSnapshot } from '../src/features/aquariums/use-reminder-status';
import type { ReminderStatus } from '../src/core/native/aquarium-native';

const native = vi.hoisted(() => ({ reminderStatus: vi.fn() }));
vi.mock('../src/core/composition', () => ({ useServices: () => ({ native }) }));
vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useFocusEffect: (callback: () => () => void) =>
      React.useEffect(callback, [callback]),
  };
});

it('ignores an older status reply that arrives after a newer one', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const replies: ((status: ReminderStatus) => void)[] = [];
  native.reminderStatus.mockImplementation(
    () => new Promise<ReminderStatus>((resolve) => replies.push(resolve)),
  );
  let state!: ReturnType<typeof useReminderStatusSnapshot>;
  function Harness() {
    const value = useReminderStatusSnapshot();
    useEffect(() => {
      state = value;
    }, [value]);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(createElement(Harness));
  });
  try {
    let second!: Promise<ReminderStatus | undefined>;
    await act(async () => {
      second = state.refresh();
    });
    const latest: ReminderStatus = {
      notifications: false,
      exact: false,
      doNotDisturb: false,
      availability: { normal: 'appBlocked', punctualWithSound: 'appBlocked' },
      schedules: [],
    };
    await act(async () => {
      replies[1]!(latest);
      await second;
    });
    expect(state.status).toEqual(latest);
    await act(async () => {
      replies[0]!({ ...latest, notifications: true });
    });
    expect(state.status).toEqual(latest);
  } finally {
    await act(async () => renderer.unmount());
  }
});
