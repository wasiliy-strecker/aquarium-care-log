package com.appfactory.aquariumlog.nativecore

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [24, 25, 35], application = Application::class)
class ReminderSettingsTest {
    @Test fun opensPlatformSettingsWithFallbacksAndPreservesChannelIds() {
        val context = RuntimeEnvironment.getApplication()
        val notifications = reminderSettingsIntents(context, "notifications", null)
        assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, notifications.last().action)
        assertEquals(Uri.parse("package:" + context.packageName), notifications.last().data)
        val exact = reminderSettingsIntents(context, "exact", null)
        if (Build.VERSION.SDK_INT >= 31) {
            assertEquals(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, exact.first().action)
            assertEquals(Uri.parse("package:" + context.packageName), exact.first().data)
            assertNull(exact.last().data)
        }
        for (mode in listOf("normal", "punctualWithSound")) {
            val intents = reminderSettingsIntents(context, "channel", mode)
            if (Build.VERSION.SDK_INT >= 26) {
                assertEquals(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS, intents.first().action)
                assertEquals(ReminderNotifier.channelId(mode == "punctualWithSound"), intents.first().getStringExtra(Settings.EXTRA_CHANNEL_ID))
                assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, intents[1].action)
            } else {
                assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, intents.first().action)
            }
            assertTrue(intents.all { it.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0 })
        }
    }

    @Test fun quietModeSettingsFallBackToSoundWithoutRequestingPolicyAccess() {
        val context = RuntimeEnvironment.getApplication()
        val intents = reminderSettingsIntents(context, "doNotDisturb", null)
        assertEquals("android.settings.ZEN_MODE_SETTINGS", intents.first().action)
        assertEquals(Settings.ACTION_SOUND_SETTINGS, intents.last().action)
        assertFalse(intents.any { it.action == Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS })
    }
}
