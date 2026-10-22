import { messages } from '../../core/texts';
import { Platform, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  MaterialSwitch,
  Notice,
  SelectField,
  useTheme,
} from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { useMaterialDateTime } from '../../core/ui/material-date-time';
import type { Reminder } from '../../core/domain/models';
import type { ReminderStatus } from '../../core/native/aquarium-native';
import { useReminderEditor } from './use-reminder-editor';
import {
  reminderIntervals,
  weekdays,
  reminderModes,
  reminderAvailability,
  nextHourlyTrigger,
  testReminderHint,
} from './reminder-model';
import { dateTime } from './presentation-model';

export function ReminderEditor(props: {
  reminder: Reminder | null;
  busy: boolean;
  onChange(value: Reminder | null): void;
  status?: ReminderStatus;
  refreshStatus(): Promise<ReminderStatus | undefined>;
  aquariumId: string | null;
  label: string;
  categoryLabel: string;
}) {
  const { reminder, status } = props;
  const c = useTheme(),
    picker = useMaterialDateTime(),
    vm = useReminderEditor(props);
  const availability = reminder
    ? reminderAvailability(status, reminder.deliveryMode)
    : 'unknown';
  const start = new Date(reminder?.startsAtMillis ?? 0);
  const timeText = (date: Date) =>
    date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  async function pickDate() {
    const date = await picker.date(start);
    if (date) vm.setHourlyStart(date, start);
  }
  async function pickTime() {
    const current = reminder!.interval === 'hourly' ? start : new Date();
    if (reminder!.interval !== 'hourly')
      current.setHours(reminder!.hour, reminder!.minute, 0, 0);
    const time = await picker.time(current);
    if (time) {
      if (reminder!.interval === 'hourly') vm.setHourlyStart(start, time);
      else vm.patch({ hour: time.getHours(), minute: time.getMinutes() });
    }
  }
  return (
    <>
      {picker.dialog}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Body style={{ fontSize: 16 }}>{messages.reminders.title}</Body>
            <Body muted>{messages.reminders.helper}</Body>
          </View>
          <MaterialSwitch
            label={messages.reminders.enable}
            value={!!reminder}
            disabled={vm.disabled}
            onValueChange={vm.toggle}
          />
        </View>
        {reminder && (
          <View style={{ gap: 16 }}>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <SelectField
              label={messages.reminders.interval}
              value={reminder.interval}
              disabled={vm.disabled}
              options={Object.entries(reminderIntervals).map(
                ([value, label]) => ({ value, label }),
              )}
              onChange={(value) => vm.interval(value as Reminder['interval'])}
            />
            {reminder.interval === 'yearly' && (
              <SelectField
                label={messages.reminders.month}
                value={String(reminder.month)}
                disabled={vm.disabled}
                options={Array.from({ length: 12 }, (_, i) => String(i + 1))}
                onChange={(value) => vm.patch({ month: Number(value) })}
              />
            )}
            {reminder.interval === 'weekly' && (
              <SelectField
                label={messages.reminders.weekday}
                value={String(reminder.day)}
                disabled={vm.disabled}
                options={weekdays.map((label, i) => ({
                  label,
                  value: String(i + 1),
                }))}
                onChange={(value) => vm.patch({ day: Number(value) })}
              />
            )}
            {(reminder.interval === 'monthly' ||
              reminder.interval === 'yearly') && (
              <SelectField
                label={messages.reminders.day}
                value={String(reminder.day)}
                disabled={vm.disabled}
                options={[
                  ...Array.from({ length: 28 }, (_, i) => i + 1),
                  ...(reminder.day > 28 ? [reminder.day] : []),
                ].map((day) => ({ value: String(day), label: day + '.' }))}
                onChange={(value) => vm.patch({ day: Number(value) })}
              />
            )}
            {reminder.interval === 'hourly' ? (
              <>
                <View style={{ gap: 4 }}>
                  <Body strong>{messages.reminders.startDate}</Body>
                  <Body>{start.toLocaleDateString('de-DE')}</Body>
                </View>
                <Button
                  secondary
                  icon="calendar_month_outlined"
                  title={messages.reminders.changeDate}
                  disabled={vm.disabled}
                  onPress={() => void pickDate()}
                />
                <View style={{ gap: 4 }}>
                  <Body strong>{messages.reminders.startTime}</Body>
                  <Body>{timeText(start)}</Body>
                </View>
                <Button
                  secondary
                  icon="schedule"
                  title={messages.reminders.changeTime}
                  disabled={vm.disabled}
                  onPress={() => void pickTime()}
                />
                <Body muted>
                  {messages.reminders.hourlyHint +
                    dateTime(nextHourlyTrigger(reminder.startsAtMillis)) +
                    messages.reminders.timeSuffix +
                    '.'}
                </Body>
              </>
            ) : (
              <>
                <View style={{ gap: 4 }}>
                  <Body strong>{messages.reminders.time}</Body>
                  <Body>
                    {String(reminder.hour).padStart(2, '0') +
                      ':' +
                      String(reminder.minute).padStart(2, '0')}
                  </Body>
                </View>
                <Button
                  secondary
                  icon="schedule"
                  title={messages.reminders.changeTime}
                  disabled={vm.disabled}
                  onPress={() => void pickTime()}
                />
              </>
            )}
            <Body strong>{messages.reminders.deliveryMode}</Body>
            {(['normal', 'punctualWithSound'] as const).map((mode) => (
              <Card
                key={mode}
                onPress={
                  vm.disabled ? undefined : () => void vm.selectMode(mode)
                }
                style={{
                  borderColor:
                    reminder.deliveryMode === mode ? c.primary : c.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Icon name={reminderModes[mode].icon} color={c.primary} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Body strong>{reminderModes[mode].title}</Body>
                    <Body muted>{reminderModes[mode].description}</Body>
                  </View>
                  <Icon
                    name={
                      reminder.deliveryMode === mode
                        ? 'check_circle_outline'
                        : 'radio_button_unchecked'
                    }
                    color={reminder.deliveryMode === mode ? c.primary : c.muted}
                  />
                </View>
              </Card>
            ))}
            {reminder.deliveryMode === 'punctualWithSound' &&
              status?.exact === false && (
                <Card style={{ backgroundColor: c.errorContainer }}>
                  <Body>{messages.reminders.exactHint}</Body>
                  <Button
                    secondary
                    icon="settings_outlined"
                    title={messages.reminders.allowExact}
                    disabled={vm.disabled}
                    onPress={() => void vm.selectMode('punctualWithSound')}
                  />
                </Card>
              )}
            {Platform.OS === 'android' && Number(Platform.Version) >= 31 && (
              <Button
                secondary
                icon="open_in_new"
                title={messages.reminders.openExact}
                disabled={vm.disabled}
                onPress={() => void vm.open('exact')}
              />
            )}
            {availability === 'appBlocked' ||
            availability === 'channelBlocked' ? (
              <Card style={{ backgroundColor: c.errorContainer }}>
                <Body strong>
                  {availability === 'appBlocked'
                    ? messages.reminders.appBlocked
                    : messages.reminders.channelBlocked}
                </Body>
                <Body>
                  {availability === 'appBlocked'
                    ? messages.reminders.appBlockedHint
                    : messages.reminders.channelBlockedHint}
                </Body>
                <Button
                  secondary
                  icon="settings_outlined"
                  title={messages.reminders.openSettings}
                  disabled={vm.disabled}
                  onPress={() =>
                    void vm.open(
                      availability === 'appBlocked'
                        ? 'notifications'
                        : 'channel',
                    )
                  }
                />
              </Card>
            ) : (
              status?.doNotDisturb === true && (
                <Card>
                  <Body strong>{messages.reminders.quiet}</Body>
                  <Body>
                    {reminder.deliveryMode === 'normal'
                      ? messages.reminders.quietNormalHint
                      : messages.reminders.quietPunctualHint}
                  </Body>
                  <Button
                    secondary
                    icon="settings_outlined"
                    title={messages.reminders.openSettings}
                    disabled={vm.disabled}
                    onPress={() => void vm.open('doNotDisturb')}
                  />
                </Card>
              )
            )}
            {availability === 'unknown' && (
              <Notice text={messages.reminders.unknownHint} />
            )}
            <Button
              secondary
              icon="notifications_active_outlined"
              title={
                vm.action === 'test'
                  ? messages.reminders.testing
                  : messages.reminders.test
              }
              disabled={vm.disabled}
              onPress={() => void vm.test()}
            />
            <Body>{testReminderHint}</Body>
          </View>
        )}
      </Card>
    </>
  );
}
