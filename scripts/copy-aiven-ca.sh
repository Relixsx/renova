#!/bin/bash
set -euo pipefail
printf 'Choose the Aiven CA certificate. Its complete text will be copied for DATABASE_SSL_CA in Render.\n'
renova_ca_copy_path="$(osascript -e 'POSIX path of (choose file with prompt "Choose the Aiven project CA certificate")')"
pbcopy < "$renova_ca_copy_path"
printf 'Certificate copied. Paste it into the Render DATABASE_SSL_CA value.\n'
