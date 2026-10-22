import { messages } from '../../core/texts';
import type { Reminder } from '../../core/domain/models';
import type {
  ReminderStatus,
  ReminderScheduleStatus,
  ReminderTestResult,
  ReminderSettingsTarget,
} from '../../core/native/aquarium-native';
import { dateTime } from './presentation-model';

export const reminderIntervals = messages.reminders.intervals;
export const weekdays = Object.values(messages.reminders.weekdays);
export const reminderModes = {
  normal: {
    title: messages.reminders.modes.normal.title,
    description: messages.reminders.modes.normal.description,
    icon: 'notifications_active_outlined' as const,
  },
  punctualWithSound: {
    title: messages.reminders.modes.punctualWithSound.title,
    description: messages.reminders.modes.punctualWithSound.description,
    icon: 'schedule' as const,
  },
};
export const testReminderHint = messages.reminders.testHint;
export function defaultReminder(now = new Date()): Reminder {
  return {
    interval: 'monthly',
    day: Math.min(now.getDate(), 28),
    month: now.getMonth() + 1,
    hour: 9,
    minute: 0,
    deliveryMode: 'normal',
    startsAtMillis:
      now.getTime() -
      now.getMinutes() * 60000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds() +
      3600000,
  };
}
export function nextHourlyTrigger(start: number, now = Date.now()): number {
  return start > now
    ? start
    : start + (Math.floor((now - start) / 3600000) + 1) * 3600000;
}
export function hourlyStart(date: Date, time: Date): number {
  const value = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
  );
  if (
    value.getHours() !== time.getHours() ||
    value.getMinutes() !== time.getMinutes() ||
    value.getDate() !== date.getDate()
  )
    throw new Error(messages.reminders.feedback.invalidClockTime);
  return value.getTime();
}
export function reminderAvailability(
  status: ReminderStatus | undefined,
  mode: Reminder['deliveryMode'],
) {
  return (
    status?.availability?.[mode] ??
    (status?.notifications === false ? 'appBlocked' : 'unknown')
  );
}
export function reminderSchedule(
  status: ReminderStatus | undefined,
  aquariumId: string,
) {
  return status?.schedules.find(
    (schedule) => schedule.aquariumId === aquariumId,
  );
}
export function needsReminderRepair(
  reminder: Reminder | null,
  schedule: ReminderScheduleStatus | undefined,
): boolean {
  return (
    schedule?.planningState === 'cancelFailed' ||
    (!!reminder &&
      (schedule?.planningState !== 'scheduled' ||
        schedule.nextTriggerAtMillis === null ||
        (reminder.deliveryMode === 'punctualWithSound' &&
          schedule.isExact !== true)))
  );
}
export function reminderSaveWarning(
  reminder: Reminder | null,
  status: ReminderStatus | undefined,
  aquariumId: string,
): string | null {
  const schedule = reminderSchedule(status, aquariumId);
  if (schedule?.planningState === 'cancelFailed')
    return messages.reminders.feedback.savedCancelFailed;
  if (!reminder)
    return status ? null : messages.reminders.feedback.savedUnknown;
  const availability = reminderAvailability(status, reminder.deliveryMode);
  if (availability === 'appBlocked' || availability === 'channelBlocked')
    return messages.reminders.feedback.savedBlocked;
  if (!status || availability === 'unknown')
    return messages.reminders.feedback.savedUnknown;
  if (
    schedule?.planningState !== 'scheduled' ||
    schedule.nextTriggerAtMillis === null
  )
    return messages.reminders.feedback.savedUnconfirmed;
  if (
    reminder.deliveryMode === 'punctualWithSound' &&
    (!status.exact || schedule.isExact !== true)
  )
    return messages.reminders.feedback.savedInexact;
  return null;
}
export function reminderTestMessage(
  result: ReminderTestResult,
  quiet: boolean | null | undefined,
): string {
  if (result === 'posted')
    return (
      messages.reminders.feedback.testPosted +
      testReminderHint +
      (quiet === true ? messages.reminders.feedback.testQuiet : '')
    );
  if (result === 'appBlocked')
    return messages.reminders.feedback.testAppBlocked;
  if (result === 'channelBlocked')
    return messages.reminders.feedback.testChannelBlocked;
  return messages.reminders.feedback.testFailed;
}
export function reminderSettingsFailure(
  target: ReminderSettingsTarget,
): string {
  if (target === 'exact')
    return messages.reminders.feedback.exactSettingsFailed;
  if (target === 'doNotDisturb')
    return messages.reminders.feedback.quietSettingsFailed;
  return messages.reminders.feedback.notificationSettingsFailed;
}
export type ReminderPresentation = {
  title: string;
  description: string;
  error: boolean;
  action: 'edit' | ReminderSettingsTarget | null;
};
export function reminderPresentation(
  reminder: Reminder | null,
  status: ReminderStatus | undefined,
  aquariumId: string,
  now = Date.now(),
): ReminderPresentation | null {
  const schedule = reminderSchedule(status, aquariumId);
  if (schedule?.planningState === 'cancelFailed')
    return {
      title: messages.reminders.status.cancelFailed,
      description: messages.reminders.status.retryHint,
      error: true,
      action: 'edit',
    };
  if (!reminder) return null;
  const availability = reminderAvailability(status, reminder.deliveryMode);
  if (availability === 'appBlocked' || availability === 'channelBlocked')
    return {
      title: messages.reminders.status.blocked,
      description:
        availability === 'appBlocked'
          ? messages.reminders.status.appBlocked
          : messages.reminders.status.channelBlocked,
      error: true,
      action: availability === 'appBlocked' ? 'notifications' : 'channel',
    };
  if (
    schedule?.planningState === 'failed' ||
    schedule?.planningState === 'none'
  )
    return {
      title: messages.reminders.status.unplanned,
      description: messages.reminders.status.retryHint,
      error: true,
      action: 'edit',
    };
  if (reminder.deliveryMode === 'punctualWithSound' && status?.exact === false)
    return {
      title: messages.reminders.status.inexact,
      description: messages.reminders.status.inexactHint,
      error: true,
      action: 'exact',
    };
  if (
    reminder.deliveryMode === 'punctualWithSound' &&
    status?.exact === true &&
    schedule?.isExact === false
  )
    return {
      title: messages.reminders.status.exactPending,
      description: messages.reminders.status.exactPendingHint,
      error: false,
      action: 'edit',
    };
  if (schedule?.deliveryFailed)
    return {
      title: messages.reminders.status.deliveryFailed,
      description: messages.reminders.status.testHint,
      error: true,
      action: 'edit',
    };
  if (
    schedule?.planningState !== 'scheduled' ||
    schedule.nextTriggerAtMillis === null ||
    availability !== 'available' ||
    (reminder.deliveryMode === 'punctualWithSound' &&
      (!status || schedule.isExact === null))
  )
    return {
      title: messages.reminders.status.unknown,
      description: messages.reminders.status.unknownHint,
      error: false,
      action: 'edit',
    };
  const due = schedule.nextTriggerAtMillis <= now;
  return {
    title: due
      ? messages.reminders.status.overdue
      : messages.reminders.status.next,
    description:
      dateTime(schedule.nextTriggerAtMillis) +
      messages.reminders.timeSuffix +
      (due ? messages.reminders.status.overdueHint : ''),
    error: false,
    action: null,
  };
}
