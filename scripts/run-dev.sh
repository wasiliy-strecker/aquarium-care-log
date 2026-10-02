#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
device="${1:?Bitte die adb-Gerätekennung angeben.}"
bash scripts/build-dev.sh
bash scripts/install-dev.sh "$device"
npx expo start --dev-client --port 8086
