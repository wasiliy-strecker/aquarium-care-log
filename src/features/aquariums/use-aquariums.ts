import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { useServices } from '../../core/composition';
import type {
  EntryDraft,
  Aquarium,
  CareEntry,
  AquariumPhoto,
} from '../../core/domain/models';
import { PAGE_SIZE } from '../../core/domain/models';
import { useReminderStatus } from './use-reminder-status';
import { errorText } from '../../core/ui/components';
import { useTask } from '../../core/ui/use-task';
import {
  visibleAquariums,
  historyComparison,
  type DashboardItem,
  type HistoryItem,
  type AquariumSort,
} from './presentation-model';
export { useReminderStatus } from './use-reminder-status';
export function useAquariums() {
  const { aquariumService, revision } = useServices();
  const [items, setItems] = useState<DashboardItem[]>([]),
    [drafts, setDrafts] = useState<EntryDraft[]>([]),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState<AquariumSort>('lastEdited'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const status = useReminderStatus();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        aquariumService.repository.dashboard(),
        aquariumService.repository.drafts(),
      ])
        .then(([r, d]) => {
          if (active) {
            setItems(r);
            setDrafts(d);
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
    }, [aquariumService, revision, retry]),
  );
  return {
    items: visibleAquariums(items, search, sort),
    empty: !items.length,
    drafts,
    search,
    setSearch,
    sort,
    setSort,
    loading,
    error,
    status,
    retry: () => setRetry((n) => n + 1),
  };
}
export function useAquariumDetail(id: string, history = false) {
  const { aquariumService, native, revision, refresh } = useServices();
  const [aquarium, setAquarium] = useState<Aquarium>(),
    [photo, setPhoto] = useState<AquariumPhoto | null>(null),
    [entries, setEntries] = useState<CareEntry[]>([]),
    [comparisons, setComparisons] = useState<Record<string, string | null>>({}),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true);
  const task = useTask();
  const { setError } = task;
  const status = useReminderStatus();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        aquariumService.repository.aquariums(),
        aquariumService.repository.latestPhoto(id),
        aquariumService.repository.entries(
          id,
          history ? search : '',
          history ? offset : 0,
        ),
      ])
        .then(async ([aquariums, photo, page]) => {
          const comparisons = await Promise.all(
            page.rows.map(async (e) => {
              const p =
                history && search.trim()
                  ? null
                  : await aquariumService.repository.previousEntry(e);
              return [e.id, historyComparison(e, p)] as const;
            }),
          );
          if (!active) return;
          setAquarium(aquariums.find((r) => r.id === id));
          setEntries(page.rows);
          setPhoto(photo);
          setTotal(page.total);
          setComparisons(Object.fromEntries(comparisons));
          setError('');
          if (offset && offset >= page.total)
            setOffset(
              Math.max(0, Math.floor((page.total - 1) / PAGE_SIZE) * PAGE_SIZE),
            );
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      void native.acknowledge(id).catch(() => {});
      return () => {
        active = false;
      };
      // Revision/retry tokens intentionally reload persisted data on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      aquariumService,
      native,
      id,
      history,
      search,
      offset,
      revision,
      setError,
    ]),
  );
  return {
    aquarium,
    photo,
    entries,
    historyItems: entries.map((entry): HistoryItem => {
      const photos = entry.attachments.filter((a) => a.kind === 'photo');
      return {
        entry,
        photoUri: photos[0]
          ? aquariumService.vault.uri(photos[0].file)
          : undefined,
        photoCount: photos.length,
        measurementText: entry.measurement
          ? `${entry.measurement.label}: ${entry.measurement.value.toLocaleString('de-DE')}${entry.measurement.unit ? ' ' + entry.measurement.unit : ''}`
          : 'Ohne Messangabe',
        comparison: comparisons[entry.id] ?? null,
      };
    }),
    total,
    offset,
    setOffset,
    search,
    setSearch: (v: string) => {
      setOffset(0);
      setSearch(v);
    },
    loading,
    status,
    ...task,
    remove: () =>
      task.run(async () => {
        await aquariumService.delete('aquarium', id);
        refresh();
        router.replace('/');
      }),
  };
}
