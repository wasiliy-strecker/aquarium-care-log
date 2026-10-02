import { useState } from 'react';
import { useServices } from '../../core/composition';
import { useTask } from '../../core/ui/use-task';
import { useFeedback } from '../../core/ui/feedback';
import { useLeaveGuard } from '../../core/ui/use-leave-guard';
import { errorText } from '../../core/ui/components';
import type { PreparedBackup } from '../../core/media/media-service';
import { router } from 'expo-router';
export function useSettings(
  askPassword: (confirm: boolean) => Promise<string | null>,
) {
  const { backup, media, refresh } = useServices();
  const task = useTask(),
    feedback = useFeedback();
  const [phase, setPhase] = useState('');
  useLeaveGuard({ dirty: false, busy: task.busy, discard: async () => {} });
  return {
    ...task,
    phase,
    openPrivacy: () => router.push('/privacy'),
    create: () =>
      task.run(async () => {
        const password = await askPassword(true);
        if (password === null) return;
        let prepared: PreparedBackup | undefined;
        try {
          setPhase('Backup wird vorbereitet und verschlüsselt …');
          prepared = await media.prepareBackup(await backup.create(password));
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
          setPhase('Backup wird geprüft …');
          const decoded = await backup.codec.decode(bytes, password);
          setPhase('');
          if (
            !(await feedback.confirm(
              'Backup wiederherstellen?',
              `${decoded.data.aquariums.length} Aquarien und ${decoded.data.entries.length} Pflegeeinträge werden importiert. Neuere lokale Einträge werden nicht überschrieben.`,
              'Wiederherstellen',
              false,
            ))
          )
            return;
          setPhase('Backup wird wiederhergestellt …');
          const result = await backup.restore(decoded);
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
