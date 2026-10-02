import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { PermissionsAndroid, Platform } from 'react-native';
import { useServices } from '../../core/composition';
import {
  aquariumSchema,
  numberInput,
  parseDecimal,
  type AquariumForm,
  type Reminder,
} from '../../core/domain/models';
import { useTask } from '../../core/ui/use-task';
import { errorText } from '../../core/ui/components';
import { useFeedback } from '../../core/ui/feedback';
import { useLeaveGuard } from '../../core/ui/use-leave-guard';
export function useAquariumEditor(id?: string) {
  const { aquariumService, refresh, native } = useServices();
  const feedback = useFeedback();
  const [aquarium, setAquarium] = useState<AquariumForm | undefined>(() => {
    if (id) return;
    const now = aquariumService.env.now();
    return {
      id: aquariumService.env.id(),
      name: '',
      volume: '',
      dimensions: '',
      location: '',
      reminder: null,
      createdAt: now,
      updatedAt: now,
    };
  });
  const [initial, setInitial] = useState(() => JSON.stringify(aquarium));
  const [initialReady, setReady] = useState(!id);
  const task = useTask();
  const { setError } = task;
  useEffect(() => {
    let active = true;
    aquariumService.repository
      .aquariums()
      .then((aquariums) => {
        if (!active) return;
        if (id) {
          const found = aquariums.find((r) => r.id === id);
          if (!found) throw new Error('Das Aquarium wurde nicht gefunden.');
          const { volumeLiters, ...fields } = found;
          const form = { ...fields, volume: numberInput(volumeLiters) };
          setAquarium(form);
          setInitial(JSON.stringify(form));
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [aquariumService, id, setError]);
  const dirty = initialReady && JSON.stringify(aquarium) !== initial;
  const leave = useLeaveGuard({
    dirty,
    busy: task.busy,
    discard: async () => {},
    title: id ? 'Änderungen verwerfen?' : 'Eingaben verwerfen?',
  });
  function change<K extends keyof AquariumForm>(
    key: K,
    value: AquariumForm[K],
  ) {
    setAquarium((current) => current && { ...current, [key]: value });
  }
  return {
    aquarium,
    dirty,
    change,
    ...task,
    reminder: (value: Partial<Reminder>) => {
      if (aquarium?.reminder)
        change('reminder', { ...aquarium.reminder, ...value });
    },
    toggleReminder: (enabled: boolean) =>
      change(
        'reminder',
        enabled
          ? {
              interval: 'monthly',
              day: 1,
              month: 1,
              hour: 9,
              minute: 0,
              deliveryMode: 'normal',
              startsAtMillis: Date.now() + 3600000,
            }
          : null,
      ),
    testReminder: (punctual: boolean) =>
      task.run(async () => {
        const result = await native.testReminder(punctual);
        feedback.notify(
          result === 'posted'
            ? 'Test-Erinnerung gesendet. Sie verschwindet nach einer Minute.'
            : 'Die Erinnerung ist in Android blockiert. Bitte die Benachrichtigungseinstellungen prüfen.',
        );
      }),
    openReminderSettings: (exact: boolean) =>
      task.run(() => native.openReminderSettings(exact)),
    save: () =>
      task.run(async () => {
        if (!aquarium) return;
        const { volume, ...fields } = aquarium;
        const saved = aquariumSchema.parse({
          ...fields,
          volumeLiters: parseDecimal(volume, 'Volumen'),
        });
        if (
          aquarium.reminder &&
          Platform.OS === 'android' &&
          Number(Platform.Version) >= 33
        )
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        const warnings = await aquariumService.saveAquarium(saved);
        refresh();
        leave(() => {
          if (id)
            router.dismissTo({
              pathname: '/aquarium/[id]',
              params: { id: aquarium.id },
            });
          else
            router.replace({
              pathname: '/aquarium/[id]',
              params: { id: aquarium.id },
            });
        });
        feedback.notify(
          warnings.join('\n') ||
            (id
              ? 'Änderungen am Aquarium gespeichert.'
              : 'Aquarium gespeichert. Als Nächstes kannst du den ersten Eintrag erfassen.'),
        );
      }),
  };
}
