package com.appfactory.aquariumlog.nativecore

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.util.UUID
import kotlin.math.min
import kotlin.math.roundToInt

internal fun privateDocument(context: Context, uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Nur lokale App-Dateien können geöffnet werden." }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(listOf(context.filesDir, context.cacheDir).any {
        file.path.startsWith(it.canonicalPath + File.separator)
    }) { "Die Datei liegt außerhalb des privaten App-Speichers." }
    require(file.isFile && file.length() in 1..(128L * 1024 * 1024)) { "Die Datei fehlt oder ist zu groß." }
    return file
}

class PdfPreviewStore(private val context: Context) {
    private val sessions = mutableMapOf<String, File>()
    private val root = File(context.cacheDir, "pdf-previews")

    init { root.deleteRecursively() }

    @Synchronized
    fun open(uri: String): Map<String, Any> {
        val file = privateDocument(context, uri)
        val pages = withRenderer(file) { renderer ->
            require(renderer.pageCount > 0) { "Die PDF enthält keine Seiten." }
            require(renderer.pageCount <= 2000) { "Die PDF überschreitet die Grenze von 2000 Seiten." }
            (0 until renderer.pageCount).map { index ->
                renderer.openPage(index).use { page -> mapOf("width" to page.width, "height" to page.height) }
            }
        }
        val id = UUID.randomUUID().toString()
        sessions[id] = file
        File(root, id).mkdirs()
        return mapOf("session" to id, "pages" to pages)
    }

    @Synchronized
    fun dimensions(id: String): List<Pair<Int, Int>> {
        val source = requireNotNull(sessions[id]) { "Die PDF-Vorschau wurde geschlossen." }
        return withRenderer(source) { renderer ->
            (0 until renderer.pageCount).map { index -> renderer.openPage(index).use { it.width to it.height } }
        }
    }

    @Synchronized
    fun render(id: String, index: Int, requestedWidth: Int): String {
        val source = requireNotNull(sessions[id]) { "Die PDF-Vorschau wurde geschlossen." }
        val width = requestedWidth.coerceIn(256, 2048)
        val directory = File(root, id)
        val output = File(directory, "$index-$width.png")
        if (output.exists()) return Uri.fromFile(output).toString()
        withRenderer(source) { renderer ->
            require(index in 0 until renderer.pageCount) { "Ungültige PDF-Seite." }
            renderer.openPage(index).use { page ->
                val scale = min(width.toDouble() / page.width, 2048.0 / maxOf(page.width, page.height))
                val bitmap = Bitmap.createBitmap(maxOf(1, (page.width * scale).roundToInt()), maxOf(1, (page.height * scale).roundToInt()), Bitmap.Config.ARGB_8888)
                try {
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    val pending = File(directory, "$index-$width.tmp")
                    try {
                        pending.outputStream().use { require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                        check(pending.renameTo(output)) { "Die Vorschauseite konnte nicht gespeichert werden." }
                    } finally { pending.delete() }
                } finally { bitmap.recycle() }
            }
        }
        // Keep only a bounded on-disk working set. Original PDFs are never changed.
        directory.listFiles()?.filter { it.extension == "png" && it != output }
            ?.sortedByDescending { it.lastModified() }?.drop(5)?.forEach { it.delete() }
        return Uri.fromFile(output).toString()
    }

    @Synchronized
    fun close(id: String) {
        if (sessions.remove(id) != null) File(root, id).deleteRecursively()
    }

    @Synchronized
    fun closeAll() { sessions.keys.toList().forEach(::close) }

    private fun <T> withRenderer(file: File, action: (PdfRenderer) -> T): T =
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            PdfRenderer(descriptor).use(action)
        }
}
