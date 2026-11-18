# Selligate on the existing AWS account

Start with the current AWS Free account and one dedicated Linux server. The owner screenshot reviewed on 18 November 2026 shows $100 remaining and the Free account plan ending on 3 December 2026. The separate credit expiry shown in Billing is 3 June 2027. This guide does not upgrade the account, extend either date, launch a resource automatically, or enable LIVE dispatch.

The bridge and application are implemented in draft PR https://github.com/Relixsx/renova/pull/1. The runtime pinned by the host preparation command is commit `866c666611edc86dafdade94e84b822053709e6c`, which passed https://github.com/Relixsx/renova/actions/runs/44186948775. Later deployment changes must preserve protocol compatibility or update this pin after validation. No production database migration or real WhatsApp pairing has been completed.

## First action in AWS

Open https://lightsail.aws.amazon.com/ and choose Create instance. Use the existing AWS account; no second account is needed.

| Field | Value |
| --- | --- |
| Location | US East, N. Virginia (`us-east-1`) |
| Platform | Linux/Unix |
| Blueprint | OS Only, Ubuntu 24.04 LTS, x86-64 |
| Networking plan | Dual stack / public IPv4 included |
| Instance plan | 2 GB memory, 2 vCPUs, 60 GB SSD, $12 per month before tax and extras |
| Name | `renova-selligate` |
| Number of instances | 1 |
| Optional services | None; keep managed databases, load balancers and automatic snapshots off for this test |

Check the console summary and active credit's applicable products before creating the instance. Credits cover eligible usage; the $12 is the service rate, not a promise of ongoing free hosting. If AWS requires a Paid account upgrade, leave that screen unchanged and review the billing consequence with the owner. A stopped Lightsail instance continues to accrue charges until deleted. Delete only an unwanted test instance after preserving any needed private state; deleting it loses its session.

Wait for Running, then use Connect using SSH. For networking, keep only SSH access needed by the owner / Lightsail browser SSH. Remove the default HTTP rule. No inbound application port is required by this bridge: never open port 8787, Docker's API or a public sending endpoint. Renova remains on Render and Aiven remains its database.

If an EC2 instance was already created during earlier instructions, use that one when it meets the same Ubuntu/x86-64/2 GB requirements instead of creating a second billable instance. Its own security group should allow SSH only from the owner's IP. This installer works on either fresh host.

## Prepare the host without starting WhatsApp

Download the preparation command to the AWS server from a reviewed immutable commit URL. Replace `REVIEWED_SETUP_COMMIT` with the full SHA of the reviewed setup commit, rather than `main` or a moving branch:

```bash
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/Relixsx/renova/REVIEWED_SETUP_COMMIT/scripts/selligate/prepare-aws-host.sh \
  -o prepare-aws-host.sh
less prepare-aws-host.sh
bash prepare-aws-host.sh --check
sudo bash prepare-aws-host.sh --prepare
```

The helper accepts Ubuntu 24.04 LTS x86-64 only and requires the 2 GB plan. It refuses an existing Selligate installation, existing private keys, or a host that already has Docker containers. It installs Docker from Docker's Ubuntu repository without removing unrelated Docker installations. It checks out the exact tested runtime, uses the committed dependency lock, and tests sandboxed Chromium with the container network disabled. It then saves a fresh private bridge key locally and exits. It does not run `compose up`, contact the live Renova API, initialise WhatsApp, modify Aiven, deploy Render, or send a message.

The helper grants `SYS_ADMIN` to the isolated Chromium check, matching the validated bridge compose definition. Use a dedicated host. Do not weaken it with `--no-sandbox`, privileged mode, account-evasion options or unrelated host mounts. An installation failure prints the stage and leaves source/private files for review. Do not delete private session data to make a retry pass.

After success, the safe output ends with:

```text
AWS HOST PREPARED — DISPATCH SERVICE NOT STARTED
WhatsApp enabled: false
Database changes: none
Live-store deployment: none
Customer messages: none
```

Send that summary only. Never send `/etc/renova-selligate/render-bridge-keys.json`, the bridge `.env`, an SSH private key, a QR code, a database URI, or the Docker session volume through chat. Generated files use private permissions; no credentials are committed to Git.

## Then install the application while OFF

Use `docs/SELLIGATE_SETUP.md` sections 2–4 for the fresh verified Aiven backup, additive Selligate migration and application environment. Review and merge/deploy the validated feature only after checking the current Render source revision and preserving newer owner edits. Keep `SELLIGATE_LIVE_ALLOWED=false`; the initial database mode is OFF and STOPPED. Do not rerun the old Neon-to-Aiven migration.

The private JSON in `/etc/renova-selligate/render-bridge-keys.json` becomes Render's `SELLIGATE_BRIDGE_KEYS`. The helper has already written the same secret into `/opt/renova-selligate/bridge/.env`. Copy the JSON directly into Render privately. Keep the existing database, authentication, payment and customer-notification settings unchanged. No database credentials belong on this bridge server.

Once the application API and migration are installed correctly, the owner may start the bridge with WhatsApp still disabled:

```bash
cd /opt/renova-selligate
sudo docker compose --project-name renova-selligate -f bridge/compose.yaml up -d
sudo docker compose --project-name renova-selligate -f bridge/compose.yaml ps
```

A fresh successful heartbeat and healthy container confirm communication only. If unhealthy, inspect the owner console; keep dispatch OFF. Never paste `docker compose config` output because it expands the private environment.

## Pair and test only after the OFF setup works

Follow `docs/SELLIGATE_SETUP.md` sections 6–8. Set `SELLIGATE_BRIDGE_ENABLED=true` privately and recreate the bridge, then open Renova's authenticated owner console at `/admin/selligate`. Scan the temporary QR via the dedicated phone's WhatsApp Linked Devices and verify the displayed connected number. Choose a private test group and a separate real destination, then configure product coverage explicitly. Real customer orders remain excluded in TEST. The first send is one owner-requested fictional fixture to the private test group.

Run the emergency STOP, restart, session-restoration, disconnection and duplicate checks in `docs/SELLIGATE_VERIFICATION.md`. Reconnect requires an explicit owner resume and cancelled backlog never auto-replays. Finish in OFF. LIVE remains a separate, later owner decision.

## Account end date and stopping

This account's Free period ends on 3 December 2026. The bridge cannot keep running after account access is suspended. Before relying on it for live work, the owner must choose a funded continuation or a different host, preserve private state appropriately, and verify the test-group flow again after any move. Upgrading is a separate owner billing decision; it is not performed by any command here. Stop dispatch while the host is unavailable and use the existing manual Orders workflow.

To stop the bridge process while retaining its private session and journal:

```bash
cd /opt/renova-selligate
sudo docker compose --project-name renova-selligate -f bridge/compose.yaml stop
```

This stops the process only. It does not stop AWS resource charges, delete the volume, or revoke the linked device. Use the owner console / WhatsApp Linked Devices to revoke an abandoned connection. Never run `docker compose down --volumes` on a session you need to retain.

## Primary references checked on 18 November 2026

- AWS Lightsail plans: https://aws.amazon.com/lightsail/pricing/
- Lightsail and eligible AWS credits: https://aws.amazon.com/free/compute/lightsail/
- Free vs Paid account behaviour: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html
- Lightsail billing, including charges while stopped: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html
- Docker's official Ubuntu installation: https://docs.docker.com/engine/install/ubuntu/
- Puppeteer sandbox in Docker: https://pptr.dev/guides/docker
