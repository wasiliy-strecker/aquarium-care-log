#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../android"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android-sdk}"
if [ -z "${JAVA_HOME:-}" ] && [ -x "$HOME/.local/jdk-21/bin/javac" ]; then
  export JAVA_HOME="$HOME/.local/jdk-21"
fi
# These JVM tests exercise only this app's Kotlin and Android resource behavior.
# They need dependency Java classes, but never their C++ binaries. Keep native
# dependency compilation for the actual Development Build rather than this check.
# The two dependency lint exclusions are inherited from the SDK-57 source setup.
cpp_exclusions=()
for architecture in arm64-v8a armeabi-v7a x86 x86_64; do
  cpp_exclusions+=(
    -x ":expo-modules-core:buildCMakeDebug[$architecture]"
    -x ":react-native-worklets:buildCMakeDebug[$architecture][worklets]"
  )
done
./gradlew :aquarium-native:testDebugUnitTest :aquarium-native:lintDebug \
  "${cpp_exclusions[@]}" \
  -x :expo-modules-core:externalNativeBuildDebug \
  -x :react-native-worklets:externalNativeBuildDebug \
  -x :react-native-worklets:lintAnalyzeDebug \
  -x :expo-modules-core:lintAnalyzeDebug \
  --max-workers=2 "$@"
