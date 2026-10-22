const {
  withAppBuildGradle,
  withAndroidManifest,
  withProjectBuildGradle,
  withDangerousMod,
  withMainActivity,
  withAndroidStyles,
} = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

module.exports = function withAquariumAndroid(config) {
  config = withAndroidStyles(config, (mod) => {
    const styles = mod.modResults.resources.style;
    const setItem = (style, name, value) => {
      style.item = (style.item ?? []).filter((item) => item.$.name !== name);
      style.item.push({ $: { name }, _: value });
    };
    const splash = styles.find(
      (style) => style.$.name === 'Theme.App.SplashScreen',
    );
    const app = styles.find((style) => style.$.name === 'AppTheme');
    if (!splash || !app)
      throw new Error('AquariumLog: Android start themes missing.');
    // Keep Expo's own logo and the Android < 12 splash background.
    splash.item = (splash.item ?? []).filter(
      (item) => item.$.name !== 'android:windowBackground',
    );
    setItem(
      splash,
      'windowSplashScreenAnimatedIcon',
      '@drawable/splashscreen_logo',
    );
    setItem(splash, 'android:windowLightStatusBar', 'false');
    setItem(splash, 'android:windowLightNavigationBar', 'false');
    setItem(splash, 'android:statusBarColor', '@color/splashscreen_background');
    setItem(
      splash,
      'android:navigationBarColor',
      '@color/splashscreen_background',
    );
    setItem(app, 'android:windowBackground', '@color/splashscreen_background');
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    let source = mod.modResults.contents;
    const marker =
      '// AquariumLog: no developer menu in the user-facing Dev app.';
    if (!source.includes(marker)) {
      const activity = 'class MainActivity : ReactActivity() {';
      const startup = '    super.onCreate(null)';
      if (!source.includes(activity) || !source.includes(startup))
        throw new Error(
          'AquariumLog: MainActivity template changed. Review developer-menu suppression.',
        );
      source = source.replace(
        activity,
        `${activity}
  ${marker}
  private fun removeDevelopmentMenu() {
    getSharedPreferences("expo.modules.devmenu.sharedpreferences", MODE_PRIVATE)
      .edit()
      .putBoolean("showsAtLaunch", false)
      .putBoolean("isOnboardingFinished", true)
      .putBoolean("showFab", false)
      .putBoolean("motionGestureEnabled", false)
      .putBoolean("touchGestureEnabled", false)
      .putBoolean("keyCommandsEnabled", false)
      .apply()

    // Keep Expo's React host and Metro connection, remove only its menu fragment.
    // Hide the view before its first draw, then remove the fragment so its
    // sensor and touch listeners are disposed as well. This also covers reloads.
    supportFragmentManager.registerFragmentLifecycleCallbacks(
      object : androidx.fragment.app.FragmentManager.FragmentLifecycleCallbacks() {
        override fun onFragmentViewCreated(
          fm: androidx.fragment.app.FragmentManager,
          fragment: androidx.fragment.app.Fragment,
          view: android.view.View,
          savedInstanceState: Bundle?
        ) {
          if (fragment.javaClass.name == "expo.modules.devmenu.DevMenuFragment") {
            view.visibility = android.view.View.GONE
            fm.beginTransaction().remove(fragment).commitAllowingStateLoss()
          }
        }
      },
      false
    )
  }

  override fun onKeyUp(keyCode: Int, event: android.view.KeyEvent): Boolean {
    if (BuildConfig.DEBUG && keyCode == android.view.KeyEvent.KEYCODE_MENU) return true
    return super.onKeyUp(keyCode, event)
  }
`,
      );
      source = source.replace(
        startup,
        `    if (BuildConfig.DEBUG) removeDevelopmentMenu()
${startup}`,
      );
    }
    mod.modResults.contents = source;
    return mod;
  });
  // Android native-stack does not expose a duration option. Override only the
  // four resources used by slide_from_right, including its reverse transition.
  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const androidRoot = mod.modRequest.platformProjectRoot;
      for (const [source, target] of [
        ['store-signing.gradle', 'app/store-signing.gradle'],
        ['key.properties.example', 'key.properties.example'],
        [
          'data-extraction-rules.xml',
          'app/src/main/res/xml/aquariumlog_data_extraction_rules.xml',
        ],
      ]) {
        const destination = path.join(androidRoot, target);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(path.join(__dirname, source), destination);
      }
      // A prebuild must never create or replace a private key.
      const privateProperties = path.join(
        os.homedir(),
        '.local/share/app-factory/signing/aquariumlog/key.properties',
      );
      try {
        await fs.access(privateProperties);
        const localProperties = path.join(androidRoot, 'key.properties');
        try {
          await fs.lstat(localProperties);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          await fs.symlink(privateProperties, localProperties);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      for (const sourceSet of ['store', 'devRelease']) {
        const target = path.join(
          mod.modRequest.platformProjectRoot,
          'app/src',
          sourceSet,
        );
        await fs.mkdir(target, { recursive: true });
        await fs.copyFile(
          path.join(__dirname, 'offline-AndroidManifest.xml'),
          path.join(target, 'AndroidManifest.xml'),
        );
      }
      const res = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res',
      );
      await fs.mkdir(path.join(res, 'anim'), { recursive: true });
      await fs.mkdir(path.join(res, 'values'), { recursive: true });
      await fs.mkdir(path.join(res, 'drawable'), { recursive: true });
      await fs.rm(path.join(res, 'drawable/aquariumlog_splash_empty.xml'), {
        force: true,
      });
      await fs.writeFile(
        path.join(res, 'values/aquariumlog_navigation.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <integer name="aquariumlog_screen_transition_duration">200</integer>
</resources>
`,
      );
      const slides = {
        rns_slide_in_from_right: ['100%', '0%'],
        rns_slide_out_to_left: ['0%', '-100%'],
        rns_slide_in_from_left: ['-100%', '0%'],
        rns_slide_out_to_right: ['0%', '100%'],
      };
      for (const [name, [from, to]] of Object.entries(slides)) {
        await fs.writeFile(
          path.join(res, 'anim', `${name}.xml`),
          `<?xml version="1.0" encoding="utf-8"?>
<translate xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="@integer/aquariumlog_screen_transition_duration"
    android:fromXDelta="${from}"
    android:toXDelta="${to}" />
`,
        );
      }
      return mod;
    },
  ]);
  config = withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('ext.ndkVersion'))
      mod.modResults.contents =
        'ext.ndkVersion = "28.2.13676358"\n' + mod.modResults.contents;
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    let source = mod.modResults.contents;
    if (!source.includes('// AquariumLog variants')) {
      source = source.replace(
        'android {',
        `// AquariumLog variants
android {
    flavorDimensions "distribution"
    productFlavors {
        dev {
            dimension "distribution"
            applicationIdSuffix ".dev"
            resValue "string", "app_name", "AquariumLog Dev"
        }
        store {
            dimension "distribution"
            resValue "string", "app_name", "AquariumLog"
        }
    }
`,
      );
      source = source.replace(
        'react {',
        'react {\n    debuggableVariants = ["devDebug"]',
      );
      // Never sign a Store release with the scaffold's debug key.
      source = source.replace(
        /(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,
        '$1signingConfig = null',
      );
      source += `
androidComponents {
    beforeVariants(selector().all()) { variant ->
        if (variant.productFlavors.any { it.second == "store" } && variant.buildType != "release") {
            variant.enable = false
        }
    }
}
`;
    }
    if (!source.includes('// AquariumLog standalone Dev preview')) {
      source += `
// AquariumLog standalone Dev preview. Store releases remain unsigned.
android.productFlavors.dev.signingConfig = android.signingConfigs.debug
`;
    }
    if (!source.includes('// AquariumLog Android 7 time API support')) {
      source += `
// AquariumLog Android 7 time API support
android {
    compileOptions { coreLibraryDesugaringEnabled true }
}
dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'
}
`;
    }
    if (!source.includes('// AquariumLog stable local Dev signing')) {
      source +=
        '\n// AquariumLog stable local Dev signing\nandroid.signingConfigs.debug.storeFile = rootProject.file("../.local/dev.keystore")\n';
    }
    if (!source.includes("apply from: file('store-signing.gradle')"))
      source +=
        "\n// AquariumLog private Store upload signing.\napply from: file('store-signing.gradle')\n";
    mod.modResults.contents = source;
    return mod;
  });
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    // Overlay access belongs only to the optional debug manifests.
    // Remove the scaffold permission again whenever prebuild regenerates main.
    manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter(
      (permission) =>
        permission.$['android:name'] !==
        'android.permission.SYSTEM_ALERT_WINDOW',
    );
    const app = manifest.application[0];
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = 'false';
    app.$['android:dataExtractionRules'] =
      '@xml/aquariumlog_data_extraction_rules';
    const menuDefaults = {
      EXDevMenuShowFloatingActionButton: false,
      EXDevMenuShowsAtLaunch: false,
      EXDevMenuIsOnboardingFinished: true,
    };
    app['meta-data'] = (app['meta-data'] ?? []).filter(
      (item) => !(item.$['android:name'] in menuDefaults),
    );
    for (const [name, value] of Object.entries(menuDefaults)) {
      app['meta-data'].push({
        $: { 'android:name': name, 'android:value': String(value) },
      });
    }
    return mod;
  });
};
