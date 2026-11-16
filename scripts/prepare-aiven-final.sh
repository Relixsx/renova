#!/bin/bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
command -v node >/dev/null || { printf 'Install Node.js 22.13 or newer first.\n'; exit 1; }
command -v pbcopy >/dev/null || { printf 'Run this preparation tool on your Mac.\n'; exit 1; }
printf 'Run this AFTER the new code is Live on Render with RENOVA_MAINTENANCE_MODE=on.\n'
printf 'It checks the freeze, drains store writers, copies a fresh snapshot, and prepares the Aiven owner account and Anagen.\n'
printf 'It does not change Render settings or send customer messages.\n\n'
printf 'Paste MIGRATION_CONTROL_SECRET from Render (hidden): ' >/dev/tty
IFS= read -r -s renova_cutover_control </dev/tty; printf '\n' >/dev/tty
printf 'Paste the CURRENT Neon store connection string (hidden): ' >/dev/tty
IFS= read -r -s renova_cutover_source </dev/tty; printf '\n' >/dev/tty
printf 'Paste the Aiven Service URI for defaultdb (hidden): ' >/dev/tty
IFS= read -r -s renova_cutover_destination </dev/tty; printf '\n' >/dev/tty
renova_cutover_ca="$(osascript -e 'POSIX path of (choose file with prompt "Choose the Aiven project CA certificate")')"
printf 'Owner email [relixsx@gmail.com]: ' >/dev/tty
IFS= read -r renova_cutover_email </dev/tty
renova_cutover_email="${renova_cutover_email:-relixsx@gmail.com}"
printf 'Choose your Aiven owner password, 12–128 characters (hidden): ' >/dev/tty
IFS= read -r -s renova_cutover_password </dev/tty; printf '\n' >/dev/tty
printf 'Repeat that password (hidden): ' >/dev/tty
IFS= read -r -s renova_cutover_repeat </dev/tty; printf '\n' >/dev/tty
[[ "$renova_cutover_password" == "$renova_cutover_repeat" ]] || { printf 'Passwords did not match. Nothing was contacted.\n'; exit 1; }
printf 'How many Anagen packs are actually available? Enter a whole count, or 0 if unavailable: ' >/dev/tty
IFS= read -r renova_cutover_stock </dev/tty
[[ "$renova_cutover_stock" =~ ^[0-9]+$ ]] || { printf 'Use a whole pack count. Nothing was contacted.\n'; exit 1; }
trap 'unset renova_cutover_control renova_cutover_source renova_cutover_destination renova_cutover_password renova_cutover_repeat' EXIT
RENOVA_CUTOVER_CONTROL="$renova_cutover_control" RENOVA_CUTOVER_SOURCE="$renova_cutover_source" RENOVA_CUTOVER_DESTINATION="$renova_cutover_destination" RENOVA_CUTOVER_CA="$renova_cutover_ca" RENOVA_CUTOVER_EMAIL="$renova_cutover_email" RENOVA_CUTOVER_PASSWORD="$renova_cutover_password" ANAGEN_OPENING_STOCK="$renova_cutover_stock" node scripts/prepare-aiven-final.mjs
