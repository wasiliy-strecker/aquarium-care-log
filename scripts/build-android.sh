#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
variant="${1:?Bitte devDebug oder devRelease angeben.}"
shift
case "$variant" in
  devDebug) task='assembleDevDebug' ;;
  devRelease) task='assembleDevRelease' ;;
  *) echo 'Nur AquariumLog-Dev-Builds sind hier erlaubt.' >&2; exit 1 ;;
esac
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android-sdk}"
if [ -z "${JAVA_HOME:-}" ] && [ -x "$HOME/.local/jdk-21/bin/javac" ]; then
  export JAVA_HOME="$HOME/.local/jdk-21"
fi
# Expo SDK 57 recreates android/ by default. Keep the signing key outside it.
mkdir -p .local
if [ ! -f .local/dev.keystore ] && [ -f android/app/debug.keystore ]; then
  cp android/app/debug.keystore .local/dev.keystore
  chmod 600 .local/dev.keystore
fi
if [ ! -f .local/dev.keystore ]; then
  keytool_bin="${JAVA_HOME:+$JAVA_HOME/bin/}keytool"
  "$keytool_bin" -genkeypair -keystore .local/dev.keystore -storepass android -keypass android -alias androiddebugkey -dname 'CN=AquariumLog Local Development' -keyalg RSA -keysize 2048 -validity 10000 -noprompt
fi
npx expo prebuild --platform android --no-install --no-clean
cp .local/dev.keystore android/app/debug.keystore
chmod 600 .local/dev.keystore android/app/debug.keystore
cd android
./gradlew :app:"$task" -PreactNativeArchitectures="${AQUARIUMLOG_ANDROID_ARCHITECTURES:-arm64-v8a}" --no-daemon --max-workers=4 "$@"
