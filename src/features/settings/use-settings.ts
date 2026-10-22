import { messages } from '../../core/texts';
import type { BackupProgress } from '../../core/backup/backup-progress';
import { useState } from 'react';
import { useServices } from '../../core/composition';
import { useTask } from '../../core/ui/use-task';
import { useFeedback } from '../../core/ui/feedback';
import { useLeaveGuard } from '../../core/ui/use-leave-guard';
import { errorText } from '../../core/ui/components';
import type { PreparedBackup } from '../../core/media/media-service';
import { privacyUrl } from './aquarium-links';
export function backupProgressLabel(progress: BackupProgress): string {
  const label = messages.backupProgress[progress.phase];
  return progress.totalFiles && progress.completedFiles !== undefined
    ? `${label} · ${messages.backupProgress.files.replace('{completed}', String(progress.completedFiles)).replace('{total}', String(progress.totalFiles))}`
    : `${label} …`;
}
export function useSettings(
  askPassword: (confirm: boolean) => Promise<string | null>,
) {
  const { backup, media, refresh, links } = useServices();
  const task = useTask(),
    feedback = useFeedback();
  const [phase, setPhase] = useState('');
  const onProgress = (progress: BackupProgress) =>
    setPhase(backupProgressLabel(progress));
  useLeaveGuard({ dirty: false, busy: task.busy, discard: async () => {} });
  return {
    ...task,
    phase,
    openPrivacy: () =>
      task.run(async () => {
        try {
          await links.open(privacyUrl);
        } catch {
          throw new Error(
            'Die Datenschutzerklärung konnte nicht geöffnet werden. Bitte versuche es erneut.',
          );
        }
      }),
    create: () =>
      task.run(async () => {
        const password = await askPassword(true);
        if (password === null) return;
        let prepared: PreparedBackup | undefined;
        try {
          onProgress({ phase: 'preparing' });
          const bytes = await backup.create(password, onProgress);
          setPhase(messages.backupProgress.preparingLocation);
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          prepared = await media.prepareBackup(bytes);
          setPhase('');
          let finished = false;
          while (!finished) {
            let saved = false;
            let failure = '';
            try {
              saved = (await media.saveBackup(prepared)) === 'saved';
            } catch (e) {
              failure = errorText(e);
            }
            if (saved) {
              const action = await feedback.choose({
                title: 'Backup gespeichert',
                message: `${prepared.name} wurde im gewählten Speicherort abgelegt. Bewahre die Datei und dein Passwort sicher auf.`,
                dialog: true,
                stackedActions: true,
                options: [
                  {
                    value: 'done',
                    label: 'Fertig',
                    filled: true,
                    icon: 'check',
                  },
                  {
                    value: 'share',
                    label: 'Teilen',
                    icon: 'ios_share_outlined',
                    outlined: true,
                  },
                ],
              });
              if (action === 'share') await media.shareBackup(prepared);
              finished = true;
            } else {
              const action = await feedback.choose({
                title: 'Backup noch nicht gespeichert',
                message:
                  failure ||
                  'Die Speicherortauswahl wurde abgebrochen. Du kannst erneut einen Speicherort wählen.',
                dialog: true,
                stackedActions: true,
                options: [
                  {
                    value: 'discard',
                    label: 'Backup verwerfen',
                    danger: true,
                    filled: true,
                    icon: 'delete_outline',
                  },
                  {
                    value: 'retry',
                    label: 'Speicherort wählen',
                    outlined: true,
                    icon: 'folder_open_outlined',
                  },
                ],
              });
              finished = action !== 'retry';
            }
          }
        } finally {
          setPhase('');
          if (prepared) await media.discardBackup(prepared).catch(() => {});
        }
      }),
    restore: () =>
      task.run(async () => {
        const bytes = await media.pickBackup();
        if (!bytes) return;
        const password = await askPassword(false);
        if (password === null) return;
        try {
          onProgress({ phase: 'checking' });
          const decoded = await backup.codec.decode(
            bytes,
            password,
            onProgress,
          );
          setPhase('');
          if (
            !(await feedback.confirm(
              'Backup wiederherstellen?',
              `${decoded.data.aquariums.length} Aquarien und ${decoded.data.entries.length} Pflegeeinträge werden importiert. Neuere lokale Pflegeeinträge werden nicht überschrieben.`,
              'Wiederherstellen',
              false,
            ))
          )
            return;
          onProgress({ phase: 'restoring' });
          const result = await backup.restore(decoded, onProgress);
          refresh();
          feedback.notify(
            [
              'Backup wiederhergestellt. Die Daten sind sofort in deinen Aquarien sichtbar.',
              ...result.warnings,
            ].join('\n'),
          );
        } finally {
          setPhase('');
        }
      }),
  };
}
