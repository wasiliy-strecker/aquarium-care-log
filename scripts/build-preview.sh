#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/build-android.sh" devRelease "$@"
