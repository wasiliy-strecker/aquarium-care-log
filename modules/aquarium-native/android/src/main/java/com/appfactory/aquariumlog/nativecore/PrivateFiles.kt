package com.appfactory.aquariumlog.nativecore

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import java.io.RandomAccessFile

internal fun privateFile(context: Context, uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Nur lokale App-Dateien können geöffnet werden." }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(listOf(context.filesDir, context.cacheDir).any {
        file.path.startsWith(it.canonicalPath + File.separator)
    }) { "Die Datei liegt außerhalb des privaten App-Speichers." }
    require(file.isFile && file.length() in 1..(128L * 1024 * 1024)) { "Die Datei fehlt oder ist zu groß." }
    return file
}

internal fun validatePhoto(file: File) {
    require(file.length() in 4..(50L * 1024 * 1024)) { "Das Foto ist leer oder zu groß." }
    RandomAccessFile(file, "r").use { input ->
        require(input.readUnsignedShort() == 0xffd8) { "Keine JPEG-Datei." }
        input.seek(file.length() - 2)
        require(input.readUnsignedShort() == 0xffd9) { "Die JPEG-Datei ist unvollständig." }
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    require(bounds.outMimeType == "image/jpeg" && bounds.outWidth in 1..1920 && bounds.outHeight in 1..1920) {
        "Das Foto ist kein lesbares JPEG mit höchstens 1920 Pixeln."
    }
    val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 })
    requireNotNull(bitmap) { "Das Foto konnte nicht gelesen werden." }.recycle()
}
