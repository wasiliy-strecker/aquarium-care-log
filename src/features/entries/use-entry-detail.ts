import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useServices } from '../../core/composition';
import { useTask } from '../../core/ui/use-task';
import { useFeedback } from '../../core/ui/feedback';
import { errorText } from '../../core/ui/components';
import type { CareEntry, Aquarium } from '../../core/domain/models';
export function useEntryDetail(id: string) {
  const { aquariumService, revision, refresh } = useServices();
  const [entry, setEntry] = useState<CareEntry>(),
    [aquarium, setAquarium] = useState<Aquarium>(),
    [loading, setLoading] = useState(true);
  const task = useTask(),
    feedback = useFeedback();
  const { setError } = task;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        aquariumService.repository.entry(id),
        aquariumService.repository.aquariums(),
      ])
        .then(([entry, aquariums]) => {
          if (active) {
            setEntry(entry ?? undefined);
            setAquarium(aquariums.find((r) => r.id === entry?.aquariumId));
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // Revision/retry tokens intentionally reload persisted data on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aquariumService, id, revision, setError]),
  );
  return {
    entry,
    aquarium,
    loading,
    ...task,
    remove: async () => {
      if (!entry) return;
      if (
        !(await feedback.confirm(
          'Eintrag löschen?',
          'Der Pflegeeintrag, seine Fotos und PDF-Protokolle werden gelöscht.',
        ))
      )
        return;
      await task.run(async () => {
        const warnings = await aquariumService.delete('entry', id);
        refresh();
        router.dismissTo({
          pathname: '/aquarium/[id]',
          params: { id: entry.aquariumId },
        });
        feedback.notify(warnings.join('\n') || 'Eintrag gelöscht.');
      });
    },
  };
}
