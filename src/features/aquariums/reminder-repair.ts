import type { Aquarium } from '../../core/domain/models';
import type { ReminderStatus } from '../../core/native/aquarium-native';

export function needsReminderRepair(
  aquarium: Pick<Aquarium, 'id' | 'reminder'>,
  status?: ReminderStatus,
): boolean {
  if (!status) return false;
  const schedule = status.schedules.find(
    (item) => item.aquariumId === aquarium.id,
  );
  return (
    schedule?.planningState === 'cancelFailed' ||
    (!!aquarium.reminder &&
      (schedule?.planningState !== 'scheduled' ||
        !schedule.nextTriggerAtMillis ||
        (aquarium.reminder.deliveryMode === 'punctualWithSound' &&
          schedule.isExact === false)))
  );
}
