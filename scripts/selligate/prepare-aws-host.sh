#!/usr/bin/env bash
# Prepare one fresh, dedicated Ubuntu host. Never starts the dispatch process.
set +x
set -Eeuo pipefail
umask 077

readonly RELEASE=866c666611edc86dafdade94e84b822053709e6c
readonly REPOSITORY=https://github.com/Relixsx/renova.git
readonly DESTINATION=/opt/renova-selligate
readonly PRIVATE_CONFIG=/etc/renova-selligate
stage=preflight
staging=''

usage() {
  cat <<'HELP'
Renova Selligate AWS host preparation

  bash prepare-aws-host.sh --check
  sudo bash prepare-aws-host.sh --prepare

Use a fresh dedicated Ubuntu 24.04 LTS x86-64 server with at least 2 GB RAM.
--check reads prerequisites only. --prepare installs Docker from its official
Ubuntu repository, fetches the pinned tested release, builds its bridge image,
checks Chromium with its sandbox enabled, and writes private connection keys.

No AWS account upgrade, database migration, Renova deployment, WhatsApp pairing,
background service startup, or customer message is performed.
HELP
}

die() { printf 'STOPPED: %s\n' "$*" >&2; exit 1; }

if (( $# != 1 )); then usage >&2; exit 2; fi
case "$1" in
  --help|-h) usage; exit 0 ;;
  --check|--prepare) mode=$1 ;;
  *) usage >&2; exit 2 ;;
esac

[[ $(uname -s) == Linux ]] || die 'Run this on the AWS Ubuntu server, not on your Mac.'
[[ -r /etc/os-release ]] || die 'Cannot identify this operating system.'
# /etc/os-release is the operating system-owned identification file.
# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == ubuntu && ${VERSION_ID:-} == 24.04 ]] || die 'Choose OS Only > Ubuntu 24.04 LTS.'
[[ $(uname -m) == x86_64 ]] || die 'This preparation command requires an x86-64 instance.'
memory_kib=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
[[ ${memory_kib:-0} =~ ^[0-9]+$ ]] && (( memory_kib >= 1500000 )) || die 'Choose the 2 GB RAM plan or larger.'
disk_kib=$(df -Pk /opt | awk 'END {print $4}')
[[ ${disk_kib:-0} =~ ^[0-9]+$ ]] && (( disk_kib >= 6000000 )) || die 'At least 6 GB of free disk space is required.'
[[ ! -e "$DESTINATION" && ! -L "$DESTINATION" ]] || die 'An installation already exists. Keep its private session and inspect it before changing anything.'
[[ ! -e "$PRIVATE_CONFIG" && ! -L "$PRIVATE_CONFIG" ]] || die 'Private connection keys already exist. Refusing to replace them.'
if command -v docker >/dev/null 2>&1; then
  [[ $EUID == 0 ]] || die 'Docker is present; use sudo for the read-only host check.'
  running_ids=$(docker ps -aq) || die 'Cannot inspect the existing Docker installation.'
  [[ -z "$running_ids" ]] || die 'Docker containers already exist. Use a fresh dedicated server.'
  docker compose version >/dev/null || die 'Install the Docker Compose v2 plugin before continuing.'
fi
printf 'Host prerequisites passed. Release: %s\n' "$RELEASE"
if [[ $mode == --check ]]; then
  printf 'Read-only check complete. No files, services or settings were changed.\n'
  exit 0
fi
[[ $EUID == 0 ]] || die 'Use sudo bash prepare-aws-host.sh --prepare on the AWS server.'
command -v flock >/dev/null 2>&1 || die 'The operating system lock utility is missing.'
exec 9>/run/lock/renova-selligate-prepare.lock
flock --exclusive --nonblock 9 || die 'Another preparation command is already running.'
[[ ! -e "$DESTINATION" && ! -L "$DESTINATION" && ! -e "$PRIVATE_CONFIG" && ! -L "$PRIVATE_CONFIG" ]] || die 'An installation or private keys appeared during the preflight. Refusing to replace them.'

on_error() {
  local result=$?
  trap - ERR
  printf '\nPreparation stopped during %s (exit %s).\n' "$stage" "$result" >&2
  printf 'No WhatsApp service was started. Keep any generated private files.\n' >&2
  if [[ -n "$staging" ]]; then printf 'Temporary source directory: %s\n' "$staging" >&2; fi
  exit "$result"
}
trap on_error ERR

stage='installing operating system prerequisites'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git openssl
if ! command -v docker >/dev/null 2>&1; then
  stage='installing Docker from its official Ubuntu repository'
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  docker_arch=$(dpkg --print-architecture)
  [[ $docker_arch == amd64 ]] || die 'The Docker package architecture must be amd64.'
  cat > /etc/apt/sources.list.d/docker.sources <<SOURCES
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: ${docker_arch}
Signed-By: /etc/apt/keyrings/docker.asc
SOURCES
  apt-get update
  apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version

stage='fetching the pinned tested source'
staging=$(mktemp -d /opt/renova-selligate-prepare.XXXXXX)
git -C "$staging" init --quiet
git -C "$staging" remote add origin "$REPOSITORY"
GIT_TERMINAL_PROMPT=0 git -C "$staging" fetch --depth=1 origin "$RELEASE"
git -C "$staging" checkout --detach --quiet FETCH_HEAD
[[ $(git -C "$staging" rev-parse HEAD) == "$RELEASE" ]] || die 'The downloaded revision does not match the tested source.'
[[ -s "$staging/bridge/package-lock.json" && -s "$staging/bridge/Dockerfile" ]] || die 'Required bridge source is missing.'
cp "$staging/bridge/env.example" "$staging/bridge/.env"
chmod 600 "$staging/bridge/.env"

stage='building the locked bridge image'
docker compose --project-name renova-selligate -f "$staging/bridge/compose.yaml" build --pull

stage='checking Chromium without opening WhatsApp'
docker run --rm --network none --read-only --cap-add=SYS_ADMIN \
  --shm-size=512m --tmpfs /tmp:uid=1000,gid=1000,mode=1777 \
  --entrypoint node renova-selligate-selligate \
  -e 'require("puppeteer").launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:["--disable-dev-shm-usage"]}).then(async browser=>{console.log("Chromium sandbox started; no WhatsApp connection opened.");await browser.close();}).catch(error=>{console.error(error.message);process.exit(1);})'

stage='saving private connection configuration'
install -d -m 0700 "$PRIVATE_CONFIG"
bridge_secret=$(openssl rand -hex 32)
[[ $bridge_secret =~ ^[0-9a-f]{64}$ ]] || die 'Private key generation failed.'
printf '{"primary":"%s"}\n' "$bridge_secret" > "$PRIVATE_CONFIG/render-bridge-keys.json"
printf '%s\n' \
  'RENOVA_URL=https://shoprenova.com.ng' \
  'SELLIGATE_BRIDGE_ENABLED=false' \
  'SELLIGATE_BRIDGE_KEY_ID=primary' \
  "SELLIGATE_BRIDGE_SECRET=${bridge_secret}" > "$staging/bridge/.env"
unset bridge_secret
chmod 600 "$PRIVATE_CONFIG/render-bridge-keys.json" "$staging/bridge/.env"
printf '%s\n' "$RELEASE" > "$staging/.aws-prepared-release"
mv "$staging" "$DESTINATION"
staging=''
trap - ERR

cat <<'READY'

AWS HOST PREPARED — DISPATCH SERVICE NOT STARTED
Chromium sandbox check: passed, network disabled, no WhatsApp connection opened.
Source: /opt/renova-selligate
Private Render key map: /etc/renova-selligate/render-bridge-keys.json
Private bridge configuration: /opt/renova-selligate/bridge/.env
WhatsApp enabled: false
Database changes: none
Live-store deployment: none
Customer messages: none

Send only this summary to ChatGPT. Keep the key map and bridge .env private.
The next step is the verified database backup and OFF-only application setup
from docs/SELLIGATE_SETUP.md before starting or pairing the bridge.
READY
