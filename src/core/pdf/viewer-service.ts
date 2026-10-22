import type { SavedReport } from '../domain/models';
import type { AquariumService } from '../../features/entries/entry-service';
import type { AquariumNative, PdfSession } from '../native/aquarium-native';
import { verifiedFile } from '../files/integrity';
import { messages } from '../texts';
export type OpenPdf = SavedReport & {
  uri: string;
  preview: PdfSession;
  parts: SavedReport[];
};
export class PdfViewerService {
  constructor(
    private aquariumService: AquariumService,
    private native: AquariumNative,
  ) {}
  async open(id: string): Promise<OpenPdf> {
    const data = await this.aquariumService.repository.snapshot();
    const report = data.reports.find((r) => r.id === id);
    if (!report) throw new Error(messages.reportContent.missingPdf);
    await verifiedFile(this.aquariumService.vault, report);
    const uri = this.aquariumService.vault.uri(report.file);
    return {
      ...report,
      uri,
      preview: await this.native.openPdfPreview(uri),
      parts: report.groupId
        ? data.reports
            .filter((r) => r.groupId === report.groupId)
            .sort((a, b) => a.partIndex! - b.partIndex!)
        : [report],
    };
  }
  page(pdf: OpenPdf, index: number, width: number) {
    return this.native.renderPdfPage(pdf.preview.session, index, width);
  }
  close(pdf: OpenPdf) {
    return this.native.closePdfPreview(pdf.preview.session);
  }
  async print(pdf: OpenPdf) {
    await verifiedFile(this.aquariumService.vault, pdf);
    await this.native.printPdf(pdf.uri, pdf.name + '.pdf');
  }
  async share(reports: SavedReport[]) {
    for (const report of reports)
      await verifiedFile(this.aquariumService.vault, report);
    await this.native.sharePdfs(
      reports.map((r) => this.aquariumService.vault.uri(r.file)),
    );
  }
}
