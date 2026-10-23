package com.appfactory.aquariumlog.nativecore

import android.app.Application
import android.content.Intent
import android.os.Looper
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 25, 35], application = Application::class)
class ReminderStatusObserverTest {
    private val context get() = RuntimeEnvironment.getApplication()

    @Before fun grantMergedSignaturePermission() {
        // Robolectric does not automatically grant AndroidX's signature permission.
        val permission = context.packageName + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
        assertNotNull(context.packageManager.getPermissionInfo(permission, 0))
        shadowOf(context).grantPermissions(permission)
    }

    @Test fun observesOnlyReminderChangesAndStopsWithoutLeakingDuplicateReceivers() {
        var changes = 0
        val observer = ReminderStatusObserver(context) { changes++ }
        observer.start()
        observer.start()
        context.sendBroadcast(Intent("unrelated.action").setPackage(context.packageName))
        notifyReminderStatusChanged(context)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, changes)
        observer.stop()
        observer.stop()
        notifyReminderStatusChanged(context)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, changes)
        observer.start()
        notifyReminderStatusChanged(context)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(2, changes)
        observer.stop()
    }

    @Test fun deliveryPublishesTheNextOccurrenceAfterPersistingIt() {
        shadowOf(context).grantPermissions("android.permission.POST_NOTIFICATIONS")
        val reminder = StoredReminder("tank", "Test", "aquarium", "Aquarium", null, null,
            "daily", 1, 1, 9, 0, "normal")
        val due = System.currentTimeMillis() - 1000L
        ReminderStore.save(context, reminder, due, false)
        val snapshots = mutableListOf<Map<String, Any?>>()
        val observer = ReminderStatusObserver(context) {
            snapshots.add(ReminderScheduler.status(context, reminder.aquariumId))
        }
        observer.start()
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", reminder.aquariumId))
        shadowOf(Looper.getMainLooper()).idle()
        val status = snapshots.single()
        assertTrue(status["nextTriggerAtMillis"] as Long > due)
        assertNotNull(status["lastTriggeredAtMillis"])
        assertEquals(true, status["isNotificationActive"])
        assertEquals("scheduled", status["planningState"])
        observer.stop()
    }
}
