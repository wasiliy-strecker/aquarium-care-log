import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useServices } from '../../core/composition';
import {
  defaultActivities,
  entryForm,
  type Attachment,
  type EntryDraft,
  type EntryForm,
} from '../../core/domain/models';
import { useTask } from '../../core/ui/use-task';
import { errorText } from '../../core/ui/components';
import { useFeedback } from '../../core/ui/feedback';
import { useLeaveGuard } from '../../core/ui/use-leave-guard';
import { mergePhotos } from '../media/photo-selection';
import { capturePhase } from '../aquariums/presentation-model';
export function useEntryEditor(aquariumId: string, entryId?: string) {
  const { aquariumService, media, refresh } = useServices();
  const feedback = useFeedback();
  const [draft, setDraft] = useState<EntryDraft>(),
    [activities, setActivities] = useState(defaultActivities),
    [initialForm, setInitialForm] = useState('');
  const current = useRef<EntryDraft | undefined>(undefined),
    initial = useRef(''),
    committed = useRef(false);
  const task = useTask();
  const { setError, setNotice } = task;
  useEffect(() => {
    let active = true;
    (async () => {
      const [data, savedEntry] = await Promise.all([
        aquariumService.repository.snapshot(),
        entryId ? aquariumService.repository.entry(entryId) : null,
      ]);
      const aquarium = data.aquariums.find((r) => r.id === aquariumId);
      if (
        !aquarium ||
        (entryId && (!savedEntry || savedEntry.aquariumId !== aquariumId))
      )
        throw new Error('Aquarium oder Eintrag nicht gefunden.');
      const saved = await aquariumService.draft(
        aquariumId,
        savedEntry ?? undefined,
      );
      const original: EntryForm = savedEntry
        ? entryForm(savedEntry)
        : {
            activity: '',
            occurredAt: saved.createdAt,
            measurementLabel: '',
            value: '',
            unit: '',
            note: '',
            attachments: [],
          };
      if (active) {
        initial.current = JSON.stringify(original);
        setInitialForm(initial.current);
        current.current = saved;
        setDraft(saved);
        setActivities([...new Set([...defaultActivities, ...data.activities])]);
        if (saved.recoveryNotice) setNotice(saved.recoveryNotice);
      }
    })().catch((e) => setError(errorText(e)));
    return () => {
      active = false;
      const d = current.current;
      if (d && !committed.current && JSON.stringify(d.form) === initial.current)
        void aquariumService.discard(d).catch(() => {});
    };
  }, [aquariumService, aquariumId, entryId, setError, setNotice]);
  const dirty = !!draft && JSON.stringify(draft.form) !== initialForm;
  const leave = useLeaveGuard({
    dirty,
    busy: task.busy,
    title: entryId ? 'Änderungen verwerfen?' : 'Eintrag verwerfen?',
    discard: async () => {
      if (current.current) await aquariumService.discard(current.current);
      committed.current = true;
      refresh();
    },
  });
  function apply(next: EntryDraft) {
    current.current = next;
    setDraft(next);
    return aquariumService.persistDraft(next);
  }
  function change<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    if (!current.current) return;
    void apply({
      ...current.current,
      form: { ...current.current.form, [key]: value },
    }).catch((e) =>
      setError(`Entwurf konnte nicht gesichert werden: ${errorText(e)}`),
    );
  }
  function setAttachments(items: Attachment[]) {
    change('attachments', items);
  }
  return {
    draft,
    activities,
    dirty,
    phase: draft ? capturePhase(draft) : 'choose',
    change,
    setAttachments,
    ...task,
    chooseManual: () =>
      task.run(async () => {
        if (!current.current) return;
        const next = {
          ...current.current,
          captureStage: 'form' as const,
          captureSource: 'manual' as const,
        };
        await apply(next);
      }),
    pick: (source: NonNullable<EntryDraft['external']>, replaceId?: string) =>
      task.run(async () => {
        if (!current.current) return;
        await apply({
          ...current.current,
          external: source,
          externalReplaceId: replaceId,
        });
        const result = await media.pick(source, !replaceId);
        const before = current.current.form.attachments;
        try {
          const attachments = mergePhotos(
            before,
            result.attachments,
            replaceId,
          );
          await apply({
            ...current.current,
            external: null,
            externalReplaceId: undefined,
            captureStage: attachments.length
              ? 'form'
              : current.current.captureStage,
            captureSource:
              current.current.captureSource ??
              (attachments.length ? 'photo' : undefined),
            form: {
              ...current.current.form,
              attachments,
            },
          });
        } catch (error) {
          current.current = {
            ...current.current,
            form: { ...current.current.form, attachments: before },
          };
          setDraft(current.current);
          await aquariumService.cleanup(result.attachments.map((a) => a.file));
          throw error;
        }
        if (result.failures.length) setError(result.failures.join('\n'));
      }),
    remove: (id: string) =>
      setAttachments(
        (current.current?.form.attachments ?? []).filter((a) => a.id !== id),
      ),
    reorderKind: (items: Attachment[]) => {
      if (!items.length) return;
      const kind = items[0]!.kind;
      const all = current.current?.form.attachments ?? [];
      setAttachments([...all.filter((a) => a.kind !== kind), ...items]);
    },
    move: (id: string, delta: number) => {
      const items = [...(current.current?.form.attachments ?? [])];
      const index = items.findIndex((a) => a.id === id),
        item = items[index],
        next = items[index + delta];
      if (!item || !next || item.kind !== next.kind) return;
      items[index] = next;
      items[index + delta] = item;
      setAttachments(items);
    },
    save: () =>
      task.run(async () => {
        if (!current.current) return;
        await aquariumService.persistDraft(current.current);
        const result = await aquariumService.saveEntry(current.current);
        committed.current = true;
        refresh();
        leave(() => {
          if (entryId)
            router.dismissTo({
              pathname: '/entry/[id]',
              params: { id: result.entry.id },
            });
          else
            router.replace({
              pathname: '/entry/[id]',
              params: { id: result.entry.id },
            });
        });
        feedback.notify(
          result.warnings.join('\n') ||
            (entryId ? 'Änderungen gespeichert.' : 'Eintrag gespeichert.'),
        );
      }),
  };
}
