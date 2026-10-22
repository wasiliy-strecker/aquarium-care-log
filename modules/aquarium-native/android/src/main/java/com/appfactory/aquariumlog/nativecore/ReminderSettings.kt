package com.appfactory.aquariumlog.nativecore

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

internal fun reminderSettingsIntents(context: Context, target: String, mode: String?): List<Intent> {
    val packageUri = Uri.parse("package:" + context.packageName)
    val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(packageUri)
    val intents = when (target) {
        "exact" -> if (Build.VERSION.SDK_INT >= 31) listOf(
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(packageUri),
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM),
        ) else listOf(details)
        "doNotDisturb" -> listOf(Intent("android.settings.ZEN_MODE_SETTINGS"), Intent(Settings.ACTION_SOUND_SETTINGS))
        "notifications", "channel" -> {
            val options = mutableListOf<Intent>()
            if (Build.VERSION.SDK_INT >= 26) {
                if (target == "channel") {
                    require(mode == "normal" || mode == "punctualWithSound")
                    options.add(Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        .putExtra(Settings.EXTRA_CHANNEL_ID, ReminderNotifier.channelId(mode == "punctualWithSound")))
                }
                options.add(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }
            options.add(details)
            options
        }
        else -> throw IllegalArgumentException("Unbekanntes Einstellungsziel.")
    }
    return intents.map { it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
}

internal fun openReminderSettings(context: Context, target: String, mode: String?): Boolean {
    for (intent in reminderSettingsIntents(context, target, mode)) {
        try {
            context.startActivity(intent)
            return true
        } catch (_: Exception) {
            // Android variants can expose only a fallback settings page.
        }
    }
    return false
}
