import { afterEach, expect, it, vi } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFPage } from 'pdf-lib';
import { populatedFixture as fixture, photo } from './support';
import { ReportLayout } from '../src/core/pdf/report-layout';
import { migrate } from '../src/core/database/repository';
import {
  entryDateTime,
  captureDifferences,
} from '../src/core/domain/capture-data';
import { validateSnapshot } from '../src/core/domain/models';
import { PdfViewerService } from '../src/core/pdf/viewer-service';
import type { AquariumNative } from '../src/core/native/aquarium-native';
const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
async function setup() {
  const f = await fixture();
  fixtures.push(f);
  return f;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const f of fixtures.splice(0)) await f.close();
});
async function addEntry(
  f: Awaited<ReturnType<typeof fixture>>,
  number: number,
  images = 0,
) {
  const draft = await f.service.draft(f.aquarium.id);
  draft.form.activity = String(number);
  draft.form.occurredAt = new Date(Date.UTC(2026, 9, number, 12)).toISOString();
  draft.form.timezoneOffsetMinutes = 120;
  draft.form.measurementLabel = 'Temperatur';
  draft.form.value = '24,5';
  draft.form.unit = '°C';
  draft.form.note = `Notiz zur Pflege ${number}`;
  for (let i = 0; i < images; i++) {
    const original = await photo();
    const bytes = new Uint8Array([
      ...original.slice(0, 2),
      0xff,
      0xfe,
      0,
      3,
      number * 10 + i,
      ...original.slice(2),
    ]);
    draft.form.attachments.push(
      await f.service.importPhoto(bytes, `Foto ${number}-${i}.jpg`),
    );
  }
  return (await f.service.saveEntry(draft)).entry;
}
async function embedded(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.context
    .enumerateIndirectObjects()
    .map(([, v]) => v)
    .filter(
      (v): v is PDFRawStream =>
        v instanceof PDFRawStream &&
        v.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
    .map((v) => v.getContents());
}
it('exports the complete history with every ordered photo and notes, and single reports only from their entry', async () => {
  const f = await setup();
  const first = await addEntry(f, 1, 3);
  await addEntry(f, 2, 2);
  for (let i = 3; i <= 12; i++) await addEntry(f, i);
  const other = { ...f.aquarium, id: f.env.id() };
  await f.service.saveAquarium(other);
  const draft = await f.service.draft(other.id);
  draft.form.activity = '99';
  draft.form.note = 'Not in this report';
  await f.service.saveEntry(draft);
  const text = vi.spyOn(ReportLayout.prototype, 'text');
  const table = vi.spyOn(ReportLayout.prototype, 'historyTable');
  const fields = vi.spyOn(ReportLayout.prototype, 'dataTable');
  const history = await f.reports.createReport(f.aquarium.id, null, true);
  expect(table.mock.calls[0]![0]).toHaveLength(12);
  expect(text.mock.calls.some(([s]) => s === 'Notiz zur Pflege 1')).toBe(true);
  expect(
    fields.mock.calls.some(([rows]) =>
      rows.some(
        ([label, value]) => label === 'Messgröße' && value === 'Temperatur',
      ),
    ),
  ).toBe(true);
  expect(
    fields.mock.calls.some(([rows]) =>
      rows.some(([label, value]) => label === 'Wert' && value === '24,5'),
    ),
  ).toBe(true);
  expect(
    fields.mock.calls.some(([rows]) =>
      rows.some(([label, value]) => label === 'Einheit' && value === '°C'),
    ),
  ).toBe(true);
  expect(text.mock.calls.some(([s]) => s === 'Not in this report')).toBe(false);
  const data = await f.repo.snapshot();
  const expected = data.entries
    .filter((s) => s.aquariumId === f.aquarium.id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .flatMap((s) => s.attachments);
  expect(await embedded(await f.vault.read(history.file))).toEqual(
    await Promise.all(expected.map((p) => f.vault.read(p.file))),
  );
  const single = await f.reports.createReport(f.aquarium.id, first.id, true);
  expect(await embedded(await f.vault.read(single.file))).toEqual(
    await Promise.all(first.attachments.map((p) => f.vault.read(p.file))),
  );
});
it('opens, shares and prints the saved PDF and rejects changed bytes before handing them to Android', async () => {
  const f = await setup();
  const entry = await addEntry(f, 1);
  const report = await f.reports.createReport(f.aquarium.id, entry.id, false);
  const native = {
    openPdfPreview: vi.fn(async () => ({ session: 'test', pages: 1 })),
    closePdfPreview: vi.fn(async () => {}),
    sharePdfs: vi.fn(async () => {}),
    printPdf: vi.fn(async () => {}),
  };
  const viewer = new PdfViewerService(
    f.service,
    native as unknown as AquariumNative,
  );
  const pdf = await viewer.open(report.id);
  const uri = f.vault.uri(report.file);
  expect(native.openPdfPreview).toHaveBeenCalledWith(uri);
  await viewer.share([report]);
  expect(native.sharePdfs).toHaveBeenCalledWith([uri]);
  await viewer.print(pdf);
  expect(native.printPdf).toHaveBeenCalledWith(uri, report.name + '.pdf');
  await viewer.close(pdf);
  expect(native.closePdfPreview).toHaveBeenCalledWith('test');
  vi.spyOn(f.vault, 'read').mockResolvedValue(new Uint8Array([1, 2, 3]));
  await expect(viewer.open(report.id)).rejects.toThrow('unerwartet verändert');
  await expect(viewer.share([report])).rejects.toThrow('unerwartet verändert');
  await expect(viewer.print(pdf)).rejects.toThrow('unerwartet verändert');
  expect(native.openPdfPreview).toHaveBeenCalledTimes(1);
  expect(native.sharePdfs).toHaveBeenCalledTimes(1);
  expect(native.printPdf).toHaveBeenCalledTimes(1);
});
it('keeps photo pairs inside page bounds and centers an odd last photo at the same size', async () => {
  const f = await setup();
  const entry = await addEntry(f, 1, 3);
  const draw = vi.spyOn(PDFPage.prototype, 'drawImage');
  await f.reports.createReport(f.aquarium.id, entry.id, true);
  const placements = draw.mock.calls.map(([, o]) => o!);
  expect(placements).toHaveLength(3);
  const [a, b, c] = placements;
  expect(a!.width).toBe(b!.width);
  expect(c!.width).toBe(a!.width);
  expect(a!.y).toBe(b!.y);
  expect(b!.x).toBeGreaterThan(a!.x! + a!.width!);
  expect(c!.x! + c!.width! / 2).toBeCloseTo(595.2756 / 2, 2);
  for (const box of placements) {
    expect(box.x).toBeGreaterThanOrEqual(40);
    expect(box.y).toBeGreaterThan(40);
    expect(box.y! + box.height!).toBeLessThan(802);
  }
});
it('rejects a broken included photo without partial output and reads no photos in compact reports', async () => {
  const f = await setup();
  const entry = await addEntry(f, 1, 1);
  await f.vault.remove(entry.attachments[0]!.file);
  const before = await f.repo.snapshot();
  await expect(
    f.reports.createReport(f.aquarium.id, entry.id, true),
  ).rejects.toThrow('Foto');
  expect(await f.repo.snapshot()).toEqual(before);
  expect(await f.vault.list()).toHaveLength(0);
  const reads = vi.spyOn(f.vault, 'read');
  const report = await f.reports.createReport(f.aquarium.id, entry.id, false);
  expect(reads).not.toHaveBeenCalled();
  expect(await embedded(await f.vault.read(report.file))).toHaveLength(0);
});
it('preserves capture details through edits and legacy migration without inventing old values', async () => {
  const f = await setup();
  const entry = await addEntry(f, 1);
  await f.service.saveAquarium({
    ...f.aquarium,
    name: 'Changed',
    location: 'Changed location',
  });
  const draft = await f.service.draft(f.aquarium.id, entry);
  draft.form.note = 'Edited';
  await f.service.saveEntry(draft);
  const saved = (await f.repo.entry(entry.id))!;
  expect(saved.aquariumAtCapture?.name).toBe(f.aquarium.name);
  expect(saved.timezoneOffsetMinutes).toBe(120);
  expect(entryDateTime(saved, true)).toContain('14:00 (UTC+02:00)');
  expect(
    captureDifferences(
      saved,
      (await f.repo.aquariums()).find((a) => a.id === f.aquarium.id)!,
    ),
  ).toContainEqual(['Aquarium', f.aquarium.name]);
  const legacy = { ...saved };
  delete legacy.aquariumAtCapture;
  delete legacy.timezoneOffsetMinutes;
  await f.repo.saveEntry(legacy, 'absent');
  const pending = await f.service.draft(f.aquarium.id);
  await f.db.exec('DROP TABLE reports; PRAGMA user_version=1;');
  await migrate(f.db);
  expect(await f.repo.entry(entry.id)).toEqual(legacy);
  expect((await f.repo.drafts())[0]?.id).toBe(pending.id);
  const old = validateSnapshot({
    aquariums: [f.aquarium],
    entries: [legacy],
    activities: [],
  });
  expect(old.reports).toEqual([]);
  expect(old.entries[0]?.aquariumAtCapture).toBeUndefined();
});
it('roundtrips PDF bytes and capture fields in backups, and deletes only the appropriate reports', async () => {
  const source = await setup(),
    target = await setup();
  const entry = await addEntry(source, 1, 1);
  const single = await source.reports.createReport(
    source.aquarium.id,
    entry.id,
    true,
  );
  const history = await source.reports.createReport(
    source.aquarium.id,
    null,
    true,
  );
  const bytes = await source.backup.create('AquariumLog Testpasswort');
  const decoded = await target.backup.codec.decode(
    bytes,
    'AquariumLog Testpasswort',
  );
  await target.backup.restore(decoded);
  const restored = await target.repo.snapshot();
  expect(restored.reports).toHaveLength(2);
  expect(restored.entries[0]?.aquariumAtCapture).toEqual(
    entry.aquariumAtCapture,
  );
  for (const r of restored.reports)
    expect(await target.vault.read(r.file)).toEqual(
      await source.vault.read(r.id === single.id ? single.file : history.file),
    );
  await target.service.delete('entry', entry.id);
  expect((await target.repo.snapshot()).reports.map((r) => r.id)).toEqual([
    history.id,
  ]);
  expect(await target.vault.list()).toHaveLength(1);
  await target.service.delete('aquarium', source.aquarium.id);
  expect(await target.vault.list()).toHaveLength(0);
});
it('flows long notes across pages and rolls back file writes if metadata cannot be saved', async () => {
  const f = await setup();
  const entry = await addEntry(f, 1);
  const draft = await f.service.draft(f.aquarium.id, entry);
  draft.form.note = 'Lange Notiz mit ÄÖÜ und Farbe 71.010.\n'.repeat(450);
  await f.service.saveEntry(draft);
  const report = await f.reports.createReport(f.aquarium.id, entry.id, false);
  expect(
    (await PDFDocument.load(await f.vault.read(report.file))).getPageCount(),
  ).toBeGreaterThan(5);
  const files = await f.vault.list();
  vi.spyOn(f.repo, 'saveReports').mockRejectedValueOnce(
    new Error('Storage unavailable'),
  );
  await expect(
    f.reports.createReport(f.aquarium.id, entry.id, false),
  ).rejects.toThrow('Storage unavailable');
  expect(await f.vault.list()).toEqual(files);
});
