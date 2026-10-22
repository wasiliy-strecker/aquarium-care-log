import { messages } from '../texts';
import { interpolate } from '../domain/capture-data';
import {
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import { checkPdfPages } from '../files/limits';

const PAGE_WIDTH = 595.2756;
const PAGE_HEIGHT = 841.8898;
export const REPORT_ACCENT = rgb(23 / 255, 107 / 255, 117 / 255);
export const REPORT_GREY = rgb(97 / 255, 97 / 255, 97 / 255);
const BORDER = REPORT_GREY;
const HEADER_FILL = rgb(238 / 255, 238 / 255, 238 / 255);
const HISTORY_FILL = rgb(198 / 255, 238 / 255, 240 / 255);
const BLACK = rgb(0, 0, 0);
// Metrics of the bundled Roboto fonts, identical to Fahrzeugakte's PDF fonts.
const ASCENT = 1900 / 2048;
const LINE_HEIGHT = 2400 / 2048;

export type ReportFonts = { regular: PDFFont; bold: PDFFont };
type TextStyle = { size?: number; bold?: boolean; color?: RGB };

/** Paginates generated pages only. Imported PDF pages never receive decorations. */
export class ReportLayout {
  private page!: PDFPage;
  private pages: PDFPage[] = [];
  private top = 0;
  readonly margin: number;
  readonly width: number;
  private readonly start: number;
  private readonly bottom: number;

  constructor(
    private pdf: PDFDocument,
    private fonts: ReportFonts,
    private entryNumber?: number,
    private separator = false,
  ) {
    this.margin = separator ? 56.6929 : 40;
    this.width = PAGE_WIDTH - this.margin * 2;
    this.start = separator ? this.margin : 40 + 10 * LINE_HEIGHT + 10;
    this.bottom = separator
      ? PAGE_HEIGHT - this.margin
      : PAGE_HEIGHT - 40 - 8 * LINE_HEIGHT - 10;
    this.newPage();
  }

  private newPage() {
    checkPdfPages(this.pdf.getPageCount() + 1, true);
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.top = this.start;
  }

  ensure(height: number) {
    // Oversized text/table blocks are allowed to flow across pages below.
    if (
      this.top > this.start &&
      this.top + Math.min(height, this.bottom - this.start) > this.bottom
    )
      this.newPage();
  }

  gap(height: number) {
    this.top = Math.min(this.top + height, this.bottom);
  }

  private measure(text: string, font: PDFFont, size: number) {
    return text
      .split('→')
      .reduce(
        (width, part, i) =>
          width + font.widthOfTextAtSize(part, size) + (i ? size : 0),
        0,
      );
  }

  private wrap(text: string, width: number, font: PDFFont, size: number) {
    const lines: string[] = [];
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      let line = '';
      for (const word of paragraph.trim().split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measure(candidate, font, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = '';
        // Even an unbroken filename or user-entered identifier must fit.
        for (const character of word) {
          if (line && this.measure(line + character, font, size) > width) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  private drawLine(
    text: string,
    x: number,
    top: number,
    size: number,
    font: PDFFont,
    color = BLACK,
    page = this.page,
  ) {
    const baseline = PAGE_HEIGHT - top - size * ASCENT;
    // Roboto has no arrow glyph. Match the reference's vector arrow.
    for (const [index, part] of text.split('→').entries()) {
      if (index) {
        page.drawSvgPath('M0 3h8V0l4 4-4 4V5H0z', {
          x,
          y: baseline + (size * 8) / 12,
          scale: size / 12,
          color,
        });
        x += size;
      }
      if (part) page.drawText(part, { x, y: baseline, size, font, color });
      x += font.widthOfTextAtSize(part, size);
    }
  }

  text(
    text: string,
    { size = 12, bold = false, color = BLACK }: TextStyle = {},
  ) {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    for (const line of this.wrap(text, this.width, font, size)) {
      this.ensure(size * LINE_HEIGHT);
      this.drawLine(line, this.margin, this.top, size, font, color);
      this.top += size * LINE_HEIGHT;
    }
  }

  textHeight(text: string, size = 12, bold = false) {
    return (
      this.wrap(
        text,
        this.width,
        bold ? this.fonts.bold : this.fonts.regular,
        size,
      ).length *
      size *
      LINE_HEIGHT
    );
  }

  private cells(
    row: string[],
    widths: number[],
    bold: boolean,
    padding: number,
  ) {
    return row.map((cell, i) =>
      this.wrap(
        cell,
        widths[i]! - padding * 2,
        bold ? this.fonts.bold : this.fonts.regular,
        12,
      ),
    );
  }

  dataHeight(rows: string[][]) {
    const widths = [this.width / 2, this.width / 2];
    return rows.reduce((height, row, index) => {
      const cells = this.cells(row, widths, index === 0, 8);
      return (
        height +
        Math.max(...cells.map((cell) => cell.length)) * 12 * LINE_HEIGHT +
        12
      );
    }, 0);
  }

  private row(
    cells: string[][],
    widths: number[],
    bold: boolean,
    padding: number,
    fill?: RGB,
  ) {
    const height =
      Math.max(...cells.map((cell) => cell.length)) * 12 * LINE_HEIGHT + 12;
    let x = this.margin;
    for (const [index, lines] of cells.entries()) {
      this.page.drawRectangle({
        x,
        y: PAGE_HEIGHT - this.top - height,
        width: widths[index]!,
        height,
        borderWidth: 0.5,
        borderColor: BORDER,
        ...(fill ? { color: fill } : {}),
      });
      const textTop = this.top + (height - lines.length * 12 * LINE_HEIGHT) / 2;
      lines.forEach((line, i) =>
        this.drawLine(
          line,
          x + padding,
          textTop + i * 12 * LINE_HEIGHT,
          12,
          bold ? this.fonts.bold : this.fonts.regular,
        ),
      );
      x += widths[index]!;
    }
    this.top += height;
  }

  private table(rows: string[][], widths: number[], history: boolean) {
    const padding = history ? 6 : 8;
    const header = this.cells(rows[0]!, widths, true, padding);
    const headerHeight =
      Math.max(...header.map((cell) => cell.length)) * 12 * LINE_HEIGHT + 12;
    const fill = history ? HISTORY_FILL : HEADER_FILL;
    const repeatHeader = () => this.row(header, widths, true, padding, fill);
    this.ensure(headerHeight + 12 * LINE_HEIGHT + 12);
    for (const [index, row] of rows.entries()) {
      const cells = this.cells(row, widths, index === 0, padding);
      const count = Math.max(...cells.map((cell) => cell.length));
      const height = count * 12 * LINE_HEIGHT + 12;
      const availablePage =
        this.bottom - this.start - (history && index ? headerHeight : 0);
      if (height <= availablePage && this.top + height > this.bottom) {
        this.newPage();
        if (history && index) repeatHeader();
      }
      let offset = 0;
      while (offset < count) {
        let capacity = Math.floor(
          (this.bottom - this.top - 12) / (12 * LINE_HEIGHT),
        );
        if (capacity < 1) {
          this.newPage();
          if (history && index) repeatHeader();
          capacity = Math.floor(
            (this.bottom - this.top - 12) / (12 * LINE_HEIGHT),
          );
        }
        const length = Math.min(capacity, count - offset);
        this.row(
          cells.map((cell) => cell.slice(offset, offset + length)),
          widths,
          index === 0,
          padding,
          index === 0 ? fill : undefined,
        );
        offset += length;
      }
    }
  }

  dataTable(rows: string[][]) {
    this.table(rows, [this.width / 2, this.width / 2], false);
  }

  historyTable(rows: string[][]) {
    const remaining = this.width - 30;
    this.table(
      [[...messages.reportDocument.historyColumns], ...rows],
      [30, remaining * 0.36, remaining * 0.37, remaining * 0.27],
      true,
    );
  }
  photoRow(
    images: { image: PDFImage; number: number }[],
    total: number,
    context?: string,
  ) {
    const height = 170;
    this.ensure(height + (context ? 55 : 30));
    if (context) {
      this.text(context, { size: 10 });
      this.gap(6);
    }
    const width = (this.width - 12) / 2;
    const start =
      this.margin + (images.length === 1 ? (this.width - width) / 2 : 0);
    for (const [index, { image, number }] of images.entries()) {
      const x = start + index * (width + 12);
      this.drawLine(
        interpolate(messages.reportDocument.photo, { number, total }),
        x,
        this.top,
        11,
        this.fonts.bold,
      );
      const top = this.top + 22;
      const fit = image.scaleToFit(width, height);
      this.page.drawRectangle({
        x,
        y: PAGE_HEIGHT - top - height,
        width,
        height,
        borderWidth: 0.5,
        borderColor: BORDER,
      });
      this.page.drawImage(image, {
        x: x + (width - fit.width) / 2,
        y: PAGE_HEIGHT - top - (height + fit.height) / 2,
        ...fit,
      });
    }
    this.top += height + 22;
    this.gap(12);
  }

  finish() {
    if (this.separator) return;
    this.pages.forEach((page, index) => {
      this.drawLine(
        messages.reportDocument.brand,
        40,
        40,
        10,
        this.fonts.bold,
        REPORT_ACCENT,
        page,
      );
      const label = interpolate(messages.reportDocument.page, {
        page: index + 1,
        total: this.pages.length,
      });
      this.drawLine(
        label,
        PAGE_WIDTH - 40 - this.measure(label, this.fonts.regular, 9),
        40 + LINE_HEIGHT / 2,
        9,
        this.fonts.regular,
        REPORT_GREY,
        page,
      );
      this.drawLine(
        messages.reportDocument.footer,
        40,
        PAGE_HEIGHT - 40 - 8 * LINE_HEIGHT,
        8,
        this.fonts.regular,
        REPORT_GREY,
        page,
      );
    });
  }
}
