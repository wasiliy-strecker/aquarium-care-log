package com.appfactory.aquariumlog.nativecore

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AquariumReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ReminderNotifier.expireTestAction) {
            ReminderNotifier.expireTest(context, intent)
            return
        }
        val aquariumId = intent.getStringExtra("aquarium_id") ?: return
        if (ReminderStore.planningState(context, aquariumId) == "failed") return
        val reminder = ReminderStore.find(context, aquariumId) ?: return
        val nextTrigger = ReminderStore.nextTrigger(context, aquariumId)
        // A previously queued broadcast may arrive after an edit or delivery.
        if (nextTrigger != null && nextTrigger > System.currentTimeMillis()) return
        try {
            val postedAt = ReminderNotifier.showAquarium(context, reminder)
            if (postedAt != null) {
                ReminderStore.setLastTriggered(context, aquariumId, postedAt)
                ReminderStore.setDeliveryFailed(context, aquariumId, false)
            } else if (ReminderNotifier.availability(context, reminder.isPunctual) == ReminderAvailability.UNKNOWN) {
                ReminderStore.setDeliveryFailed(context, aquariumId, true)
            }
        } catch (_: Exception) {
            ReminderStore.setDeliveryFailed(context, aquariumId, true)
        } finally {
            ReminderScheduler.scheduleNext(context, reminder)
            context.sendBroadcast(Intent(REMINDER_STATUS_CHANGED).setPackage(context.packageName))
        }
    }
}

class ReminderRescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderScheduler.rescheduleAll(
            context,
            clockChanged = intent.action == Intent.ACTION_TIME_CHANGED ||
                intent.action == Intent.ACTION_TIMEZONE_CHANGED,
        )
        context.sendBroadcast(Intent(REMINDER_STATUS_CHANGED).setPackage(context.packageName))
    }
}
