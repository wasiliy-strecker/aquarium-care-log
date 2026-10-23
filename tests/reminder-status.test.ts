import { createElement, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import { useReminderStatusSnapshot } from '../src/features/aquariums/use-reminder-status';
import type { ReminderStatus } from '../src/core/native/aquarium-native';

const native = vi.hoisted(() => ({
  reminderStatus: vi.fn(),
  addListener: vi.fn(),
}));
const changes = new Set<() => void>();
beforeEach(() => {
  vi.resetAllMocks();
  changes.clear();
  native.addListener.mockImplementation(
    (_event: string, listener: () => void) => {
      changes.add(listener);
      return { remove: () => changes.delete(listener) };
    },
  );
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
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

it('refreshes an open view after native delivery and removes the event listener on unmount', async () => {
  const status: ReminderStatus = {
    notifications: true,
    exact: true,
    doNotDisturb: false,
    availability: { normal: 'available', punctualWithSound: 'available' },
    schedules: [
      {
        aquariumId: 'tank',
        nextTriggerAtMillis: 1000,
        planningState: 'scheduled',
        isExact: true,
        deliveryFailed: false,
        isNotificationActive: false,
        lastTriggeredAtMillis: null,
      },
    ],
  };
  native.reminderStatus.mockResolvedValue(status);
  let state!: ReturnType<typeof useReminderStatusSnapshot>;
  function Harness() {
    state = useReminderStatusSnapshot();
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(createElement(Harness));
  });
  expect(native.addListener).toHaveBeenCalledWith(
    'onReminderStatusChanged',
    expect.any(Function),
  );
  expect(state.status?.schedules[0]?.nextTriggerAtMillis).toBe(1000);
  const delivered: ReminderStatus = {
    ...status,
    schedules: [
      {
        ...status.schedules[0]!,
        nextTriggerAtMillis: 3601000,
        lastTriggeredAtMillis: 1000,
        isNotificationActive: true,
      },
    ],
  };
  native.reminderStatus.mockResolvedValue(delivered);
  await act(async () => {
    for (const change of changes) change();
  });
  expect(state.status).toEqual(delivered);
  native.reminderStatus.mockRejectedValueOnce(new Error('Unavailable'));
  await act(async () => {
    for (const change of changes) change();
  });
  expect(state.status).toBeUndefined();
  await act(async () => renderer.unmount());
  expect(changes.size).toBe(0);
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
