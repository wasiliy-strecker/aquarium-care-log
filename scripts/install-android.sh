#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:?Bitte debug oder preview angeben.}"
shift
device="${1:?Bitte die adb-Gerätekennung angeben.}"
case "$mode" in
  debug) default_apk='android/app/build/outputs/apk/dev/debug/app-dev-debug.apk' ;;
  preview) default_apk='android/app/build/outputs/apk/dev/release/app-dev-release.apk' ;;
  *) echo 'Unbekannte Dev-Installationsart.' >&2; exit 1 ;;
esac
apk="${2:-$default_apk}"
sdk="${ANDROID_HOME:-$HOME/.local/android-sdk}"
adb="$sdk/platform-tools/adb"
build_tools="$(find "$sdk/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
package='com.appfactory.aquarium_log.dev'
badging="$("$build_tools/aapt" dump badging "$apk")"
if ! rg -q "^package: name='$package' " <<< "$badging"; then
  echo 'Abbruch. Erwartet wird ausschließlich eine AquariumLog-Dev-APK.' >&2
  exit 1
fi
if [ "$mode" = 'debug' ]; then
  if ! rg -q '^application-debuggable' <<< "$badging"; then
    echo 'Abbruch. Der Live-Build muss debuggable sein.' >&2
    exit 1
  fi
else
  if rg -q '^application-debuggable' <<< "$badging"; then
    echo 'Abbruch. Die eigenständige Testversion darf kein Debug-Build sein.' >&2
    exit 1
  fi
  files="$(unzip -Z -1 "$apk")"
  if ! rg -q '^assets/index.android.bundle$' <<< "$files"; then
    echo 'Abbruch. In der Testversion fehlt das eingebettete JavaScript.' >&2
    exit 1
  fi
fi
rg '^package:|^application-label:|^application-debuggable' <<< "$badging"
echo "Geprüfte Installationsart: $mode"
"$adb" -s "$device" get-state
installed="$("$adb" -s "$device" shell pm path "$package" | tr -d '\r' | sed -n 's/^package://p' | head -n 1 || true)"
if [ -n "$installed" ]; then
  "$adb" -s "$device" shell pm list packages -i "$package"
  "$adb" -s "$device" shell dumpsys package "$package" | rg 'versionCode=|versionName=|flags=|installerPackageName=' || true
  temp="$(mktemp -d -t aquariumlog-cert-XXXXXXXX)"
  trap 'rm -rf "$temp"' EXIT
  "$adb" -s "$device" pull "$installed" "$temp/installed.apk" >/dev/null
  before="$("$build_tools/apksigner" verify --print-certs "$temp/installed.apk" | rg 'certificate SHA-256 digest')"
  after="$("$build_tools/apksigner" verify --print-certs "$apk" | rg 'certificate SHA-256 digest')"
  if [ "$before" != "$after" ]; then
    echo 'Abbruch. Die Signatur unterscheidet sich. Keine Installation und keine Datenlöschung ausgeführt.' >&2
    exit 1
  fi
  echo 'Signatur stimmt mit der vorhandenen Dev-Installation überein.'
else
  echo 'Keine vorhandene AquariumLog-Dev-Installation. Version, Debug-Flag und Installer entfallen für den bisherigen Stand.'
fi
"$adb" -s "$device" install -r -t -g --no-streaming "$apk"
"$adb" -s "$device" shell pm list packages -i "$package"
"$adb" -s "$device" shell dumpsys package "$package" | rg 'versionCode=|versionName=|flags=|installerPackageName=' || true
if [ "$mode" = 'debug' ]; then
  "$adb" -s "$device" reverse tcp:8086 tcp:8086
  "$adb" -s "$device" shell am start -a android.intent.action.VIEW -d 'exp+aquariumlog://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8086' "$package"
else
  "$adb" -s "$device" shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$package/com.appfactory.aquarium_log.MainActivity"
fi
