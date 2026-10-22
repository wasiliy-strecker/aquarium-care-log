import { requireNativeModule } from 'expo';
import type { Reminder } from '../domain/models';
export type ReminderAvailability =
  'available' | 'appBlocked' | 'channelBlocked' | 'unknown';
export type ReminderSettingsTarget =
  'notifications' | 'channel' | 'exact' | 'doNotDisturb';
export type ReminderTestResult =
  'posted' | 'appBlocked' | 'channelBlocked' | 'failed' | 'unknown';
export type ReminderTestRequest = {
  aquariumId: string | null;
  label: string;
  categoryLabel: string;
  latestValue: string | null;
  deliveryMode: Reminder['deliveryMode'];
};
export type ReminderScheduleStatus = {
  aquariumId: string;
  nextTriggerAtMillis: number | null;
  planningState: string;
  isExact: boolean | null;
  deliveryFailed: boolean;
  isNotificationActive: boolean;
  lastTriggeredAtMillis: number | null;
};
export type ReminderStatus = {
  notifications: boolean;
  exact: boolean;
  doNotDisturb: boolean | null;
  availability: Record<Reminder['deliveryMode'], ReminderAvailability>;
  schedules: ReminderScheduleStatus[];
};
export type PdfSession = {
  session: string;
  pages: { width: number; height: number }[];
};
export interface AquariumNative {
  openPdfPreview(uri: string): Promise<PdfSession>;
  renderPdfPage(session: string, index: number, width: number): Promise<string>;
  closePdfPreview(session: string): Promise<void>;
  printPdf(uri: string, name: string): Promise<void>;
  sharePdfs(uris: string[]): Promise<void>;
  saveBackupFile(
    uri: string,
    name: string,
  ): Promise<{ status: 'saved' | 'cancelled'; name: string }>;
  deriveBackupKey(
    password: string,
    salt: string,
    iterations: number,
  ): Promise<string>;
  validatePhoto(uri: string): Promise<void>;
  syncReminders(json: string): Promise<string[]>;
  reminderStatus(): Promise<ReminderStatus>;
  acknowledge(id: string): Promise<void>;
  testReminder(request: ReminderTestRequest): Promise<ReminderTestResult>;
  openReminderSettings(
    target: ReminderSettingsTarget,
    deliveryMode: Reminder['deliveryMode'] | null,
  ): Promise<boolean>;
}
export const aquariumNative =
  requireNativeModule<AquariumNative>('AquariumNative');
