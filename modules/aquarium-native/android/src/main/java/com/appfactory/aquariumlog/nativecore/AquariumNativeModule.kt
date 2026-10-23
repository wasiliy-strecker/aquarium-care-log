package com.appfactory.aquariumlog.nativecore

import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.util.UUID

class AquariumNativeModule : Module() {
    private var previews: PdfPreviewStore? = null
    private var reminderObserver: ReminderStatusObserver? = null
    @Synchronized private fun previewStore(): PdfPreviewStore = previews ?: PdfPreviewStore(context).also { previews = it }
    private val context get() = requireNotNull(appContext.reactContext)
    override fun definition() = ModuleDefinition {
        Name("AquariumNative")
        Events(REMINDER_STATUS_EVENT)
        OnStartObserving(REMINDER_STATUS_EVENT) {
            val observer = reminderObserver ?: ReminderStatusObserver(context) {
                sendEvent(REMINDER_STATUS_EVENT)
            }.also { reminderObserver = it }
            observer.start()
        }
        OnStopObserving(REMINDER_STATUS_EVENT) { reminderObserver?.stop() }
        View(AquariumPdfView::class) {
            Prop("session") { view: AquariumPdfView, id: String -> view.open(previewStore(), id) }
        }
        AsyncFunction("openPdfPreview") { uri: String -> previewStore().open(uri) }
        AsyncFunction("renderPdfPage") { session: String, index: Int, width: Int -> previewStore().render(session, index, width) }
        AsyncFunction("closePdfPreview") { session: String -> previewStore().close(session) }
        AsyncFunction("sharePdfs") { uris: List<String> ->
            context.startActivity(pdfShareIntent(context, uris))
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("printPdf") { uri: String, name: String ->
            val file = privateDocument(context, uri)
            val activity = requireNotNull(appContext.currentActivity)
            val manager = activity.getSystemService(android.content.Context.PRINT_SERVICE) as android.print.PrintManager
            manager.print(name, OriginalPdfPrintAdapter(file, name), null)
            Unit
        }.runOnQueue(Queues.MAIN)
        OnDestroy {
            reminderObserver?.stop()
            previews?.closeAll()
        }
        AsyncFunction("validatePhoto") { uri: String -> validatePhoto(privateFile(context, uri)); Unit }
        AsyncFunction("saveBackupFile") { uri: String, name: String, promise: Promise ->
            try {
                val file = privateFile(context, uri)
                val token = UUID.randomUUID().toString()
                if (!SaveDocumentActivity.begin(token, SaveDocumentActivity.Pending(file, name, promise))) {
                    promise.reject("SAVE_BUSY", "Eine Speicherortauswahl ist bereits geöffnet.", null)
                } else {
                    try { requireNotNull(appContext.currentActivity).startActivity(Intent(context, SaveDocumentActivity::class.java).putExtra("save_token", token)) }
                    catch (_: Exception) { SaveDocumentActivity.finish(token, false, "Die Speicherortauswahl konnte nicht geöffnet werden.") }
                }
            } catch (_: Exception) { promise.reject("SAVE_SOURCE", "Die vorbereitete Backup-Datei ist nicht verfügbar.", null) }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("deriveBackupKey") { password: String, salt: String, iterations: Int ->
            PasswordKey.derive(password, salt, iterations)
        }
        AsyncFunction("syncReminders") { json: String ->
            val desired = JSONArray(json)
            val ids = mutableSetOf<String>()
            val warnings = mutableListOf<String>()
            for (index in 0 until desired.length()) {
                val reminder = requireNotNull(StoredReminder.fromJson(desired.getJSONObject(index).toString()))
                ids.add(reminder.aquariumId)
                if (!ReminderScheduler.update(context, reminder)) warnings.add("${reminder.label}: Erinnerung konnte nicht geplant werden.")
                if (ReminderNotifier.availability(context, reminder.isPunctual) != ReminderAvailability.AVAILABLE) warnings.add("${reminder.label}: Benachrichtigungen sind nicht freigegeben.")
                if (reminder.isPunctual && !ReminderScheduler.canScheduleExact(context)) warnings.add("${reminder.label}: Ohne Freigabe für genaue Alarme erinnert Android möglicherweise später.")
            }
            ReminderStore.statusIds(context).filter { !ids.contains(it) }.forEach {
                if (!ReminderScheduler.cancel(context, it)) warnings.add("Eine alte Erinnerung konnte nicht vollständig entfernt werden.")
            }
            notifyReminderStatusChanged(context)
            warnings
        }
        AsyncFunction("reminderStatus") {
            mapOf("notifications" to ReminderNotifier.notificationsEnabled(context),
                "exact" to ReminderScheduler.canScheduleExact(context),
                "doNotDisturb" to ReminderNotifier.doNotDisturbEnabled(context),
                "availability" to mapOf("normal" to ReminderNotifier.availability(context, false).wireValue,
                    "punctualWithSound" to ReminderNotifier.availability(context, true).wireValue),
                "schedules" to ReminderStore.statusIds(context).map { ReminderScheduler.status(context, it) })
        }
        AsyncFunction("acknowledge") { id: String ->
            ReminderNotifier.acknowledge(context, id)
            notifyReminderStatusChanged(context)
        }
        AsyncFunction("testReminder") { request: Map<String, String?> ->
            val mode = requireNotNull(request["deliveryMode"])
            require(mode == "normal" || mode == "punctualWithSound")
            ReminderNotifier.showTest(context, request["aquariumId"], request["label"].orEmpty(),
                request["categoryLabel"].orEmpty(), request["latestValue"], null, mode == "punctualWithSound")
        }
        AsyncFunction("openReminderSettings") { target: String, mode: String? ->
            openReminderSettings(context, target, mode)
        }.runOnQueue(Queues.MAIN)
        OnActivityEntersForeground {
            ReminderScheduler.rescheduleAll(context)
            notifyReminderStatusChanged(context)
        }
    }
}
