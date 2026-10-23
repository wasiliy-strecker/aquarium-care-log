import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useServices } from '../../core/composition';
import type { ReminderStatus } from '../../core/native/aquarium-native';

export function useReminderStatusSnapshot() {
  const { native } = useServices();
  const [status, setStatus] = useState<ReminderStatus>();
  const [loaded, setLoaded] = useState(false);
  const active = useRef(false),
    query = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++query.current;
    let result: ReminderStatus | undefined;
    try {
      result = await native.reminderStatus();
    } catch {
      /* Unknown is not permission granted. */
    }
    if (active.current && current === query.current) {
      setStatus(result);
      setLoaded(true);
    }
    return result;
  }, [native]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      const changes = native.addListener('onReminderStatusChanged', () => {
        void refresh();
      });
      void refresh();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        active.current = false;
        ++query.current;
        listener.remove();
        changes.remove();
      };
    }, [native, refresh]),
  );
  return { status, loaded, refresh };
}
export function useReminderStatus() {
  return useReminderStatusSnapshot().status;
}
