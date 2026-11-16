#!/bin/bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
[[ "${1:-}" == "" || "${1:-}" == '--reset-password' ]] || { printf 'Only --reset-password is supported.\n'; exit 1; }
printf 'This prepares an approved Aiven owner. Use --reset-password only to replace an existing password and revoke its sessions.\n'
printf 'Paste the FINAL Aiven STORE database URI (hidden): ' >/dev/tty
IFS= read -r -s renova_owner_url </dev/tty; printf '\n' >/dev/tty
renova_owner_ca="$(osascript -e 'POSIX path of (choose file with prompt "Choose the Aiven project CA certificate")')"
printf 'Owner email [relixsx@gmail.com]: ' >/dev/tty
IFS= read -r renova_owner_email </dev/tty
renova_owner_email="${renova_owner_email:-relixsx@gmail.com}"
printf 'New owner password, 12–128 characters (hidden): ' >/dev/tty
IFS= read -r -s renova_owner_password </dev/tty; printf '\n' >/dev/tty
printf 'Repeat password (hidden): ' >/dev/tty
IFS= read -r -s renova_owner_repeat </dev/tty; printf '\n' >/dev/tty
[[ "$renova_owner_password" == "$renova_owner_repeat" ]] || { printf 'Passwords did not match. Nothing was contacted.\n'; exit 1; }
trap 'unset renova_owner_url renova_owner_password renova_owner_repeat' EXIT
DATABASE_URL="$renova_owner_url" RENOVA_OWNER_CA="$renova_owner_ca" RENOVA_OWNER_EMAIL="$renova_owner_email" RENOVA_OWNER_PASSWORD="$renova_owner_password" node scripts/setup-aiven-owner.mjs "$@"
