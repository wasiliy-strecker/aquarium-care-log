package com.appfactory.aquariumlog.nativecore

import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.util.UUID

class AquariumNativeModule : Module() {
    private val context get() = requireNotNull(appContext.reactContext)
    override fun definition() = ModuleDefinition {
        Name("AquariumNative")
        AsyncFunction("validatePhoto") { uri: String -> validatePhoto(privateFile(context, uri)) }
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
            ReminderStore.all(context).filter { !ids.contains(it.aquariumId) }.forEach {
                if (!ReminderScheduler.cancel(context, it.aquariumId)) warnings.add("Eine alte Erinnerung konnte nicht vollständig entfernt werden.")
            }
            warnings
        }
        AsyncFunction("reminderStatus") {
            mapOf("notifications" to ReminderNotifier.notificationsEnabled(context),
                "exact" to ReminderScheduler.canScheduleExact(context),
                "doNotDisturb" to ReminderNotifier.doNotDisturbEnabled(context),
                "schedules" to ReminderStore.all(context).map { ReminderScheduler.status(context, it.aquariumId) })
        }
        AsyncFunction("acknowledge") { id: String -> ReminderNotifier.acknowledge(context, id) }
        AsyncFunction("testReminder") { punctual: Boolean ->
            ReminderNotifier.showTest(context, null, "AquariumLog", "aquarium", "Test", null, null, punctual)
        }
        AsyncFunction("openReminderSettings") { exact: Boolean ->
            context.startActivity(reminderSettingsIntent(context, exact))
        }.runOnQueue(Queues.MAIN)
        OnActivityEntersForeground { ReminderScheduler.rescheduleAll(context) }
    }
}
