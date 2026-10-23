import { createElement, useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Reminder } from '../src/core/domain/models';
import type { ReminderStatus } from '../src/core/native/aquarium-native';
import { useReminderEditor } from '../src/features/aquariums/use-reminder-editor';
import { defaultReminder } from '../src/features/aquariums/reminder-model';

const ports = vi.hoisted(() => ({
  openReminderSettings: vi.fn(),
  testReminder: vi.fn(),
  entries: vi.fn(),
  notify: vi.fn(),
  refreshStatus: vi.fn(),
}));
vi.mock('../src/core/composition', () => ({
  useServices: () => ({
    native: ports,
    aquariumService: { repository: { entries: ports.entries } },
  }),
}));
vi.mock('../src/core/ui/feedback', () => ({
  useFeedback: () => ({ notify: ports.notify }),
}));

const status: ReminderStatus = {
  notifications: true,
  exact: false,
  doNotDisturb: false,
  availability: { normal: 'available', punctualWithSound: 'available' },
  schedules: [],
};
let view: ReactTestRenderer;
let editor: ReturnType<typeof useReminderEditor>;
let value: Reminder | null;
function Harness() {
  const [reminder, setReminder] = useState<Reminder | null>(defaultReminder);
  const current = useReminderEditor({
    reminder,
    onChange: setReminder,
    busy: false,
    status,
    refreshStatus: ports.refreshStatus,
    aquariumId: 'saved-aquarium',
    label: ' Wohnzimmer ',
    categoryLabel: 'Aquarium',
  });
  useEffect(() => {
    value = reminder;
    editor = current;
  }, [reminder, current]);
  return null;
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  ports.refreshStatus.mockResolvedValue(status);
  ports.openReminderSettings.mockResolvedValue(true);
  ports.testReminder.mockResolvedValue('posted');
  ports.entries.mockResolvedValue({ rows: [{ activity: '12' }] });
  await act(async () => {
    view = create(createElement(Harness));
  });
});
afterEach(async () => {
  await act(async () => view.unmount());
});

it.each(['rejected', 'unknown'])(
  'reports an unavailable status in Normal mode without mentioning exact alarms (%s)',
  async (failure) => {
    if (failure === 'rejected')
      ports.refreshStatus.mockRejectedValue(new Error('Synthetic failure'));
    else ports.refreshStatus.mockResolvedValue(undefined);
    await act(async () => editor.selectMode('normal'));
    expect(value?.deliveryMode).toBe('normal');
    expect(ports.openReminderSettings).not.toHaveBeenCalled();
    expect(ports.notify).toHaveBeenLastCalledWith(
      'Der Erinnerungsstatus konnte nicht bestätigt werden.',
    );
    expect(editor.disabled).toBe(false);
  },
);

it.each(['unavailable', 'rejected'])(
  'retains punctual mode and gives the manual settings path when opening fails (%s)',
  async (failure) => {
    if (failure === 'rejected')
      ports.openReminderSettings.mockRejectedValue(new Error('No activity'));
    else ports.openReminderSettings.mockResolvedValue(false);
    await act(async () => editor.selectMode('punctualWithSound'));
    expect(value?.deliveryMode).toBe('punctualWithSound');
    expect(ports.openReminderSettings).toHaveBeenCalledWith('exact', null);
    expect(ports.notify.mock.lastCall?.[0]).toContain('Alarme & Erinnerungen');
    expect(ports.notify.mock.lastCall?.[0]).toContain(
      '„Pünktlich mit Ton“ bleibt ausgewählt.',
    );
  },
);

it('keeps granted exact permission and targets only the chosen notification channel', async () => {
  ports.refreshStatus.mockResolvedValue({ ...status, exact: true });
  await act(async () => editor.selectMode('punctualWithSound'));
  expect(ports.openReminderSettings).not.toHaveBeenCalled();
  await act(async () => editor.open('channel'));
  expect(ports.openReminderSettings).toHaveBeenLastCalledWith(
    'channel',
    'punctualWithSound',
  );
  expect(ports.notify).not.toHaveBeenCalled();
});

it('remembers interval fields and settings across disabling and re-enabling', async () => {
  await act(async () => editor.patch({ day: 31, hour: 14, minute: 27 }));
  await act(async () => editor.interval('weekly'));
  await act(async () => editor.patch({ day: 4 }));
  await act(async () => editor.interval('hourly'));
  await act(async () => editor.interval('monthly'));
  expect(value).toMatchObject({ day: 31, hour: 14, minute: 27 });
  await act(async () => editor.interval('weekly'));
  expect(value?.day).toBe(4);
  const before = value;
  await act(async () => editor.toggle(false));
  expect(value).toBeNull();
  await act(async () => editor.toggle(true));
  expect(value).toEqual(before);
});

it('tests the current aquarium and chronological entry and distinguishes delivery failures', async () => {
  await act(async () => editor.test());
  expect(ports.entries).toHaveBeenCalledWith('saved-aquarium', '', 0, 1);
  expect(ports.testReminder).toHaveBeenCalledWith({
    aquariumId: 'saved-aquarium',
    label: 'Wohnzimmer',
    categoryLabel: 'Aquarium',
    latestValue: '12',
    deliveryMode: 'normal',
  });
  expect(ports.notify.mock.lastCall?.[0]).toContain('an Android übergeben');
  expect(ports.notify.mock.lastCall?.[1]).toBe(8000);
  ports.testReminder.mockResolvedValue('channelBlocked');
  await act(async () => editor.test());
  expect(ports.notify.mock.lastCall?.[0]).toContain('Erinnerungsart');
  expect(ports.notify.mock.lastCall?.[1]).toBe(4000);
  ports.testReminder.mockRejectedValue(new Error('Synthetic delivery failure'));
  await act(async () => editor.test());
  expect(ports.notify.mock.lastCall?.[0]).toBe(
    'Test-Erinnerung konnte nicht angezeigt werden.',
  );
});

it('serializes settings requests while Android is opening', async () => {
  let finish!: (value: boolean) => void;
  ports.openReminderSettings.mockReturnValue(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = editor.selectMode('punctualWithSound');
  });
  await act(async () => editor.selectMode('normal'));
  expect(value?.deliveryMode).toBe('punctualWithSound');
  expect(ports.openReminderSettings).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(editor.disabled).toBe(false);
});
