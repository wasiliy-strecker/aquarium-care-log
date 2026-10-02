#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/install-android.sh" debug "$@"
