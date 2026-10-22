import { messages } from '../../core/texts';
import { View } from 'react-native';
import { Body, Button, useTheme } from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import { useServices } from '../../core/composition';
import { useFeedback } from '../../core/ui/feedback';
import type { Reminder } from '../../core/domain/models';
import type { ReminderStatus } from '../../core/native/aquarium-native';
import {
  reminderPresentation,
  reminderSettingsFailure,
} from './reminder-model';

export function ReminderScheduleStatus({
  reminder,
  status,
  aquariumId,
  onEdit,
}: {
  reminder: Reminder | null;
  status?: ReminderStatus;
  aquariumId: string;
  onEdit(): void;
}) {
  const c = useTheme(),
    { native } = useServices(),
    feedback = useFeedback();
  const display = reminderPresentation(reminder, status, aquariumId);
  if (!display) return null;
  const color = display.error ? c.onErrorContainer : c.ink;
  async function act() {
    if (display!.action === 'edit') {
      onEdit();
      return;
    }
    const target = display!.action;
    if (!target) return;
    try {
      if (
        await native.openReminderSettings(
          target,
          target === 'channel' ? (reminder?.deliveryMode ?? 'normal') : null,
        )
      )
        return;
    } catch {
      /* Keep a manual path to Android settings. */
    }
    feedback.notify(reminderSettingsFailure(target));
  }
  return (
    <View
      style={{
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: display.error ? c.errorContainer : c.soft,
        borderWidth: 1,
        borderColor: display.error ? c.danger : c.primary + '59',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Icon
          name={display.error ? 'error_outline' : 'schedule'}
          size={20}
          color={color}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Body strong style={{ color, fontSize: 12 }}>
            {display.title}
          </Body>
          <Body style={{ color }}>{display.description}</Body>
        </View>
      </View>
      {display.action && (
        <Button
          secondary
          icon="settings_outlined"
          title={
            display.action === 'edit'
              ? messages.reminders.edit
              : messages.reminders.openSettings
          }
          onPress={() => void act()}
        />
      )}
    </View>
  );
}
