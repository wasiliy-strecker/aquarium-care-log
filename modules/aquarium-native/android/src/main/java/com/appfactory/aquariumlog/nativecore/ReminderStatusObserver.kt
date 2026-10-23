package com.appfactory.aquariumlog.nativecore

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat

internal const val REMINDER_STATUS_EVENT = "onReminderStatusChanged"

internal fun notifyReminderStatusChanged(context: Context) {
    context.sendBroadcast(Intent(REMINDER_STATUS_CHANGED).setPackage(context.packageName))
}

internal class ReminderStatusObserver(context: Context, private val onChanged: () -> Unit) {
    private val context = context.applicationContext
    @Volatile private var registered = false
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (registered && intent.action == REMINDER_STATUS_CHANGED) onChanged()
        }
    }

    @Synchronized fun start() {
        if (registered) return
        ContextCompat.registerReceiver(
            context, receiver, IntentFilter(REMINDER_STATUS_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registered = true
    }

    @Synchronized fun stop() {
        if (!registered) return
        registered = false
        context.unregisterReceiver(receiver)
    }
}
