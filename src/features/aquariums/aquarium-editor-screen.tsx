import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMaterialDateTime } from '../../core/ui/material-date-time';
import {
  Body,
  Button,
  Busy,
  Card,
  DateField,
  Field,
  Notice,
  Page,
  SelectField,
  MaterialSwitch,
  useTheme,
} from '../../core/ui/components';
import { Icon } from '../../core/ui/icon';
import type { Reminder } from '../../core/domain/models';
import { useAquariumEditor } from './use-aquarium-editor';
import { useReminderStatus } from './use-aquariums';
import { needsReminderRepair } from './reminder-repair';
const intervals: Record<Reminder['interval'], string> = {
  hourly: 'Stündlich',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};
const weekdays = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];
export function AquariumEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useAquariumEditor(id),
    c = useTheme(),
    status = useReminderStatus(),
    picker = useMaterialDateTime();
  const r = vm.aquarium;
  if (!r)
    return (
      <Page ready={!!vm.error}>
        <Notice error text={vm.error} />
        {!vm.error && <Busy />}
      </Page>
    );
  const reminder = r.reminder;
  const repair = !!id && needsReminderRepair(r, status);
  const time = reminder
    ? `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')} Uhr`
    : '';
  async function pickTime() {
    const date = new Date();
    date.setHours(reminder!.hour, reminder!.minute);
    const value = await picker.time(date);
    if (value)
      vm.reminder({ hour: value.getHours(), minute: value.getMinutes() });
  }
  return (
    <Page
      bottom={
        <>
          {!id && (
            <Body muted style={{ fontSize: 12 }}>
              Speichere zuerst das Aquarium. Anschließend kannst du den ersten
              Pflegeeintrag mit oder ohne Fotos erfassen.
            </Body>
          )}
          {repair && (
            <Body>
              Die Erinnerung ist nicht bestätigt. Mit Speichern wird sie erneut
              eingerichtet.
            </Body>
          )}
          <Button
            icon={id && !vm.dirty ? 'check_circle_outline' : 'save_outlined'}
            title={
              vm.busy
                ? 'Wird gespeichert …'
                : repair && !vm.dirty
                  ? 'Erinnerung erneut speichern'
                  : id && !vm.dirty
                    ? 'Alles gespeichert'
                    : id
                      ? 'Änderungen speichern'
                      : 'Aquarium speichern'
            }
            disabled={vm.busy || (!vm.dirty && !repair)}
            onPress={() => void vm.save()}
          />
        </>
      }
    >
      {picker.dialog}
      <Stack.Screen
        options={{ title: id ? 'Aquarium bearbeiten' : 'Aquarium anlegen' }}
      />
      <View style={{ gap: 16 }}>
        <Notice error text={vm.error} />
        <Field
          label="Aquarienname *"
          placeholder="z. B. Wohnzimmer-Aquarium"
          value={r.name}
          onChangeText={(v) => vm.change('name', v)}
          editable={!vm.busy}
        />
        <Field
          label="Volumen (optional)"
          suffix="l"
          keyboardType="decimal-pad"
          value={r.volume}
          onChangeText={(v) => vm.change('volume', v)}
          editable={!vm.busy}
        />
        <Field
          label="Maße (optional)"
          placeholder="z. B. 100 × 40 × 50 cm"
          value={r.dimensions}
          onChangeText={(v) => vm.change('dimensions', v)}
          editable={!vm.busy}
        />
        <Field
          label="Standort (optional)"
          placeholder="z. B. Wohnzimmer"
          value={r.location}
          onChangeText={(v) => vm.change('location', v)}
          editable={!vm.busy}
        />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontSize: 16 }}>Pflegeerinnerung</Body>
              <Body muted>Optional und nur lokal auf diesem Gerät</Body>
            </View>
            <MaterialSwitch
              label="Erinnerung aktivieren"
              value={!!reminder}
              disabled={vm.busy}
              onValueChange={vm.toggleReminder}
            />
          </View>
          {reminder && (
            <View style={{ gap: 16 }}>
              <SelectField
                label="Intervall"
                value={reminder.interval}
                options={Object.entries(intervals).map(([value, label]) => ({
                  value,
                  label,
                }))}
                disabled={vm.busy}
                onChange={(value) =>
                  vm.reminder({
                    interval: value as Reminder['interval'],
                    day:
                      value === 'weekly'
                        ? Math.min(reminder.day, 7)
                        : reminder.day,
                  })
                }
              />
              {reminder.interval === 'yearly' && (
                <SelectField
                  label="Monat"
                  value={String(reminder.month)}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1),
                    label: new Date(2026, i, 1).toLocaleString('de-DE', {
                      month: 'long',
                    }),
                  }))}
                  onChange={(v) => vm.reminder({ month: Number(v) })}
                />
              )}
              {reminder.interval === 'weekly' && (
                <SelectField
                  label="Wochentag"
                  value={String(reminder.day)}
                  options={weekdays.map((label, i) => ({
                    label,
                    value: String(i + 1),
                  }))}
                  onChange={(v) => vm.reminder({ day: Number(v) })}
                />
              )}
              {(reminder.interval === 'monthly' ||
                reminder.interval === 'yearly') && (
                <SelectField
                  label="Tag"
                  value={String(reminder.day)}
                  options={Array.from({ length: 31 }, (_, i) => String(i + 1))}
                  onChange={(v) => vm.reminder({ day: Number(v) })}
                />
              )}
              {reminder.interval === 'hourly' ? (
                <DateField
                  label="Erster Termin"
                  time
                  value={new Date(reminder.startsAtMillis).toISOString()}
                  onChange={(v) =>
                    vm.reminder({ startsAtMillis: new Date(v).getTime() })
                  }
                />
              ) : (
                <View style={{ gap: 8 }}>
                  <Body>Uhrzeit: {time}</Body>
                  <Button
                    secondary
                    icon="schedule"
                    title="Uhrzeit ändern"
                    onPress={() => void pickTime()}
                  />
                </View>
              )}
              {(['normal', 'punctualWithSound'] as const).map((mode) => (
                <Card
                  key={mode}
                  onPress={() => vm.reminder({ deliveryMode: mode })}
                  style={{
                    borderColor:
                      reminder.deliveryMode === mode ? c.primary : c.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Icon
                      name={
                        reminder.deliveryMode === mode
                          ? 'check_circle_outline'
                          : 'notifications_active_outlined'
                      }
                      color={c.primary}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Body strong>
                        {mode === 'normal'
                          ? 'Normale Erinnerung'
                          : 'Pünktlich mit Ton'}
                      </Body>
                      <Body muted>
                        {mode === 'normal'
                          ? 'Android kann die Erinnerung etwas später anzeigen.'
                          : 'Benötigt die Freigabe für genaue Alarme. Android-Einstellungen können den Ton beeinflussen.'}
                      </Body>
                    </View>
                  </View>
                </Card>
              ))}
              {status && !status.notifications && (
                <>
                  <Notice
                    error
                    text="Benachrichtigungen sind in Android blockiert."
                  />
                  <Button
                    secondary
                    title="Benachrichtigungen erlauben"
                    onPress={() => void vm.openReminderSettings(false)}
                  />
                </>
              )}
              {reminder.deliveryMode === 'punctualWithSound' &&
                status &&
                !status.exact && (
                  <>
                    <Notice text="Ohne Freigabe für genaue Alarme erinnert Android möglicherweise später." />
                    <Button
                      secondary
                      title="Alarme & Erinnerungen erlauben"
                      onPress={() => void vm.openReminderSettings(true)}
                    />
                  </>
                )}
              <Button
                secondary
                icon="notifications_active_outlined"
                title="Erinnerung testen"
                disabled={vm.busy}
                onPress={() =>
                  void vm.testReminder(
                    reminder.deliveryMode === 'punctualWithSound',
                  )
                }
              />
            </View>
          )}
        </Card>
      </View>
    </Page>
  );
}
