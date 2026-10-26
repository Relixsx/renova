#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { printf 'Install Node.js 22.13 or newer first.\n'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<13)) process.exit(1)' || { printf 'Use Node.js 22.13 or newer.\n'; exit 1; }
printf 'This adds daily/arrival message settings and per-order Jumia delivery dates to your restored NEW Renova Neon database.\n'
printf 'Paste its connection string, then press Return (hidden): ' >/dev/tty
IFS= read -r -s renova_message_editor_database_url </dev/tty
printf '\n' >/dev/tty
[[ -n "$renova_message_editor_database_url" ]] || { printf 'No connection string entered. Nothing changed.\n'; exit 1; }
trap 'unset renova_message_editor_database_url' EXIT
DATABASE_URL="$renova_message_editor_database_url" node scripts/migrate-reminder-messages.mjs
