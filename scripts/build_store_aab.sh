#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$#" -ne 0 ]; then
  echo 'Usage: npm run build:store. Configure the version in app.config.ts and Android first.' >&2
  exit 1
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android-sdk}"
if [ -z "${JAVA_HOME:-}" ] && [ -x "$HOME/.local/jdk-21/bin/javac" ]; then
  export JAVA_HOME="$HOME/.local/jdk-21"
fi
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$PATH"
export NODE_ENV=production
export BUNDLETOOL_JAR="${BUNDLETOOL_JAR:-$HOME/.local/share/app-factory/tools/bundletool-all-1.18.3.jar}"
if [ ! -f android/key.properties ] || [ ! -f "$BUNDLETOOL_JAR" ] || \
  [ ! -f "$HOME/.local/share/app-factory/signing/aquariumlog/upload-certificate.pem" ]; then
  echo 'Private Store signing and bundletool are required. See docs/ANDROID_RELEASES.md.' >&2
  exit 1
fi
metadata="$(npx expo config --type public --json)"
version_name="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).version)' "$metadata")"
version_code="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).android.versionCode))' "$metadata")"
if [[ ! "$version_name" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ ! "$version_code" =~ ^[1-9][0-9]*$ ]]; then
  echo 'Expected a semantic version and a positive Android version code.' >&2
  exit 1
fi
delivery="build/releases/production/aquariumlog-${version_name}-build-${version_code}-production.aab"
if [ -e "$delivery" ] || [ -e "${delivery%.aab}.json" ]; then
  echo "Delivery already exists. Keep it and increase the version code: $delivery" >&2
  exit 1
fi
cmp plugins/store-signing.gradle android/app/store-signing.gradle
cmp plugins/offline-AndroidManifest.xml android/app/src/store/AndroidManifest.xml
cmp plugins/data-extraction-rules.xml android/app/src/main/res/xml/aquariumlog_data_extraction_rules.xml
(
  cd android
  ./gradlew :app:bundleStoreRelease \
    -PreactNativeArchitectures=arm64-v8a,x86_64 --max-workers=4 --no-daemon --console=plain
)
python3 scripts/verify_store_aab.py \
  android/app/build/outputs/bundle/storeRelease/app-store-release.aab \
  --version-name "$version_name" --version-code "$version_code" \
  --deliver "$delivery"
