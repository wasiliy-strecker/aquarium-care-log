package com.appfactory.aquariumlog.nativecore

import android.content.ClipData
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider

internal fun pdfShareIntent(context: Context, uris: List<String>): Intent {
    require(uris.size in 1..20) { "Keine oder zu viele Protokollteile." }
    val shared = ArrayList(uris.map { uri ->
        val file = privateDocument(context, uri)
        require(file.extension.equals("pdf", ignoreCase = true)) { "Nur PDFs können als Protokoll geteilt werden." }
        FileProvider.getUriForFile(context, context.packageName + ".aquariumlog.files", file)
    })
    val clips = ClipData.newUri(context.contentResolver, "Aquariumpflegeprotokoll", shared.first())
    shared.drop(1).forEach { clips.addItem(ClipData.Item(it)) }
    val intent = if (shared.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, shared.first())
        else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, shared)
    intent.setType("application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    intent.clipData = clips
    return Intent.createChooser(intent, if (shared.size == 1) "Aquariumpflegeprotokoll teilen" else "Alle Protokollteile teilen")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
}
