package com.appfactory.aquariumlog.nativecore

import android.os.Bundle
import android.provider.DocumentsContract
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import expo.modules.kotlin.Promise
import java.io.File
import java.util.concurrent.Executors

class SaveDocumentActivity : ComponentActivity() {
    data class Pending(val file: File, val name: String, val promise: Promise, var writing: Boolean = false)
    companion object {
        private val pending = mutableMapOf<String, Pending>()
        @Synchronized fun begin(token: String, value: Pending): Boolean {
            if (pending.isNotEmpty()) return false
            pending[token] = value
            return true
        }
        @Synchronized fun get(token: String): Pending? = pending[token]
        @Synchronized fun takeForWrite(token: String): Pending? {
            val item = pending[token] ?: return null
            if (item.writing) return null
            item.writing = true
            return item
        }
        @Synchronized fun finish(token: String, saved: Boolean, error: String? = null) {
            val item = pending.remove(token) ?: return
            if (error != null) item.promise.reject("SAVE_FAILED", error, null)
            else item.promise.resolve(mapOf("status" to if (saved) "saved" else "cancelled", "name" to item.name))
        }
    }
    private val token get() = intent.getStringExtra("save_token") ?: ""
    private val launcher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri == null) { finish(token, false); finish(); return@registerForActivityResult }
        val request = takeForWrite(token)
        if (request == null) { finish(); return@registerForActivityResult }
        val executor = Executors.newSingleThreadExecutor()
        executor.execute {
            try {
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).use { output -> request.file.inputStream().use { input -> input.copyTo(output) } }
                finish(token, true)
            } catch (_: Exception) {
                // ACTION_CREATE_DOCUMENT supplies a newly created destination, never an app vault file.
                try { DocumentsContract.deleteDocument(contentResolver, uri) } catch (_: Exception) { }
                finish(token, false, "Das Backup konnte nicht am gewählten Ort gespeichert werden. Die vorbereitete Sicherung bleibt zum erneuten Speichern verfügbar.")
            } finally { executor.shutdown(); runOnUiThread { finish() } }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val request = get(token)
        if (request == null) { finish(); return }
        if (savedInstanceState == null) launcher.launch(request.name)
    }
}
