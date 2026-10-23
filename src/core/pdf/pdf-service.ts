import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CareEntry, Aquarium } from '../domain/models';
import {
  entryLabel,
  measurementText,
  measurementValueText,
} from '../domain/models';
import {
  captureDifferences,
  interpolate,
  entryDateTime,
} from '../domain/capture-data';
import { messages } from '../texts';
import type { FileVault } from '../ports';
import { verifiedFile } from '../files/integrity';
import {
  ContentLimitError,
  MAX_FILE_BYTES,
  checkPdfPages,
} from '../files/limits';
import { ReportLayout, REPORT_ACCENT, REPORT_GREY } from './report-layout';
export async function inspectPdf(bytes: Uint8Array): Promise<PDFDocument> {
  if (bytes.length > MAX_FILE_BYTES)
    throw new ContentLimitError('Die PDF überschreitet die Grenze von 50 MB.');
  if (bytes.length < 20) throw new Error('Die PDF ist leer oder beschädigt.');
  const head = String.fromCharCode(...bytes.slice(0, 8));
  const tail = String.fromCharCode(...bytes.slice(-2048));
  if (!head.startsWith('%PDF-') || !tail.includes('%%EOF'))
    throw new Error('Die PDF ist beschädigt oder unvollständig.');
  try {
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    if (pdf.isEncrypted)
      throw new Error('Passwortgeschützte PDFs werden nicht unterstützt.');
    checkPdfPages(pdf.getPageCount());
    if (!pdf.getPageCount()) throw new Error('Die PDF hat keine Seiten.');
    for (const page of pdf.getPages()) {
      if (
        !Number.isFinite(page.getWidth()) ||
        !Number.isFinite(page.getHeight()) ||
        page.getWidth() <= 0 ||
        page.getHeight() <= 0
      )
        throw new Error('Ungültiges Seitenformat.');
    }
    return pdf;
  } catch (error) {
    if (error instanceof ContentLimitError) throw error;
    if (
      String(error).toLowerCase().includes('encrypt') ||
      String(error).includes('Passwort')
    )
      throw new Error(
        'Diese PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie verwenden.',
      );
    throw new Error(
      'Die PDF ist beschädigt oder enthält keine lesbaren Seiten.',
    );
  }
}

export type ReportFontBytes = { regular: Uint8Array; bold: Uint8Array };
export type ReportOptions = { kind: 'single' | 'history'; createdAt: string };
const text = messages.reportDocument;
const content = messages.reportContent;
export class PdfService {
  constructor(
    private vault: FileVault,
    private fontBytes: () => Promise<ReportFontBytes>,
  ) {}
  private async fonts(pdf: PDFDocument) {
    pdf.registerFontkit(fontkit);
    const bytes = await this.fontBytes();
    return {
      regular: await pdf.embedFont(bytes.regular, { subset: true }),
      bold: await pdf.embedFont(bytes.bold, { subset: true }),
    };
  }
  async addPartCover(
    pdf: PDFDocument,
    aquarium: Aquarium,
    index: number,
    total: number,
    createdAt: string,
  ) {
    const cover = new ReportLayout(pdf, await this.fonts(pdf), undefined, true);
    cover.text(text.brand, { size: 24, bold: true });
    cover.gap(24);
    cover.text(aquarium.name, { size: 20 });
    cover.gap(16);
    const title = interpolate(text.partTitle, { part: index, total });
    cover.text(title, { size: 18 });
    cover.gap(16);
    cover.text(
      interpolate(content.created, {
        date: new Date(createdAt).toLocaleString('de-DE'),
      }),
    );
    cover.gap(24);
    cover.text(interpolate(text.partKeep, { total }));
    if (index > 1) {
      cover.gap(12);
      cover.text(interpolate(text.partContinued, { part: index - 1 }));
    }
    pdf.setTitle(`${title} · ${aquarium.name}`);
    pdf.setAuthor('AquariumLog');
    pdf.setCreationDate(new Date(createdAt));
  }
  async create(
    aquarium: Aquarium,
    steps: CareEntry[],
    full: boolean,
    options: ReportOptions,
  ): Promise<Uint8Array> {
    const ordered = [...steps].sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        b.id.localeCompare(a.id),
    );
    if (!ordered.length) throw new Error(content.noSteps);
    if (ordered.some((s) => s.aquariumId !== aquarium.id))
      throw new Error(content.noStep);
    if (full && !ordered.some((s) => s.attachments.length))
      throw new Error(content.noAttachments);
    if (
      full &&
      ordered.reduce(
        (sum, s) => sum + s.attachments.reduce((n, p) => n + p.size, 0),
        0,
      ) >
        64 * 1024 * 1024
    )
      throw new ContentLimitError(
        'Die Fotos dieses Protokolls überschreiten 64 MB. Bitte Einzelprotokolle oder eine PDF ohne Fotos erstellen.',
      );
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${content.documentTitle} · ${aquarium.name}`);
    pdf.setAuthor('AquariumLog');
    pdf.setProducer('AquariumLog');
    pdf.setCreationDate(new Date(options.createdAt));
    const layout = new ReportLayout(pdf, await this.fonts(pdf));
    layout.gap(16);
    layout.text(content.documentTitle, { size: 24, bold: true });
    layout.gap(4);
    layout.text(options.kind === 'single' ? text.single : text.history, {
      size: 14,
      color: REPORT_GREY,
    });
    layout.gap(6);
    layout.text(
      interpolate(text.created, {
        date: new Date(options.createdAt).toLocaleString('de-DE'),
        mode: full ? content.withPhotoLabel : content.withoutPhotoLabel,
      }),
      { size: 9, color: REPORT_GREY },
    );
    layout.gap(18);
    layout.text(text.aquariumTitle, { bold: true });
    layout.gap(6);
    layout.dataTable([
      [text.aquarium, aquarium.name],
      [
        text.volume,
        aquarium.volumeLiters === null
          ? text.notProvided
          : `${aquarium.volumeLiters.toLocaleString('de-DE')} l`,
      ],
      [text.dimensions, aquarium.dimensions || text.notProvided],
      [text.location, aquarium.location || text.notProvided],
    ]);
    layout.gap(18);
    if (options.kind === 'history') {
      layout.historyTable(
        ordered.map((s, i) => [
          String(ordered.length - i),
          entryDateTime(s, true),
          entryLabel(s),
          measurementText(s),
        ]),
      );
      layout.gap(18);
    }
    for (const step of ordered) {
      const rows = [
        [text.activity, entryLabel(step)],
        [text.time, entryDateTime(step, true)],
      ];
      if (step.measurement)
        rows.push(
          [text.measurement, step.measurement.label],
          [text.value, measurementValueText(step.measurement.value)],
          [text.unit, step.measurement.unit || '–'],
        );
      // Keep the heading, fields and first image pair together when they fit on a page.
      layout.ensure(
        layout.dataHeight(rows) +
          50 +
          (full && step.attachments.length ? 205 : 0),
      );
      layout.text(entryLabel(step), {
        size: 17,
        bold: true,
        color: REPORT_ACCENT,
      });
      layout.gap(8);
      layout.dataTable(rows);
      layout.gap(10);
      if (full)
        for (let index = 0; index < step.attachments.length; index += 2) {
          const images = [];
          for (
            let i = index;
            i < Math.min(index + 2, step.attachments.length);
            i++
          ) {
            const photo = step.attachments[i]!;
            try {
              images.push({
                image: await pdf.embedJpg(
                  await verifiedFile(this.vault, photo),
                ),
                number: i + 1,
              });
            } catch {
              throw new Error(
                `${entryLabel(step)} · ${photo.name}: Das Foto fehlt oder ist beschädigt. Bitte ersetzen oder eine PDF ohne Fotos erstellen.`,
              );
            }
          }
          layout.photoRow(
            images,
            step.attachments.length,
            index
              ? interpolate(text.continued, {
                  step: entryLabel(step),
                  time: entryDateTime(step, true),
                })
              : undefined,
          );
        }
      if (step.timezoneOffsetMinutes == null) {
        layout.text(content.unknownZone, { size: 9, color: REPORT_GREY });
        layout.gap(8);
      }
      const differences = captureDifferences(step, aquarium);
      if (!step.aquariumAtCapture) {
        layout.text(content.unknownCapture, { size: 9, color: REPORT_GREY });
        layout.gap(8);
      } else if (differences.length) {
        layout.ensure(60);
        layout.text(content.captureTitle, { bold: true });
        layout.gap(6);
        layout.dataTable(differences);
        layout.gap(8);
      }
      if (step.note.trim()) {
        layout.ensure(45);
        layout.text(text.note, { bold: true });
        layout.gap(4);
        layout.text(step.note);
      }
      layout.gap(18);
    }
    layout.finish();
    checkPdfPages(pdf.getPageCount(), true);
    const result = await pdf.save();
    if (result.length > MAX_FILE_BYTES)
      throw new ContentLimitError(
        'Das Protokoll überschreitet 50 MB. Bitte kleinere Einzelprotokolle oder eine PDF ohne Fotos erstellen.',
      );
    return result;
  }
}
