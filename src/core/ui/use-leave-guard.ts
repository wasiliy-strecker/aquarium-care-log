import { useRef } from 'react';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useFeedback } from './feedback';
import { errorText } from './components';
export function useLeaveGuard({
  dirty,
  busy,
  discard,
  title = 'Änderungen verwerfen?',
}: {
  dirty: boolean;
  busy: boolean;
  discard: () => Promise<void>;
  title?: string;
}) {
  const navigation = useNavigation();
  const feedback = useFeedback();
  const bypass = useRef(false),
    asking = useRef(false);
  usePreventRemove(dirty || busy, ({ data }) => {
    if (bypass.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (busy || asking.current) return;
    asking.current = true;
    void (async () => {
      try {
        if (
          await feedback.confirm(
            title,
            'Nicht gespeicherte Eingaben und neu hinzugefügte Anhänge werden verworfen.',
            title.replace(/\?$/, ''),
            true,
            'Weiter bearbeiten',
          )
        ) {
          await discard();
          bypass.current = true;
          navigation.dispatch(data.action);
        }
      } catch (e) {
        feedback.notify(errorText(e));
      } finally {
        asking.current = false;
      }
    })();
  });
  return (navigate: () => void) => {
    bypass.current = true;
    navigate();
  };
}
