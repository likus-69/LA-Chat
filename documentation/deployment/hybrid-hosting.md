# LA Chat — Hybrid Hosting Architecture

**This is the focus area for the project.** The school needs LA Chat to run on a single school-owned server, be reachable from outside the school network, keep working during internet outages, and have off-site backups for disaster recovery — all without exposing the database to the public internet and without large recurring cloud costs.

---

## 1. Topology

```
                         ┌─────────────────────────────┐
                         │  Student/Teacher/Parent     │
                         │  device (Web/Android/iOS)   │
                         └──────────────┬──────────────┘
                                        │
                  ┌─────────────────────┴──────────────────────┐
                  │  Inside school LAN: 10.0.0.x               │
                  │  Outside school:   public Internet, HTTPS  │
                  └─────────────────────┬──────────────────────┘
                                        │
                                        ▼
            ┌────────────────────────────────────────────────────┐
            │  School gateway / firewall                         │
            │  • Allow inbound 80/443 → school server only       │
            │  • Deny inbound 5432/6379/9000 (DB/Redis/MinIO)    │
            │  • Outbound: 443 (Caddy→Let's Encrypt),            │
            │    FCM/APNs, cloud backup bucket, package mirrors  │
            └───────────────────────┬────────────────────────────┘
                                    │
                                    ▼
            ┌────────────────────────────────────────────────────┐
            │  School server (single machine)                    │
            │  ┌──────────────────────────────────────────────┐  │
            │  │  Caddy (reverse proxy, TLS, HTTP/3)          │  │
            │  │  • chat.lightacademy.sc.ug  → web:3000       │  │
            │  │  • api.lightacademy.sc.ug   → api:4000       │  │
            │  └────────────┬─────────────────────────────────┘  │
            │               │ internal docker network            │
            │  ┌────────────┴────────────────────────────────┐  │
            │  │  NestJS API  •  Next.js web  •  WS gateway   │  │
            │  │  Postgres 16  •  Redis 7  •  MinIO  •  Bull  │  │
            │  └─────────────────────────────────────────────┘  │
            │                                                   │
            │  Local backup disk: encrypted pg_dump + MinIO     │
            │  mirror, nightly, retained 14 days locally        │
            └───────────────────────┬────────────────────────────┘
                                    │ nightly, encrypted, over TLS
                                    ▼
            ┌────────────────────────────────────────────────────┐
            │  Cloud (small subscription)                        │
            │  • Encrypted DB backup bucket (S3-compatible)      │
            │  • Encrypted media backup bucket                   │
            │  • Push notification service (FCM + APNs)          │
            │  • Optional external uptime monitor                │
            │  Retention: 90 days rolling                        │
            └────────────────────────────────────────────────────┘
```

---

## 2. The single-school-server constraint

**Hardware target (recycled desktop or small rack server):**

| Resource | Minimum | Recommended | Why |
|---|---|---|---|
| CPU | 4 vCPU | 8 vCPU | Postgres + Node + Caddy + MinIO all share |
| RAM | 8 GB | 16 GB | Postgres (2 GB) + Redis (512 MB) + Node (1 GB) + MinIO (1 GB) + headroom |
| Disk | 250 GB SSD | 500 GB SSD | DB ~10 GB, media ~100 GB, backups ~50 GB, OS + logs |
| Network | 100 Mbps LAN | 1 Gbps LAN | LAN traffic for in-school use; WAN can be slower |

**Worked load estimate (Light Academy, ~2 000 users, ~30 000 messages/day):**

- DB writes: ~0.35 msg/s average, ~5 msg/s peak — Postgres on a 4-vCPU box handles this without breaking a sweat.
- API requests: ~50 req/s peak — well within one Node process.
- WebSocket connections: up to ~2 000 concurrent — one NestJS gateway process handles this.
- Media storage growth: ~2 GB/week — 250 GB disk holds ~2 years of media.

**What does NOT fit on one server (and when to split):**

- > 10 000 concurrent users → split the WebSocket gateway onto its own box.
- > 100 GB active media → move MinIO to a dedicated box or to cloud storage.
- > 5 000 messages/second sustained → introduce read replicas for Postgres.

These thresholds are flagged in `monitoring/alerts.yml` so we get warning before they hit.

---

## 3. Network and firewall

**Inbound rules (school firewall → server):**

| Port | From | To | Purpose |
|---|---|---|---|
| 80 | Internet | Server | Caddy HTTP → redirect to HTTPS |
| 443 | Internet | Server | Caddy HTTPS (REST + WSS) |
| 5432 | LAN only | Server | Postgres (admin tools, never internet) |
| 6379 | LAN only | Server | Redis (never internet) |
| 9000 | LAN only | Server | MinIO console (never internet) |

**Outbound rules (server → Internet):**

| Destination | Port | Purpose |
|---|---|---|
| Let's Encrypt ACME | 443 | TLS certificate issuance/renewal |
| FCM (fcm.googleapis.com) | 443 | Android push |
| APNs (api.push.apple.com) | 443 | iOS push |
| Cloud backup bucket (S3-compatible) | 443 | Nightly encrypted backup |
| Ubuntu/Debian mirrors | 443 | Security updates |
| npm registry | 443 | CI/CD builds (not the server itself) |

Everything else is denied by default.

**DNS records:**

- `chat.lightacademy.sc.ug` A record → school public IP.
- `api.lightacademy.sc.ug` A record → school public IP.
- Both behind the same Caddy instance, distinguished by SNI.

---

## 4. Offline tolerance and reconnection

**Inside the school LAN** the client talks to the server directly. **From outside** the client goes through Caddy over HTTPS/WSS.

**What happens when the internet drops (client side):**

1. Messages the user sends while offline are queued in the client's local IndexedDB / SQLite, each with a client-generated UUID (`crypto.randomUUID()`).
2. The UI shows a "Pending" indicator on the bubble and a banner "Offline — messages will send when reconnected".
3. When connectivity returns, the client replays the queue. For each pending message it calls `POST /messages` with the `client_message_id`.
4. The server is **idempotent** on `(client_message_id, conversation_id)`: if it has already recorded that ID, it returns the existing message instead of creating a duplicate.

**What happens when the school internet drops but the LAN is up:**

- Everything keeps working inside the school. Students and teachers on the school Wi-Fi continue to message each other.
- Push notifications to off-campus parents will queue in the worker and deliver when the internet returns.
- The dashboard shows a "Cloud services degraded" banner but messaging is unaffected.

**What happens when the server itself reboots:**

- `docker compose up` is wired to a systemd unit that starts on boot.
- Postgres WAL + BullMQ queues are on persistent volumes, so in-flight messages survive.
- Clients auto-reconnect the WebSocket with exponential backoff (1s, 2s, 4s, 8s, capped at 30s) and replay the missed range using `last_message_id`.

---

## 5. Backup and disaster recovery

**Three layers of backup:**

1. **Local hot copy** (every night, 02:00 EAT):
   - `pg_dump` of the Postgres database → gzip → AES-256 encrypted with a key in `/etc/la-chat/backup.key` (root-only readable) → `/var/backups/la-chat/db/`.
   - `mc mirror` of MinIO to a local backup directory → same encryption.
   - Retained 14 days locally. Disk size budget: ~50 GB.

2. **Cloud off-site copy** (every night, 03:00 EAT, after the local copy):
   - Upload the encrypted archives to the cloud bucket.
   - Retained 90 days rolling.
   - The cloud bucket is write-only from the server's IAM user (it can PUT but not DELETE); deletes happen via a separate lifecycle policy on the bucket.

3. **Database point-in-time recovery** (continuous):
   - Postgres WAL archiving to a local directory, retained 7 days.
   - Allows recovery to any point in the last week, e.g. "undo the accidental DELETE at 14:32 today".

**Restoring:**

- **Single message / conversation:** use the moderation UI to restore a soft-deleted row. No backup needed.
- **Accidental table drop:** restore from last night's encrypted dump + replay WAL to the minute before the accident. RTO ~1 hour, RPO ~15 minutes.
- **Total server loss (fire/theft):** provision a new server, restore OS, install Docker, pull the cloud backup, decrypt, restore Postgres + MinIO. RTO ~4 hours, RPO ~24 hours.

**Restore drill:** the ICT Administrator runs a restore-from-cloud drill once per term (documented in `infrastructure/school-server/scripts/dr- drill.sh`) and records the result in `audit_logs`.

---

## 6. Remote access for staff

- **No direct DB exposure.** Postgres, Redis, MinIO are bound to `127.0.0.1` inside the Docker network.
- **Administrative SSH** is key-only, on a non-standard port, restricted to the ICT team's static IPs (or via Tailscale if the team is remote).
- **School Administrator / Headteacher** access the admin dashboard via the web UI only; no SSH, no DB access.
- **VPN** (optional, recommended): a Tailscale subnet route exposes the school LAN segment to authorised staff devices, so the dashboard is reachable without exposing it to the public internet. Caddy still terminates TLS.

---

## 7. Security on the wire

- **TLS 1.3 everywhere.** Caddy terminates TLS; internal traffic between containers is plain HTTP on a private bridge network (`internal: true` in compose).
- **HSTS** with `preload`, 1 year.
- **Certificate automation:** Caddy handles Let's Encrypt issuance and renewal. No manual cert steps.
- **WebSocket auth:** the WSS handshake carries a short-lived JWT in the `sec-websocket-protocol` header; the gateway validates it on connect and rejects with 401.
- **Signed media URLs:** every file download is a signed MinIO URL valid for 5 minutes, scoped to the requesting user. No public buckets.

---

## 8. Cost profile (indicative, Uganda)

| Item | One-time | Recurring |
|---|---|---|
| Server (recycled desktop) | UGX 1,500,000 – 3,000,000 | — |
| UPS (500 VA) | UGX 400,000 | — |
| Domain registration (.sc.ug or .ac.ug) | — | UGX 100,000 / yr |
| Cloud backup bucket (50 GB, S3-compatible) | — | UGX 50,000 – 150,000 / mo |
| Push notifications (FCM free, APNs free) | — | UGX 0 |
| Optional: external uptime monitor | — | UGX 0 – 50,000 / mo |
| Electricity (server + UPS) | — | UGX 100,000 – 200,000 / mo |
| **Total** | **UGX ~2–3.5M** | **UGX ~250k–450k / mo** |

Excluded: ICT team labour (assumed in-house), internet uplink (assumed already provisioned for the school).

---

## 9. Disaster recovery procedure (summary)

Full runbook: `infrastructure/school-server/scripts/dr-runbook.md`.

1. **Detect** — monitoring alert or staff report.
2. **Assess** — is it the app, the server, or the network? (Run `docker compose ps`, `caddy validate`, `ping`.)
3. **Communicate** — Headteacher + ICT team notified; status banner on the login page.
4. **Recover** — try service restart first; if data loss suspected, switch to restore procedure in §5.
5. **Verify** — health check + smoke test (login as test user, send a test message).
6. **Post-mortem** — within 48 hours, written root-cause + preventive action filed in `documentation/deployment/incidents/`.

---

## 10. Compliance notes (Uganda DPPA 2019)

- **Data residency:** primary student data stays on the school server (on Ugandan soil). Only *encrypted* backups leave the country, and only to a bucket whose encryption key never leaves the server.
- **Data minimisation:** the schema collects only what the school operationally needs. See `permissions-matrix.md` and `erd.md`.
- **Right to access / rectification:** a student or parent can request a copy of their data via the School Administrator; the export is generated by `user.export_csv` permission.
- **Right to erasure:** handled via soft-delete + scheduled hard-delete after the school's records-retention period (default 7 years after a student leaves, per common Ugandan school practice — to be confirmed with the school's records policy).
- **Breach notification:** the ICT Administrator's runbook includes a 72-hour internal escalation template; the school's Data Protection Officer (to be designated) is responsible for any notification to the Personal Data Protection Office.
- **Open compliance item:** a full DPPA 2019 review must be conducted before declaring the system production-ready. Tracked in `STATUS.md`.
