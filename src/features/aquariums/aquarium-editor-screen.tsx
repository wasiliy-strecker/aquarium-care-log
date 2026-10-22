import { useRef } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Body,
  Button,
  Busy,
  Field,
  Notice,
  Page,
} from '../../core/ui/components';
import { FormErrorScroll } from '../../core/ui/form-error-scroll';
import { useAquariumEditor } from './use-aquarium-editor';
import { ReminderEditor } from './reminder-editor';

export function AquariumEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const vm = useAquariumEditor(id);
  const anchors = useRef<Record<string, View | null>>({});
  const aquarium = vm.aquarium;
  if (!aquarium)
    return (
      <Page ready={!!vm.error}>
        <Notice error text={vm.error} />
        {!vm.error && <Busy />}
      </Page>
    );
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
          {vm.reminderNeedsRepair && (
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
                : vm.reminderNeedsRepair && !vm.dirty
                  ? 'Erinnerung erneut speichern'
                  : id
                    ? 'Änderungen speichern'
                    : 'Aquarium speichern'
            }
            disabled={vm.busy}
            onPress={() => void vm.save()}
          />
        </>
      }
    >
      <Stack.Screen
        options={{ title: id ? 'Aquarium bearbeiten' : 'Aquarium anlegen' }}
      />
      <FormErrorScroll target={vm.errorTarget} anchors={anchors} />
      <Notice error text={vm.error} />
      <View style={{ gap: 16 }}>
        <View
          collapsable={false}
          ref={(node) => {
            anchors.current.name = node;
          }}
        >
          <Field
            label="Name *"
            value={aquarium.name}
            error={vm.fieldErrors.name}
            onChangeText={(value) => vm.change('name', value)}
            editable={!vm.busy}
          />
        </View>
        <View
          collapsable={false}
          ref={(node) => {
            anchors.current.volume = node;
          }}
        >
          <Field
            label="Volumen in Litern (optional)"
            value={aquarium.volume}
            keyboardType="decimal-pad"
            error={vm.fieldErrors.volume}
            onChangeText={(value) => vm.change('volume', value)}
            editable={!vm.busy}
          />
        </View>
        <View
          collapsable={false}
          ref={(node) => {
            anchors.current.dimensions = node;
          }}
        >
          <Field
            label="Maße (optional)"
            placeholder="z. B. 100 × 40 × 50 cm"
            value={aquarium.dimensions}
            error={vm.fieldErrors.dimensions}
            onChangeText={(value) => vm.change('dimensions', value)}
            editable={!vm.busy}
          />
        </View>
        <View
          collapsable={false}
          ref={(node) => {
            anchors.current.location = node;
          }}
        >
          <Field
            label="Standort (optional)"
            value={aquarium.location}
            error={vm.fieldErrors.location}
            onChangeText={(value) => vm.change('location', value)}
            editable={!vm.busy}
          />
        </View>
        <ReminderEditor
          reminder={aquarium.reminder}
          onChange={(value) => vm.change('reminder', value)}
          busy={vm.busy}
          status={vm.reminderStatus}
          refreshStatus={vm.refreshReminderStatus}
          aquariumId={id ?? null}
          label={aquarium.name}
          categoryLabel="Aquarium"
        />
      </View>
    </Page>
  );
}
