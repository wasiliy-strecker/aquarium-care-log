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
    @Test fun opensAnAvailableSettingsPageForTheCurrentAndroidVersion() {
        val context = RuntimeEnvironment.getApplication()
        for (exact in listOf(false, true)) {
            val intent = reminderSettingsIntent(context, exact)
            assertTrue(intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
            when {
                exact && Build.VERSION.SDK_INT >= 31 -> {
                    assertEquals(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, intent.action)
                    assertEquals(Uri.parse("package:${context.packageName}"), intent.data)
                }
                Build.VERSION.SDK_INT >= 26 -> {
                    assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, intent.action)
                    assertEquals(context.packageName, intent.getStringExtra(Settings.EXTRA_APP_PACKAGE))
                }
                else -> {
                    assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, intent.action)
                    assertEquals(Uri.parse("package:${context.packageName}"), intent.data)
                }
            }
        }
    }
}
