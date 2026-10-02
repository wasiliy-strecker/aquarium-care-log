package com.appfactory.aquariumlog.nativecore

import android.app.AlarmManager
import android.app.Application
import android.content.Intent
import android.os.SystemClock
import java.time.Duration
import android.app.NotificationManager
import android.media.AudioAttributes
import android.os.Build
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowAlarmManager
import org.robolectric.shadows.ShadowSystemClock
import org.robolectric.shadows.ShadowNotificationManager

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 25, 35], application = Application::class)
class ReminderAndroidTest {
    private val context get() = RuntimeEnvironment.getApplication()
    private val notifications get() = context.getSystemService(NotificationManager::class.java)

    @Before fun allowNotifications() {
        shadowOf(context).grantPermissions("android.permission.POST_NOTIFICATIONS")
    }

    @Test fun normalAndPunctualNotificationsHaveSoundAndVibration() {
        for (punctual in listOf(false, true)) {
            notifications.cancelAll()
            assertEquals("posted", ReminderNotifier.showTest(context, "test", "Test", "other", "Test", null, null, punctual))
            val notification = shadowOf(notifications).allNotifications.single()
            if (Build.VERSION.SDK_INT < 26) {
                assertNotNull("Android 7 needs sound on the notification itself", notification.sound)
                assertNotNull("Android 7 needs vibration on the notification itself", notification.vibrate)
                assertEquals(if (punctual) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_NOTIFICATION,
                    notification.audioAttributes.usage)
            } else {
                val channel = notifications.getNotificationChannel(notification.channelId)
                assertNotNull(channel.sound)
                assertTrue(channel.shouldVibrate())
                assertEquals(60_000L, notification.timeoutAfter)
            }
        }
    }
    private fun reminder(id: String = "saved", punctual: Boolean = false) = StoredReminder(
        id, "Test", "other", "Test", null, null, "daily", 1, null, 9, 0,
        if (punctual) "punctualWithSound" else "normal")

    @Test fun careWithoutHeightAppearsInRealAndTestNotifications() {
        val care = reminder().copy(label = "Testaquarium", latestValue = "Wasserwechsel", latestUnit = "")
        ReminderNotifier.showAquarium(context, care)
        var notification = shadowOf(notifications).allNotifications.single()
        assertTrue(notification.extras.getCharSequence("android.text").toString().contains("Wasserwechsel"))
        assertFalse(notification.extras.getCharSequence("android.text").toString().contains("0 h"))
        notifications.cancelAll()
        assertEquals("posted", ReminderNotifier.showTest(context, "test", "Testaquarium", "other", "Aquarium", "Fütterung", "", false))
        notification = shadowOf(notifications).allNotifications.single()
        assertEquals("Letzter Eintrag: Fütterung", notification.extras.getCharSequence("android.text").toString())
    }

    @Test fun acceptedScheduleReportsItsActualAlarmAndCancellationRemovesIt() {
        val saved = reminder()
        assertTrue(ReminderScheduler.update(context, saved))
        val alarm = shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.single()
        val status = ReminderScheduler.status(context, saved.aquariumId)
        assertEquals("scheduled", status["planningState"])
        assertEquals(alarm.triggerAtTime, status["nextTriggerAtMillis"])
        assertEquals(false, status["isExact"])
        assertTrue(ReminderScheduler.cancel(context, saved.aquariumId))
        assertNull(ReminderStore.find(context, saved.aquariumId))
        assertEquals("none", ReminderScheduler.status(context, saved.aquariumId)["planningState"])
        assertTrue(shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.isEmpty())
    }

    @Test fun lateAlarmSurvivesRestartAndAdvancesAfterDelivery() {
        val saved = reminder()
        val due = System.currentTimeMillis() - 5 * 60_000L
        ReminderStore.save(context, saved, due, false)
        assertTrue(ReminderScheduler.update(context, saved.copy(label = "Updated")))
        assertEquals(due, ReminderScheduler.status(context, saved.aquariumId)["nextTriggerAtMillis"])
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertEquals(1, shadowOf(notifications).allNotifications.size)
        assertNotNull(ReminderStore.lastTriggered(context, saved.aquariumId))
        assertTrue(ReminderStore.nextTrigger(context, saved.aquariumId)!! > System.currentTimeMillis())
        // Duplicate old broadcasts cannot deliver the next occurrence early.
        val last = ReminderStore.lastTriggered(context, saved.aquariumId)
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertEquals(last, ReminderStore.lastTriggered(context, saved.aquariumId))
    }

    @Test fun blockedDeliveryStillPlansTheNextOccurrence() {
        val saved = reminder()
        ReminderStore.save(context, saved, System.currentTimeMillis() - 1000L, false)
        shadowOf(notifications).setNotificationsEnabled(false)
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertTrue(shadowOf(notifications).allNotifications.isEmpty())
        assertNull(ReminderStore.lastTriggered(context, saved.aquariumId))
        assertEquals("scheduled", ReminderStore.planningState(context, saved.aquariumId))
        assertTrue(ReminderStore.nextTrigger(context, saved.aquariumId)!! > System.currentTimeMillis())
    }

    @Test fun legacyTestExpiresWithoutRemovingRealNotifications() {
        if (Build.VERSION.SDK_INT >= 26) return
        ReminderNotifier.showAquarium(context, reminder())
        assertEquals("posted", ReminderNotifier.showTest(context, "test", "Test", "other", "Test", null, null, false))
        val alarm = shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.single()
        assertEquals(SystemClock.elapsedRealtime() + 60_000L, alarm.triggerAtTime)
        ShadowSystemClock.advanceBy(Duration.ofSeconds(60))
        alarm.operation!!.send()
        shadowOf(android.os.Looper.getMainLooper()).idle()
        assertEquals(1, shadowOf(notifications).allNotifications.size)
        assertTrue(ReminderNotifier.activeAquariumIds(context).contains("saved"))
    }

    @Test @Config(shadows = [FailingAlarms::class])
    fun schedulingFailurePersistsAnHonestStatusAndDoesNotPostOldBroadcasts() {
        val saved = reminder()
        assertFalse(ReminderScheduler.update(context, saved))
        assertEquals("failed", ReminderScheduler.status(context, saved.aquariumId)["planningState"])
        assertEquals(saved, ReminderStore.find(context, saved.aquariumId))
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertTrue(shadowOf(notifications).allNotifications.isEmpty())
    }

    @Test @Config(shadows = [FailingNotifications::class])
    fun deliveryFailureDoesNotBreakTheRecurringSchedule() {
        val saved = reminder()
        ReminderStore.save(context, saved, System.currentTimeMillis() - 1000L, false)
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertTrue(ReminderStore.deliveryFailed(context, saved.aquariumId))
        assertNull(ReminderStore.lastTriggered(context, saved.aquariumId))
        assertEquals("scheduled", ReminderStore.planningState(context, saved.aquariumId))
        assertTrue(ReminderStore.nextTrigger(context, saved.aquariumId)!! > System.currentTimeMillis())
    }

    @Test @Config(sdk = [35])
    fun exactPermissionRecoveryUpgradesThePendingAlarmWithoutSkippingIt() {
        val saved = reminder(punctual = true)
        val due = System.currentTimeMillis() - 1000L
        ReminderStore.save(context, saved, due, true)
        ShadowAlarmManager.setCanScheduleExactAlarms(false)
        assertTrue(ReminderScheduler.update(context, saved))
        assertEquals(false, ReminderScheduler.status(context, saved.aquariumId)["isExact"])
        assertEquals(due, ReminderStore.nextTrigger(context, saved.aquariumId))
        ShadowAlarmManager.setCanScheduleExactAlarms(true)
        ReminderRescheduleReceiver().onReceive(context, Intent(AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED))
        assertEquals(true, ReminderScheduler.status(context, saved.aquariumId)["isExact"])
        assertEquals(due, ReminderStore.nextTrigger(context, saved.aquariumId))
        assertEquals(1, shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.size)
    }

    @Test @Config(shadows = [FailingCancellation::class])
    fun failedCancellationPreventsStaleDeliveryAndCanBeRetried() {
        val saved = reminder()
        assertTrue(ReminderScheduler.update(context, saved))
        FailingCancellation.fail = true
        assertFalse(ReminderScheduler.cancel(context, saved.aquariumId))
        assertEquals("cancelFailed", ReminderScheduler.status(context, saved.aquariumId)["planningState"])
        assertNull(ReminderStore.find(context, saved.aquariumId))
        AquariumReminderReceiver().onReceive(context, Intent().putExtra("aquarium_id", saved.aquariumId))
        assertTrue(shadowOf(notifications).allNotifications.isEmpty())
        FailingCancellation.fail = false
        assertTrue(ReminderScheduler.cancel(context, saved.aquariumId))
        assertEquals("none", ReminderScheduler.status(context, saved.aquariumId)["planningState"])
    }

    @Implements(AlarmManager::class)
    class FailingCancellation : ShadowAlarmManager() {
        companion object { var fail = false }
        @Implementation override fun cancel(operation: android.app.PendingIntent) {
            if (fail) throw IllegalStateException("Synthetic cancellation failure")
            super.cancel(operation)
        }
    }

    @Implements(AlarmManager::class)
    class FailingAlarms : ShadowAlarmManager() {
        @Implementation override fun setAndAllowWhileIdle(type: Int, triggerAtMillis: Long, operation: android.app.PendingIntent) {
            throw IllegalStateException("Synthetic planning failure")
        }
    }

    @Implements(NotificationManager::class)
    class FailingNotifications : ShadowNotificationManager() {
        @Implementation override fun notify(tag: String?, id: Int, notification: android.app.Notification) {
            throw IllegalStateException("Synthetic notification failure")
        }
    }

}
