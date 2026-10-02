import { requireNativeModule } from 'expo';
export type ReminderStatus = {
  notifications: boolean;
  exact: boolean;
  doNotDisturb: boolean | null;
  schedules: {
    aquariumId: string;
    nextTriggerAtMillis: number | null;
    planningState: string;
    isExact: boolean | null;
    deliveryFailed: boolean;
    isNotificationActive: boolean;
    lastTriggeredAtMillis: number | null;
  }[];
};
export interface AquariumNative {
  validatePhoto(uri: string): Promise<void>;
  saveBackupFile(
    uri: string,
    name: string,
  ): Promise<{ status: 'saved' | 'cancelled'; name: string }>;
  deriveBackupKey(
    password: string,
    salt: string,
    iterations: number,
  ): Promise<string>;
  syncReminders(json: string): Promise<string[]>;
  reminderStatus(): Promise<ReminderStatus>;
  acknowledge(id: string): Promise<void>;
  testReminder(punctual: boolean): Promise<string>;
  openReminderSettings(exact: boolean): Promise<void>;
}
export const aquariumNative =
  requireNativeModule<AquariumNative>('AquariumNative');
