package com.appfactory.aquariumlog.nativecore

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.os.SystemClock
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

internal object ReminderScheduler {
    private const val fireAction =
        "com.appfactory.aquariumlog.nativecore.FIRE_AQUARIUM_REMINDER"

    fun update(context: Context, reminder: StoredReminder): Boolean {
        val triggerAt = reminder.nextTriggerForUpdate(
            ReminderStore.find(context, reminder.aquariumId),
            ReminderStore.nextTrigger(context, reminder.aquariumId),
            System.currentTimeMillis(),
        )
        return scheduleAt(context, reminder, triggerAt)
    }

    fun scheduleNext(context: Context, reminder: StoredReminder): Boolean =
        scheduleAt(context, reminder, reminder.nextTriggerAfter(System.currentTimeMillis()))

    private fun scheduleAt(context: Context, reminder: StoredReminder, triggerAt: Long): Boolean {
        return try {
            val alarmManager = context.getSystemService(AlarmManager::class.java)
            val operation = requireNotNull(firePendingIntent(context, reminder.aquariumId, false))
            val exact = reminder.isPunctual && canScheduleExact(context)
            if (exact) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAt,
                        operation,
                    )
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, operation)
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAt,
                    operation,
                )
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, operation)
            }
            // Persist only after Android accepts the alarm. Reusing the PendingIntent
            // replaces its alarm without losing a due but delayed occurrence.
            ReminderStore.save(context, reminder, triggerAt, exact)
            true
        } catch (_: Exception) {
            // A queued old alarm must not deliver a new, unaccepted schedule.
            ReminderStore.planningFailed(context, reminder, triggerAt)
            false
        }
    }

    fun cancelPending(context: Context, aquariumId: String) {
        val operation = firePendingIntent(context, aquariumId, true) ?: return
        context.getSystemService(AlarmManager::class.java).cancel(operation)
        operation.cancel()
    }

    fun cancel(context: Context, aquariumId: String): Boolean {
        ReminderStore.remove(context, aquariumId)
        return try {
            cancelPending(context, aquariumId)
            ReminderNotifier.acknowledge(context, aquariumId)
            true
        } catch (_: Exception) {
            ReminderStore.cancelFailed(context, aquariumId)
            false
        }
    }

    fun status(context: Context, aquariumId: String, activeIds: Set<String> = ReminderNotifier.activeAquariumIds(context)): Map<String, Any?> = mapOf(
        "aquariumId" to aquariumId,
        "isNotificationActive" to activeIds.contains(aquariumId),
        "lastTriggeredAtMillis" to ReminderStore.lastTriggered(context, aquariumId),
        "nextTriggerAtMillis" to ReminderStore.nextTrigger(context, aquariumId),
        "planningState" to ReminderStore.planningState(context, aquariumId),
        "isExact" to ReminderStore.isExact(context, aquariumId),
        "deliveryFailed" to ReminderStore.deliveryFailed(context, aquariumId),
    )

    fun rescheduleAll(context: Context, clockChanged: Boolean = false) {
        ReminderStore.statusIds(context).filter { ReminderStore.planningState(context, it) == "cancelFailed" }
            .forEach { cancel(context, it) }
        ReminderStore.all(context).forEach { reminder ->
            if (clockChanged) {
                scheduleNext(context, reminder)
            } else {
                update(context, reminder)
            }
        }
    }

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return context.getSystemService(AlarmManager::class.java)
            .canScheduleExactAlarms()
    }

    private fun firePendingIntent(
        context: Context,
        aquariumId: String,
        onlyIfExisting: Boolean,
    ): PendingIntent? {
        val intent = Intent(context, AquariumReminderReceiver::class.java)
            .setAction(fireAction)
            .setData(
                Uri.Builder()
                    .scheme("aquariumlog")
                    .authority("reminder")
                    .appendPath(aquariumId)
                    .build(),
            )
            .putExtra("aquarium_id", aquariumId)
        var flags = PendingIntent.FLAG_IMMUTABLE
        flags = flags or if (onlyIfExisting) {
            PendingIntent.FLAG_NO_CREATE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getBroadcast(
            context,
            stableRequestCode(aquariumId, 0),
            intent,
            flags,
        )
    }
}

internal enum class ReminderAvailability(val wireValue: String) {
    AVAILABLE("available"),
    APP_BLOCKED("appBlocked"),
    CHANNEL_BLOCKED("channelBlocked"),
    UNKNOWN("unknown"),
}

internal object ReminderNotifier {
    private val notificationColor = Color.rgb(23, 107, 117)
    private const val normalChannelId = "aquariumlog_reminders"
    private const val alarmChannelId = "aquariumlog_alarm_reminders_v1"
    private const val aquariumNotificationId = 1001
    private const val testNotificationId = 2001
    private const val aquariumTagPrefix = "aquarium:"
    private const val testTag = "reminder:test"

    fun channelId(punctual: Boolean): String = if (punctual) alarmChannelId else normalChannelId

    fun availability(context: Context, punctual: Boolean): ReminderAvailability = try {
        if (!notificationsEnabled(context)) {
            ReminderAvailability.APP_BLOCKED
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Reusing the same IDs preserves the user's channel preferences.
            ensureChannels(context)
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = manager.getNotificationChannel(channelId(punctual))
            val groupBlocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && channel?.group != null) {
                manager.getNotificationChannelGroup(channel.group)?.isBlocked == true
            } else {
                false
            }
            when {
                channel == null -> ReminderAvailability.UNKNOWN
                channel.importance == NotificationManager.IMPORTANCE_NONE || groupBlocked ->
                    ReminderAvailability.CHANNEL_BLOCKED
                else -> ReminderAvailability.AVAILABLE
            }
        } else {
            ReminderAvailability.AVAILABLE
        }
    } catch (_: Exception) {
        ReminderAvailability.UNKNOWN
    }

    fun doNotDisturbEnabled(context: Context): Boolean? = try {
        // Reading the current filter needs no notification-policy access.
        when (context.getSystemService(NotificationManager::class.java).currentInterruptionFilter) {
            NotificationManager.INTERRUPTION_FILTER_ALL -> false
            NotificationManager.INTERRUPTION_FILTER_PRIORITY,
            NotificationManager.INTERRUPTION_FILTER_ALARMS,
            NotificationManager.INTERRUPTION_FILTER_NONE -> true
            else -> null
        }
    } catch (_: Exception) {
        null
    }

    fun notificationsEnabled(context: Context): Boolean {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }
        val manager = context.getSystemService(NotificationManager::class.java)
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.N ||
            manager.areNotificationsEnabled()
    }

    fun showAquarium(
        context: Context,
        reminder: StoredReminder,
        postedAt: Long = System.currentTimeMillis(),
    ): Long? {
        if (availability(context, reminder.isPunctual) != ReminderAvailability.AVAILABLE) return null
        val channelId = channelId(reminder.isPunctual)
        val category = if (reminder.isPunctual) {
            NotificationCompat.CATEGORY_ALARM
        } else {
            NotificationCompat.CATEGORY_REMINDER
        }
        val latestReading = if (
            !reminder.latestValue.isNullOrBlank()
        ) {
            "Letzte Pflege: ${reminder.latestValue}".trim()
        } else {
            "Noch kein Pflegeeintrag"
        }
        val summary = "${reminder.categoryLabel} · $latestReading"
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_aquarium)
            .setColor(notificationColor)
            .setContentTitle("${reminder.categoryLabel} · ${reminder.label}")
            .setContentText(summary)
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "$latestReading\nHalte deinen nächsten Pflegeeintrag in AquariumLog fest.",
                ),
            )
            .apply { configureLegacySound(this, reminder.isPunctual) }
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(category)
            .setAutoCancel(true)
            .setWhen(postedAt)
            .setShowWhen(true)
            .setContentIntent(openAquariumIntent(context, reminder.aquariumId))
            .build()
        context.getSystemService(NotificationManager::class.java).notify(
            aquariumTag(reminder.aquariumId),
            aquariumNotificationId,
            notification,
        )
        return postedAt
    }

    fun migrateLegacyNotification(context: Context, reminder: StoredReminder) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val legacy = manager.activeNotifications.firstOrNull { notification ->
            notification.tag == null &&
                notification.id == stableRequestCode(reminder.aquariumId, 0)
        } ?: return
        manager.cancel(legacy.id)
        if (showAquarium(context, reminder, legacy.postTime) != null) {
            ReminderStore.setLastTriggered(
                context,
                reminder.aquariumId,
                legacy.postTime,
            )
        }
    }

    fun showTest(
        context: Context,
        aquariumId: String?,
        label: String,
        categoryLabel: String,
        latestValue: String?,
        latestUnit: String?,
        punctual: Boolean,
    ): String {
        val availability = availability(context, punctual)
        if (availability != ReminderAvailability.AVAILABLE) return availability.wireValue
        val latestReading = if (!latestValue.isNullOrBlank()) {
            "Letzte Pflege: $latestValue".trim()
        } else {
            "Noch kein Pflegeeintrag"
        }
        val target = if (aquariumId.isNullOrBlank()) "die App" else "das Aquarium"
        val notification = NotificationCompat.Builder(
            context,
            channelId(punctual),
        )
            .setSmallIcon(R.drawable.ic_stat_aquarium)
            .setColor(notificationColor)
            .setContentTitle("Test: $categoryLabel · $label")
            .setContentText(latestReading)
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "$latestReading\nDas ist eine Test-Erinnerung. Tippen öffnet $target.",
                ),
            )
            .apply { configureLegacySound(this, punctual) }
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(
                if (punctual) {
                    NotificationCompat.CATEGORY_ALARM
                } else {
                    NotificationCompat.CATEGORY_REMINDER
                },
            )
            .setAutoCancel(true)
            .setTimeoutAfter(60_000L)
            .setContentIntent(
                if (aquariumId.isNullOrBlank()) {
                    openAppIntent(context)
                } else {
                    openAquariumIntent(context, aquariumId)
                },
            )
            .build()
        return try {
            scheduleLegacyTestExpiry(context)
            context.getSystemService(NotificationManager::class.java).notify(
                testTag,
                testNotificationId,
                notification,
            )
            "posted"
        } catch (_: Exception) {
            "failed"
        }
    }

    fun acknowledge(context: Context, aquariumId: String) {
        context.getSystemService(NotificationManager::class.java)
            .cancel(aquariumTag(aquariumId), aquariumNotificationId)
    }

    fun activeAquariumIds(context: Context): Set<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return emptySet()
        return context.getSystemService(NotificationManager::class.java)
            .activeNotifications
            .mapNotNull { notification ->
                notification.tag
                    ?.takeIf { it.startsWith(aquariumTagPrefix) }
                    ?.removePrefix(aquariumTagPrefix)
            }
            .toSet()
    }

    private fun configureLegacySound(builder: NotificationCompat.Builder, punctual: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return
        val sound = RingtoneManager.getDefaultUri(if (punctual) RingtoneManager.TYPE_ALARM else RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        builder.setSound(sound, if (punctual) AudioManager.STREAM_ALARM else AudioManager.STREAM_NOTIFICATION)
            .setVibrate(longArrayOf(0L, 200L, 100L, 200L))
    }

    internal const val expireTestAction = "com.appfactory.aquariumlog.nativecore.EXPIRE_REMINDER_TEST"

    private fun scheduleLegacyTestExpiry(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return
        val deadline = SystemClock.elapsedRealtime() + 60_000L
        val operation = PendingIntent.getBroadcast(context, 2002,
            Intent(context, AquariumReminderReceiver::class.java).setAction(expireTestAction)
                .putExtra("deadline", deadline),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        context.getSystemService(AlarmManager::class.java).setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP, deadline, operation)
    }

    fun expireTest(context: Context, intent: Intent) {
        // A previously queued expiration must not remove a newer test early.
        if (SystemClock.elapsedRealtime() < intent.getLongExtra("deadline", Long.MAX_VALUE)) return
        context.getSystemService(NotificationManager::class.java).cancel(testTag, testNotificationId)
    }

    private fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val normal = NotificationChannel(
            normalChannelId,
            "Normal",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Optionale Erinnerungen zur Aquarienpflege."
            enableVibration(true)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val alarm = NotificationChannel(
            alarmChannelId,
            "Pünktlich mit Ton",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Pünktliche Erinnerungen zur Aquarienpflege mit Alarmton."
            enableVibration(true)
            setSound(
                alarmSound,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
        }
        manager.createNotificationChannels(listOf(normal, alarm))
    }

    private fun openAquariumIntent(context: Context, aquariumId: String): PendingIntent {
        val intent = (context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent(Intent.ACTION_VIEW, Uri.parse("aquariumlog://")).setPackage(context.packageName))
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("aquariumlog://aquarium/$aquariumId"))
            .putExtra("aquarium_id", aquariumId)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            context,
            stableRequestCode(aquariumId, 1),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun openAppIntent(context: Context): PendingIntent {
        val intent = (context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent(Intent.ACTION_VIEW, Uri.parse("aquariumlog://")).setPackage(context.packageName))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            context,
            stableRequestCode(testTag, 1),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun aquariumTag(aquariumId: String) = aquariumTagPrefix + aquariumId
}

internal fun stableRequestCode(value: String, salt: Int): Int {
    var hash = 0x811c9dc5L
    value.forEach { character ->
        hash = hash xor character.code.toLong()
        hash = (hash * 0x01000193L) and 0x7fffffffL
    }
    return ((hash + salt) and 0x7fffffffL).toInt().coerceAtLeast(1)
}
