import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createContext, createElement, useContext, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Reports } from '../src/features/pdf/reports';
import type { SavedReport, Aquarium } from '../src/core/domain/models';
import { digest } from '../src/core/files/integrity';
import { populatedFixture as fixture } from './support';

const ports = vi.hoisted(() => ({
  push: vi.fn(),
  confirm: vi.fn(),
  notify: vi.fn(),
  choose: vi.fn(),
  scroll: vi.fn(),
  frames: new Map<number, (time: number) => void>(),
  nextFrame: 0,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    router: { push: ports.push },
    useFocusEffect: (callback: () => void | (() => void)) => {
      const focused = React.useContext(focusContext);
      React.useEffect(() => {
        if (focused) return callback();
      }, [callback, focused]);
    },
  };
});
vi.mock('expo-router/react-navigation', () => ({
  useIsFocused: () => useContext(focusContext),
}));
vi.mock('../src/core/startup/startup', () => ({ useStartupHold: () => {} }));
vi.mock('../src/core/ui/components', () => ({
  Body: 'Body',
  Button: 'Button',
  Card: 'Card',
  IconButton: 'IconButton',
  ActionRow: 'ActionRow',
  Busy: 'Busy',
  BusyOverlay: 'BusyOverlay',
  Notice: 'Notice',
  useTheme: () => ({
    primary: '#E50914',
    ink: '#111',
    secondaryContainer: '#def',
  }),
  errorText: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));
vi.mock('../src/core/ui/icon', () => ({ Icon: 'Icon' }));
const scrollHost = {
  ref: {
    current: {
      scrollTo: ports.scroll,
      getNativeScrollRef: () => ({
        measureInWindow: (callback: (x: number, y: number) => void) =>
          callback(0, 100),
      }),
    },
  },
  offset: { current: 500 },
  height: { current: 800 },
  content: { current: 5000 },
};
vi.mock('../src/core/ui/scroll-host', () => ({
  useScrollHost: () => scrollHost,
}));
vi.mock('../src/core/ui/feedback', () => ({ useFeedback: () => ports }));
vi.mock('../src/core/composition', () => ({
  useServices: () => useContext(servicesContext)!,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Fixture = Awaited<ReturnType<typeof fixture>>;
const focusContext = createContext(true);
const servicesContext = createContext<{
  aquariumService: Fixture['service'];
  reports: Fixture['reports'];
  revision: number;
  refresh(): void;
} | null>(null);
let active: Fixture;
let aquarium: Aquarium;
let otherAquarium: Aquarium;
let entryId = '';
let otherStepId = '';
let file = '';
let sha256 = '';
let size = 0;
let renderer: ReactTestRenderer | undefined;
const root = () => renderer!.root;
const heading = (single: boolean) =>
  single
    ? 'Gespeicherte Einzelprotokolle'
    : 'Gespeicherte Pflegeverlaufsprotokolle';
const label = (single: boolean) =>
  single ? 'Einzelprotokoll löschen' : 'Pflegeverlaufsprotokoll löschen';
const cards = (single: boolean) =>
  root().findAllByProps({ label: label(single) });
const text = () =>
  root()
    .findAllByType('Body' as never)
    .map((node) => node.children.join(''))
    .join('\n');
const button = (title: string) => root().findByProps({ title });
function Harness({
  single,
  hasPhotos = false,
  focused = true,
  dataRevision = 0,
}: {
  single: boolean;
  hasPhotos?: boolean;
  focused?: boolean;
  dataRevision?: number;
}) {
  const [revision, setRevision] = useState(0);
  return createElement(
    servicesContext.Provider,
    {
      value: {
        aquariumService: active.service,
        reports: active.reports,
        revision: revision + dataRevision,
        refresh: () => setRevision((n) => n + 1),
      },
    },
    createElement(
      focusContext.Provider,
      { value: focused },
      createElement(Reports, {
        aquariumId: aquarium.id,
        entryId: single ? entryId : null,
        hasPhotos,
      }),
    ),
  );
}
async function settled(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {});
    check();
  });
}
async function frames() {
  await act(async () => {
    const callbacks = [...ports.frames.values()];
    ports.frames.clear();
    for (const callback of callbacks) callback(0);
  });
}
async function press(title: string) {
  expect(button(title).props.disabled).not.toBe(true);
  await act(async () => button(title).props.onPress());
}
async function expandHistory() {
  const toggle = root()
    .findAllByType('Pressable' as never)
    .find((node) => node.props.accessibilityState?.expanded === false)!;
  await act(async () => toggle.props.onPress());
}
async function mount(single: boolean, total = 10) {
  await act(async () => {
    renderer = create(createElement(Harness, { single }), {
      createNodeMock: () => ({
        measureInWindow: (callback: (x: number, y: number) => void) =>
          callback(0, 180),
      }),
    });
  });
  if (!single) {
    await settled(() => expect(text()).toContain(`${total} Protokolle`));
    await expandHistory();
  }
  await settled(() => expect(cards(single)).toHaveLength(10));
}
function report(index: number, single: boolean): SavedReport {
  return {
    id: active.env.id(),
    aquariumId: aquarium.id,
    entryId: single ? entryId : null,
    file,
    sha256,
    size,
    summary: 'Gespeicherter Pflegeeintrag',
    full: false,
    name: `PDF ${index}`,
    createdAt: new Date(Date.UTC(2026, 9, 1, 10, index)).toISOString(),
  };
}
beforeEach(async () => {
  vi.clearAllMocks();
  ports.frames.clear();
  ports.confirm.mockResolvedValue(true);
  ports.choose.mockResolvedValue(null);
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    const id = ++ports.nextFrame;
    ports.frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) =>
    ports.frames.delete(id),
  );
  active = await fixture();
  aquarium = active.aquarium;
  otherAquarium = { ...aquarium, id: active.env.id(), name: 'Anderes Projekt' };
  await active.repo.saveAquarium(otherAquarium);
  const draft = await active.service.draft(aquarium.id);
  draft.form.activity = '100';
  entryId = (await active.service.saveEntry(draft)).entry.id;
  const otherDraft = await active.service.draft(aquarium.id);
  otherDraft.form.activity = '110';
  otherDraft.form.occurredAt = new Date(
    Date.parse(draft.form.occurredAt) + 1000,
  ).toISOString();
  otherStepId = (await active.service.saveEntry(otherDraft)).entry.id;
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  size = bytes.length;
  file = await active.vault.put(bytes, 'pdf');
  sha256 = digest(bytes);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  await active.close();
});

it.each([
  { kind: 'history', single: false },
  { kind: 'single', single: true },
])(
  'pages $kind reports in tens, separates scopes and returns to the heading',
  async ({ single }) => {
    const own = Array.from({ length: 10 }, (_, i) => report(i, single));
    await active.repo.saveReports([
      ...own,
      ...Array.from({ length: 3 }, (_, i) => report(i, !single)),
      ...Array.from({ length: 3 }, (_, i) => ({
        ...report(i, false),
        aquariumId: otherAquarium.id,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        ...report(i, true),
        entryId: otherStepId,
      })),
    ]);
    const listFiles = vi.spyOn(active.vault, 'list');
    await mount(single);
    expect(text()).toContain(heading(single));
    expect(text()).not.toContain('Seite 1 von');
    if (!single) expect(listFiles).toHaveBeenCalledTimes(1); // Only after expanding.
    const extra = report(10, single);
    await active.repo.saveReports([extra]);
    await act(async () => renderer!.unmount());
    renderer = undefined;
    await mount(single, 11);
    expect(text()).toContain('Seite 1 von 2');
    expect(button('Zurück').props.disabled).toBe(true);
    await press('Weiter');
    await settled(() => expect(cards(single)).toHaveLength(1));
    await frames();
    expect(text()).toContain('Seite 2 von 2');
    expect(button('Weiter').props.disabled).toBe(true);
    expect(ports.scroll).toHaveBeenLastCalledWith({ y: 560, animated: true });
    await press('Zurück');
    await settled(() => expect(cards(single)).toHaveLength(10));
    await frames();
    expect(text()).toContain('Seite 1 von 2');
    await press('Weiter');
    await settled(() => expect(cards(single)).toHaveLength(1));
    await act(async () =>
      renderer!.update(createElement(Harness, { single: !single })),
    );
    if (single) {
      await settled(() => expect(text()).toContain('3 Protokolle'));
      await expandHistory();
    }
    await settled(() => expect(cards(!single)).toHaveLength(3));
    expect(text()).toContain(heading(!single));
    expect(text()).not.toContain('Seite 2');
  },
);

it.each([
  { kind: 'history', single: false },
  { kind: 'single', single: true },
])(
  'returns from an emptied last $kind report page without losing other PDFs',
  async ({ single }) => {
    const own = Array.from({ length: 11 }, (_, i) => report(i, single));
    await active.repo.saveReports(own);
    await act(async () => {
      renderer = create(createElement(Harness, { single }), {
        createNodeMock: () => ({
          measureInWindow: (cb: (x: number, y: number) => void) => cb(0, 180),
        }),
      });
    });
    if (!single) {
      await settled(() => expect(text()).toContain('11 Protokolle'));
      await expandHistory();
    }
    await settled(() => expect(cards(single)).toHaveLength(10));
    await press('Weiter');
    await settled(() => expect(cards(single)).toHaveLength(1));
    await act(async () => cards(single)[0]!.props.onPress());
    await settled(() => expect(cards(single)).toHaveLength(10));
    await frames();
    expect(text()).not.toContain('Seite 2');
    expect((await active.repo.snapshot()).reports).toHaveLength(10);
    expect(await active.vault.read(file)).toBeInstanceOf(Uint8Array);
  },
);

it.each(['data refresh', 'screen return'])(
  'clears an obsolete no-entries PDF error after saving the first entry on %s',
  async (trigger) => {
    await active.service.delete('entry', entryId);
    await active.service.delete('entry', otherStepId);
    ports.choose.mockResolvedValue('compact');
    await act(async () => {
      renderer = create(createElement(Harness, { single: false }));
    });
    await press('PDF erstellen');
    const error = () =>
      root().findAllByProps({
        text: 'Für dieses Aquarium gibt es noch keine Pflegeeinträge.',
      });
    expect(error()).toHaveLength(1);
    expect(ports.push).not.toHaveBeenCalled();
    if (trigger === 'screen return')
      await act(async () =>
        renderer!.update(
          createElement(Harness, {
            single: false,
            focused: false,
          }),
        ),
      );
    const draft = await active.service.draft(aquarium.id);
    draft.form.activity = 'Wasserwechsel';
    await active.service.saveEntry(draft);
    await act(async () =>
      renderer!.update(
        createElement(Harness, {
          single: false,
          dataRevision: trigger === 'data refresh' ? 1 : 0,
        }),
      ),
    );
    await settled(() => expect(error()).toHaveLength(0));
    await press('PDF erstellen');
    await settled(() =>
      expect(ports.push).toHaveBeenCalledWith({
        pathname: '/pdf/[id]',
        params: { id: expect.any(String) },
      }),
    );
    expect((await active.repo.snapshot()).reports).toHaveLength(1);
  },
);

it('shows a load failure with retry instead of an endless page spinner', async () => {
  await active.repo.saveReports(
    Array.from({ length: 10 }, (_, i) => report(i, true)),
  );
  vi.spyOn(active.repo, 'reportPage').mockRejectedValueOnce(
    new Error('PDF-Liste vorübergehend nicht verfügbar.'),
  );
  await act(async () => {
    renderer = create(createElement(Harness, { single: true }));
  });
  await settled(() =>
    expect(
      root().findAllByProps({
        text: 'PDF-Liste vorübergehend nicht verfügbar.',
      }),
    ).toHaveLength(1),
  );
  await press('Erneut versuchen');
  await settled(() => expect(cards(true)).toHaveLength(10));
});
