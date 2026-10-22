import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { PermissionsAndroid, Platform } from 'react-native';
import { useServices } from '../../core/composition';
import {
  aquariumSchema,
  numberInput,
  parseDecimal,
  type AquariumForm,
} from '../../core/domain/models';
import { useTask } from '../../core/ui/use-task';
import { errorText } from '../../core/ui/components';
import { useFeedback } from '../../core/ui/feedback';
import { useLeaveGuard } from '../../core/ui/use-leave-guard';
import { useFormErrors } from '../../core/ui/use-form-errors';
import {
  validateAquariumForm,
  aquariumFieldOrder,
} from './aquarium-form-validation';
import { useReminderStatusSnapshot } from './use-reminder-status';
import {
  needsReminderRepair,
  reminderSchedule,
  reminderSaveWarning,
} from './reminder-model';
export function useAquariumEditor(id?: string) {
  const { aquariumService, refresh, native } = useServices();
  const feedback = useFeedback();
  const formErrors = useFormErrors();
  const reminderState = useReminderStatusSnapshot();
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
    formErrors.clear(key);
    setAquarium((current) => current && { ...current, [key]: value });
  }
  return {
    aquarium,
    fieldErrors: formErrors.fieldErrors,
    errorTarget: formErrors.errorTarget,
    reminderStatus: reminderState.status,
    refreshReminderStatus: reminderState.refresh,
    reminderNeedsRepair:
      !!id &&
      reminderState.loaded &&
      needsReminderRepair(
        aquarium?.reminder ?? null,
        reminderSchedule(reminderState.status, id),
      ),
    dirty,
    change,
    ...task,
    save: () =>
      task.run(async () => {
        if (!aquarium) return;
        const errors = validateAquariumForm(aquarium);
        if (Object.keys(errors).length) {
          formErrors.show(errors, aquariumFieldOrder);
          return;
        }
        formErrors.clear();
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
        const status = await native.reminderStatus().catch(() => undefined);
        const reminderWarning = reminderSaveWarning(
          saved.reminder,
          status,
          saved.id,
        );
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
          reminderWarning ||
            warnings.join('\n') ||
            (id
              ? 'Änderungen am Aquarium gespeichert.'
              : 'Aquarium gespeichert. Als Nächstes kannst du den ersten Eintrag erfassen.'),
        );
      }),
  };
}
