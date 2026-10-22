import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useStartupHold } from '../../core/startup/startup';
import { useServices } from '../../core/composition';
import type { SavedReport } from '../../core/domain/models';
import { errorText } from '../../core/ui/components';
import { useTask } from '../../core/ui/use-task';
import { useFeedback } from '../../core/ui/feedback';
import { messages } from '../../core/texts';

export function useReports(
  aquariumId: string,
  entryId: string | null,
  hasPhotos: boolean,
) {
  const focused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const {
    aquariumService,
    reports: reportService,
    revision,
    refresh,
  } = useServices();
  const feedback = useFeedback();
  const task = useTask();
  const [reports, setReports] = useState<SavedReport[]>([]),
    [total, setTotal] = useState(0),
    [loadedOffset, setLoadedOffset] = useState<number | null>(null),
    [offset, setOffset] = useState(0),
    [expanded, setExpanded] = useState(false),
    [availableFiles, setAvailableFiles] = useState<Set<string> | null>(null),
    [loadError, setLoadError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [deletingId, setDeletingId] = useState<string>();
  const pageLoading = loading || (!loadError && loadedOffset !== offset);
  useStartupHold(focused && pageLoading);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError('');
      setAvailableFiles(null);
      Promise.all([
        aquariumService.repository.reportPage({ aquariumId, entryId, offset }),
        entryId || expanded
          ? aquariumService.vault.list()
          : Promise.resolve(null),
      ])
        .then(([page, files]) => {
          if (active) {
            setReports(page.rows);
            setTotal(page.total);
            setLoadedOffset(page.offset);
            setAvailableFiles(files ? new Set(files) : null);
            if (page.offset !== offset) setOffset(page.offset);
          }
        })
        .catch((e) => {
          if (active) setLoadError(errorText(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // Revision/retry tokens intentionally reload persisted data on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      aquariumService,
      aquariumId,
      entryId,
      offset,
      revision,
      expanded,
      attempt,
    ]),
  );
  return {
    ...task,
    loading: pageLoading,
    loadError,
    expanded,
    setExpanded,
    availableFiles,
    deletingId,
    retry: () => setAttempt((n) => n + 1),
    reports,
    total,
    offset,
    setOffset,
    create: async () => {
      const text = messages.reportContent;
      const mode = await feedback.choose({
        title: text.title,
        optionStyle: 'cards',
        options: [
          {
            value: 'full',
            label: text.withPhoto,
            description: hasPhotos ? undefined : text.noAttachments,
            icon: 'photo_outlined',
            disabled: !hasPhotos,
          },
          {
            value: 'compact',
            label: text.compact,
            icon: 'description_outlined',
          },
        ],
      });
      if (mode === null) return;
      await task.run(async () => {
        const report = await reportService.createReport(
          aquariumId,
          entryId,
          mode === 'full',
        );
        refresh();
        setOffset(0);
        router.push({ pathname: '/pdf/[id]', params: { id: report.id } });
      });
    },
    open: (report: SavedReport) =>
      router.push({ pathname: '/pdf/[id]', params: { id: report.id } }),
    remove: async (report: SavedReport) => {
      if (
        await feedback.confirm(
          report.entryId
            ? messages.reportContent.deleteSingle + '?'
            : messages.reportContent.deleteHistory + '?',
          messages.reportContent.deleteMessage,
          messages.reportContent.deleteAction,
          true,
        )
      )
        await task.run(async () => {
          setDeletingId(report.id);
          try {
            await aquariumService.delete('report', report.id);
            refresh();
            feedback.notify(
              report.entryId
                ? messages.reportContent.deletedSingle
                : messages.reportContent.deletedHistory,
            );
          } finally {
            setDeletingId(undefined);
          }
        });
    },
  };
}
