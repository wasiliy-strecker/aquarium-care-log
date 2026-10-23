import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AquariumService } from '../../features/entries/entry-service';

export function useReminderRecovery(service: AquariumService | undefined) {
  useEffect(() => {
    if (!service) return;
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', (state) => {
      const resumed = state === 'active' && previous !== 'active';
      previous = state;
      if (resumed) {
        // Read SQLite after pending saves/deletions, including changes whose
        // previous native sync failed. Native plans alone cannot recover those.
        void service.queue.run(() => service.syncReminders());
      }
    });
    return () => listener.remove();
  }, [service]);
}
