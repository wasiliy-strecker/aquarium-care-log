import { useRef, useState } from 'react';
import { errorText } from './components';
export function useTask() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      return await work();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, setError, setNotice, run };
}
