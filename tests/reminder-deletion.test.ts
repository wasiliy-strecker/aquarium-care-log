import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAquariumDetail } from '../src/features/aquariums/use-aquariums';
import { useReminderRecovery } from '../src/core/native/use-reminder-recovery';
import { defaultReminder } from '../src/features/aquariums/reminder-model';
import { aquarium, fixture } from './support';

const ports = vi.hoisted(() => ({
  notify: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  acknowledge: vi.fn(async () => {}),
}));
const appListeners = new Set<(state: string) => void>();
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      appListeners.add(listener);
      return { remove: () => appListeners.delete(listener) };
    },
  },
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    router: { replace: ports.replace },
    useFocusEffect: (callback: () => () => void) =>
      React.useEffect(callback, [callback]),
  };
});
vi.mock('../src/core/ui/feedback', () => ({ useFeedback: () => ports }));
vi.mock('../src/core/ui/components', () => ({
  errorText: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));
vi.mock('../src/features/aquariums/use-reminder-status', () => ({
  useReminderStatus: () => undefined,
}));
vi.mock('../src/core/composition', () => ({
  useServices: () => ({
    aquariumService: f.service,
    native: ports,
    revision: 0,
    refresh: ports.refresh,
  }),
}));

let f: Awaited<ReturnType<typeof fixture>>;
let view: ReactTestRenderer;
let detail: ReturnType<typeof useAquariumDetail>;
let tankId: string;
let nativeIds: string[];
let failSync: boolean;
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  nativeIds = [];
  failSync = false;
  f = await fixture({
    async sync(aquariums) {
      if (failSync) throw new Error('Synthetic native bridge failure');
      nativeIds = aquariums.filter((a) => a.reminder).map((a) => a.id);
      return [];
    },
  });
  const tank = aquarium({ reminder: defaultReminder() });
  tankId = tank.id;
  await f.service.saveAquarium(tank);
  function Harness() {
    detail = useAquariumDetail(tankId);
    useReminderRecovery(f.service);
    return null;
  }
  await act(async () => {
    view = create(createElement(Harness));
  });
});
afterEach(async () => {
  await act(async () => view.unmount());
  expect(appListeners.size).toBe(0);
  await f.close();
});
async function resume() {
  for (const listener of appListeners) listener('background');
  for (const listener of appListeners) listener('active');
  await f.service.queue.run(async () => {});
}

it('shows deletion sync failures after navigation and removes stale plans on resume', async () => {
  failSync = true;
  await act(async () => {
    await detail.remove();
  });
  expect(await f.repo.aquariums()).toEqual([]);
  expect(nativeIds).toEqual([tankId]);
  expect(ports.replace).toHaveBeenCalledWith('/');
  expect(ports.notify).toHaveBeenCalledWith(
    expect.stringContaining('Aquarium gelöscht.'),
    8000,
  );
  expect(ports.notify.mock.lastCall?.[0]).toContain(
    'Eine alte Erinnerung kann noch erscheinen',
  );
  expect(ports.replace.mock.invocationCallOrder[0]).toBeLessThan(
    ports.notify.mock.invocationCallOrder[0]!,
  );
  failSync = false;
  await act(resume);
  expect(nativeIds).toEqual([]);
});

it('retains the aquarium and its reminder and reports a database deletion error', async () => {
  f.raw.exec(
    "CREATE TRIGGER fail_delete BEFORE DELETE ON aquariums BEGIN SELECT RAISE(ABORT,'Synthetic delete failure'); END;",
  );
  await act(async () => {
    await detail.remove();
  });
  expect(await f.repo.aquariums()).toHaveLength(1);
  expect(nativeIds).toEqual([tankId]);
  expect(detail.error).toContain('Synthetic delete failure');
  expect(ports.notify).not.toHaveBeenCalled();
  expect(ports.replace).not.toHaveBeenCalled();
});

it('waits for queued writes before reconciling reminders on resume', async () => {
  let finish!: () => void;
  const barrier = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const write = f.service.queue.run(async () => {
    await barrier;
    await f.repo.deleteAquarium(tankId);
  });
  const resumed = resume();
  expect(nativeIds).toEqual([tankId]);
  finish();
  await act(async () => {
    await write;
    await resumed;
  });
  expect(nativeIds).toEqual([]);
});
