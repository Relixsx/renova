#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf 'Paste MIGRATION_CONTROL_SECRET from Render (hidden): ' >/dev/tty
IFS= read -r -s renova_check_control </dev/tty; printf '\n' >/dev/tty
trap 'unset renova_check_control' EXIT
MIGRATION_CONTROL_SECRET="$renova_check_control" node scripts/check-aiven-live.mjs
