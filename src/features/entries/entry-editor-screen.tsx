import { useRef } from 'react';
import { FormErrorScroll } from '../../core/ui/form-error-scroll';
import { PhotoExamplesButton } from './photo-examples-button';
import { ActivityField } from './activity-field';
import { PhotoHints } from '../media/photo-hints';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Body,
  Button,
  Busy,
  Card,
  DateField,
  Field,
  Notice,
  Page,
} from '../../core/ui/components';
import { measurementLabels } from '../../core/domain/models';
import { SuggestionField } from '../../core/ui/suggestion-field';
import { PhotoEditor, type AttachmentActions } from '../media/attachments';
import { useEntryEditor } from './use-entry-editor';
export function EntryEditorScreen() {
  const { aquariumId, entryId } = useLocalSearchParams<{
    aquariumId: string;
    entryId?: string;
  }>();
  const vm = useEntryEditor(aquariumId, entryId);
  const anchors = useRef<Record<string, View | null>>({});
  const draft = vm.draft;
  if (!draft)
    return (
      <Page ready={!!vm.error}>
        <Notice error text={vm.error} />
        {!vm.error && <Busy />}
      </Page>
    );
  const form = draft.form,
    photos = form.attachments;
  const actions: AttachmentActions = {
    busy: vm.busy,
    pick: vm.pick,
    remove: vm.remove,
    move: vm.move,
    reorder: vm.reorderKind,
  };
  return (
    <Page>
      <Stack.Screen
        options={{ title: entryId ? 'Eintrag bearbeiten' : 'Eintrag erfassen' }}
      />
      <FormErrorScroll target={vm.errorTarget} anchors={anchors} />
      <Notice error text={vm.error} />
      <Notice text={vm.notice} />
      {vm.phase === 'choose' ? (
        <>
          <Card>
            <Body strong style={{ fontSize: 16 }}>
              Veränderungen festhalten
            </Body>
            <View style={{ gap: 4 }}>
              <Body>
                • Aquarium oder Pflegeschritt gut sichtbar fotografieren
              </Body>
              <Body>• Spiegelungen und Schatten vermeiden</Body>
              <Body>• Für Vergleiche einen ähnlichen Blickwinkel wählen</Body>
            </View>
            <Body muted>
              Fotos werden für die lokale Speicherung auf maximal 1920 Pixel
              verkleinert und als JPEG optimiert. Aufnahme- und
              Standortmetadaten werden nicht übernommen. Einen Messwert kannst
              du optional selbst eintragen.
            </Body>
          </Card>
          <PhotoHints disabled={vm.busy} />
          <PhotoExamplesButton disabled={vm.busy} />
          <Button
            icon="edit_note_outlined"
            title="Ohne Foto erfassen"
            disabled={vm.busy}
            onPress={() => void vm.chooseManual()}
          />
          <Button
            secondary
            icon="photo_camera_outlined"
            title="Aquarium fotografieren"
            disabled={vm.busy}
            onPress={() => void vm.pick('camera')}
          />
          <Button
            secondary
            icon="photo_library_outlined"
            title="Fotos aus Galerie"
            disabled={vm.busy}
            onPress={() => void vm.pick('gallery')}
          />
        </>
      ) : (
        <View style={{ gap: 16 }}>
          <View
            collapsable={false}
            ref={(node) => {
              anchors.current.activity = node;
            }}
          >
            <ActivityField
              error={vm.fieldErrors.activity}
              value={form.activity}
              suggestions={vm.activities}
              disabled={vm.busy}
              autoFocus={
                !entryId && draft.captureSource === 'manual' && !form.activity
              }
              onChange={(v) => vm.change('activity', v)}
            />
          </View>
          <View>
            <PhotoEditor photos={photos} actions={actions} />
          </View>
          <Card>
            <Body strong>Messwert (optional)</Body>
            <View
              collapsable={false}
              ref={(node) => {
                anchors.current.measurementLabel = node;
              }}
            >
              <SuggestionField
                error={vm.fieldErrors.measurementLabel}
                label="Bezeichnung"
                placeholder="z. B. Temperatur oder pH-Wert"
                helper="Eigene Messgrößen sind ebenfalls möglich."
                value={form.measurementLabel}
                suggestions={measurementLabels}
                disabled={vm.busy}
                onChange={(v) => vm.change('measurementLabel', v)}
              />
            </View>
            <View
              collapsable={false}
              ref={(node) => {
                anchors.current.value = node;
              }}
            >
              <Field
                error={vm.fieldErrors.value}
                label="Wert (optional)"
                keyboardType="numbers-and-punctuation"
                value={form.value}
                onChangeText={(v) => vm.change('value', v)}
                editable={!vm.busy}
              />
            </View>
            <View
              collapsable={false}
              ref={(node) => {
                anchors.current.unit = node;
              }}
            >
              <Field
                error={vm.fieldErrors.unit}
                label="Einheit (optional)"
                placeholder="z. B. °C. Bei pH leer lassen."
                value={form.unit}
                onChangeText={(v) => vm.change('unit', v)}
                editable={!vm.busy}
              />
            </View>
          </Card>
          <Card>
            <Body strong>Datum und Uhrzeit</Body>
            <View
              collapsable={false}
              ref={(node) => {
                anchors.current.occurredAt = node;
              }}
            >
              <DateField
                timezoneOffsetMinutes={form.timezoneOffsetMinutes}
                label="Zeitpunkt des Eintrags"
                time
                value={form.occurredAt}
                onChange={(v) => vm.change('occurredAt', v)}
                disabled={vm.busy}
              />
              <Notice error text={vm.fieldErrors.occurredAt} />
            </View>
          </Card>
          <View
            collapsable={false}
            ref={(node) => {
              anchors.current.note = node;
            }}
          >
            <Field
              error={vm.fieldErrors.note}
              label="Notiz"
              multiline
              value={form.note}
              onChangeText={(v) => vm.change('note', v)}
              editable={!vm.busy}
            />
          </View>
          <Button
            icon={
              entryId || draft.captureSource !== 'photo'
                ? 'save_outlined'
                : 'verified_outlined'
            }
            title={
              vm.busy
                ? 'Wird gespeichert …'
                : entryId
                  ? 'Änderungen speichern'
                  : draft.captureSource === 'photo'
                    ? 'Eintrag bestätigen und speichern'
                    : 'Eintrag speichern'
            }
            disabled={vm.busy}
            onPress={() => void vm.save()}
          />
        </View>
      )}
      {vm.busy && <Busy label="Eingaben und Fotos werden verarbeitet …" />}
    </Page>
  );
}
