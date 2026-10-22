package com.appfactory.aquariumlog.nativecore

import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

class OriginalPdfPrintAdapter(private val file: File, private val name: String) : PrintDocumentAdapter() {
    private val executor = Executors.newSingleThreadExecutor()
    override fun onLayout(oldAttributes: PrintAttributes?, newAttributes: PrintAttributes?, cancellation: CancellationSignal, callback: LayoutResultCallback, extras: Bundle?) {
        if (cancellation.isCanceled) { callback.onLayoutCancelled(); return }
        try {
            val count = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor -> PdfRenderer(descriptor).use { it.pageCount } }
            callback.onLayoutFinished(PrintDocumentInfo.Builder(name).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(count).build(), true)
        } catch (_: Exception) { callback.onLayoutFailed("Die PDF konnte nicht zum Drucken geöffnet werden.") }
    }
    override fun onWrite(pages: Array<out PageRange>, destination: ParcelFileDescriptor, cancellation: CancellationSignal, callback: WriteResultCallback) {
        executor.execute {
            try {
                file.inputStream().use { input ->
                    FileOutputStream(destination.fileDescriptor).use { output ->
                        val buffer = ByteArray(65536)
                        while (!cancellation.isCanceled) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            output.write(buffer, 0, count)
                        }
                    }
                }
                if (cancellation.isCanceled) callback.onWriteCancelled()
                else callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
            } catch (_: Exception) { callback.onWriteFailed("Die PDF konnte nicht gedruckt werden.") }
        }
    }
    override fun onFinish() { executor.shutdown() }
}
