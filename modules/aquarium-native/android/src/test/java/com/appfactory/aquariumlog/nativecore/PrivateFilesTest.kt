package com.appfactory.aquariumlog.nativecore

import android.app.Application
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PrivateFilesTest {
    private val context get() = RuntimeEnvironment.getApplication()

    @Test fun acceptsPrivateCacheFileAndRejectsOutsidePaths() {
        val file = File(context.cacheDir, "private-test.aqbackup").apply { writeBytes(byteArrayOf(1)) }
        try {
            assertEquals(file.canonicalFile, privateFile(context, file.toURI().toString()))
            assertThrows(IllegalArgumentException::class.java) { privateFile(context, "content://foreign/backup") }
            assertThrows(IllegalArgumentException::class.java) { privateFile(context, "file:///etc/passwd") }
        } finally { file.delete() }
    }

    @Test fun acceptsAppJpegAndRejectsTruncatedOrForeignBytes() {
        val file = File(context.cacheDir, "photo-test.jpg")
        val bytes = requireNotNull(javaClass.getResourceAsStream("/photo.jpg")).use { it.readBytes() }
        try {
            file.writeBytes(bytes)
            validatePhoto(file)
            file.writeBytes(bytes.copyOf(bytes.size - 2))
            assertThrows(IllegalArgumentException::class.java) { validatePhoto(file) }
            file.writeText("foreign image")
            assertThrows(IllegalArgumentException::class.java) { validatePhoto(file) }
        } finally { file.delete() }
    }

    @Test fun monthlyAndHourlySchedulesPreserveTheirCalendarBehavior() {
        val zone = java.time.ZoneId.of("Europe/Berlin")
        val now = java.time.Instant.parse("2026-09-30T10:00:00Z").toEpochMilli()
        val reminder = StoredReminder("tank", "Aquarium", "aquarium", "Aquarium", null, null, "monthly", 31, 1, 9, 0, "normal")
        assertEquals(java.time.Instant.parse("2026-10-31T08:00:00Z").toEpochMilli(), reminder.nextTriggerAfter(now, zone))
        val hourly = reminder.copy(interval = "hourly", startsAtMillis = now + 60000)
        assertEquals(now + 60000, hourly.nextTriggerAfter(now, zone))
        assertEquals(now + 60000, hourly.nextTriggerForUpdate(hourly.copy(label = "Alter Name"), now + 60000, now, zone))
    }
}
