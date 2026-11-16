#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { printf 'Install Node.js 22.13 or newer first.\n'; exit 1; }
printf 'This adds Anagen to your restored Renova database. The final Aiven preparation tool also performs this step.\n'
printf 'Existing products, orders, accounts and reminder schedules are retained.\n'
printf 'How many Anagen packs are available to sell? Enter the actual count (0 if unavailable): ' >/dev/tty
IFS= read -r renova_anagen_stock </dev/tty
[[ "$renova_anagen_stock" =~ ^[0-9]+$ ]] || { printf 'Enter a whole pack count. Nothing changed.\n'; exit 1; }
printf 'Paste the restored Neon or verified Aiven STORE connection string, then press Return (hidden): ' >/dev/tty
IFS= read -r -s renova_anagen_database_url </dev/tty
printf '\n' >/dev/tty
[[ -n "$renova_anagen_database_url" ]] || { printf 'No connection string entered. Nothing changed.\n'; exit 1; }
trap 'unset renova_anagen_database_url renova_anagen_stock' EXIT
if [[ "$renova_anagen_database_url" == *aivencloud.com* ]]; then
  printf 'Choose the Aiven CA certificate.\n'
  renova_anagen_ca_path="$(osascript -e 'POSIX path of (choose file with prompt "Choose the Aiven CA certificate")')"
  renova_anagen_ca="$(cat "$renova_anagen_ca_path")"
else renova_anagen_ca=""; fi
DATABASE_URL="$renova_anagen_database_url" DATABASE_SSL_CA="$renova_anagen_ca" ANAGEN_OPENING_STOCK="$renova_anagen_stock" node scripts/setup-anagen.mjs
unset renova_anagen_ca
