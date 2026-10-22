package com.appfactory.aquariumlog.nativecore

import android.app.Application
import android.net.Uri
import java.io.File
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class PdfAccessTest {
    private val context get() = RuntimeEnvironment.getApplication()
    @Test fun previewAndExportCanOnlyReadNonemptyPrivateFiles() {
        val valid = File(context.filesDir, "original.pdf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        assertEquals(valid.canonicalFile, privateDocument(context, Uri.fromFile(valid).toString()))
        val empty = File(context.cacheDir, "empty.pdf").apply { writeBytes(byteArrayOf()) }
        assertThrows(IllegalArgumentException::class.java) { privateDocument(context, Uri.fromFile(empty).toString()) }
        assertThrows(IllegalArgumentException::class.java) { privateDocument(context, "content://documents/example") }
        val outside = File(context.filesDir.parentFile, "outside.pdf").apply { writeBytes(byteArrayOf(1)) }
        assertThrows(IllegalArgumentException::class.java) { privateDocument(context, Uri.fromFile(outside).toString()) }
        assertThrows(IllegalArgumentException::class.java) { privateDocument(context, "file://${context.filesDir}/../outside.pdf") }
    }
}
