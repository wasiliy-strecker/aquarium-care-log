package com.appfactory.aquariumlog.nativecore

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

internal fun reminderSettingsIntent(context: Context, exact: Boolean): Intent {
    val packageUri = Uri.parse("package:${context.packageName}")
    val intent = when {
        exact && Build.VERSION.SDK_INT >= 31 ->
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(packageUri)
        Build.VERSION.SDK_INT >= 26 ->
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(packageUri)
    }
    return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
