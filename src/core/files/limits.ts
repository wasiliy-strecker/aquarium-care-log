export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_EDGE = 1920;
export class ContentLimitError extends Error {}

export const MAX_PDF_PAGES = 2000;
export function checkPdfPages(pages: number, report = false): void {
  if (pages > MAX_PDF_PAGES)
    throw new ContentLimitError(
      report
        ? 'Das Protokoll überschreitet 2000 Seiten. Bitte kleinere Einzelprotokolle erstellen.'
        : 'Die PDF überschreitet 2000 Seiten.',
    );
}
