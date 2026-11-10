# LA Chat — System Architecture

This document delivers the eight items requested in spec §28 (first instruction to the development AI). It is the single source of truth for the architecture; deeper detail lives in the linked companion documents.

---

## 1. Proposed system architecture

LA Chat is a **three-tier monolith with a real-time side-channel**, deployed on a **single school-owned server** with optional cloud offloading for backups and push notifications.

```
                       ┌─────────────────────────────────────────┐
                       │              Client devices              │
                       │  Web (Next.js)  •  Android  •  iOS (Expo)│
                       └───────────┬───────────────────┬─────────┘
                                   │ HTTPS (REST)      │ WSS (real-time)
                                   ▼                   ▼
                ┌──────────────────────────────────────────────┐
                │            Reverse proxy (Caddy)              │
                │   TLS termination • HTTP/3 • rate limiting    │
                └──────────┬───────────────────────┬────────────┘
                           ▼                       ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │   API service (NestJS)   │   │  Realtime gateway (WS)   │
        │  REST + auth + business  │   │  Presence • typing •     │
        │  logic • RBAC guards     │   │  message delivery        │
        └──────────┬───────────────┘   └──────────┬───────────────┘
                   │                              │
                   ▼                              ▼
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │   PostgreSQL  (primary)  │   │   Redis (cache/presence)  │
        │   schema • migrations    │   │   pub/sub • rate buckets  │
        └──────────┬───────────────┘   └──────────────────────────┘
                   │
                   ▼  (signed URLs, never public)
        ┌──────────────────────────┐   ┌──────────────────────────┐
        │  Object storage (MinIO)  │   │  Background worker (Bull) │
        │  media • documents       │   │  notifications • media    │
        └──────────────────────────�   │  transcoding • backups    │
                                       └──────────────────────────┘
```

**Design principles.**

1. **Monolith first, services later.** A single NestJS process owns REST + WebSocket + worker for now. We will split the realtime gateway out only when load demands it (see §7 scaling).
2. **Server-side authority.** Every permission check happens on the server. The client never decides what a user is allowed to see.
3. **Private by default.** Object storage is never publicly reachable; downloads are signed and short-lived. Private conversations are not indexed for global search.
4. **Offline-tolerant client.** Every message has a client-generated UUID and a server-assigned sequence number, so a client can replay safely after a reconnect.
5. **Auditable.** Auth events, moderation access and admin actions are written to an append-only audit log.
6. **Minimise PII surface.** We collect only what the school actually needs (admission number, name, class, stream) — see `security/permissions-matrix.md`.

---

## 2. Technology stack and justification

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Web frontend | **Next.js 15 (App Router) + React + TypeScript** | Matches spec §3. Server components reduce bundle and speed up first paint on the school's slow tablets. Alternative (Vite SPA) was rejected because we want SSR for the login/announcement pages and easy SEO for the public landing page. |
| Mobile | **React Native + Expo (managed workflow)** | One TypeScript codebase for Android + iOS. Expo removes the need for a Mac on day one and lets us push OTA updates without app-store review for bug fixes. Alternative (Flutter) rejected — Dart would force a second type system and duplicate the shared-types package. |
| Backend | **NestJS + TypeScript** | Opinionated module system maps cleanly to the API modules in spec §20. Built-in DI, guards and interceptors make RBAC enforcement uniform. Alternative (Express) rejected — too little structure for a 9-role permission system. |
| Real-time | **ws (raw WebSocket) behind NestJS gateway** | Lower overhead than Socket.IO at our scale (≤ 5 000 concurrent users). Socket.IO kept as a fallback if we need its rooms/reconnection semantics. |
| Database | **PostgreSQL 16** | Relational, ACID, mature replication, full-text search for messages. Spec §3 default. |
| Cache / presence | **Redis 7** | Pub/sub for fan-out, sorted sets for rate limiting, volatile keys for presence. Spec §3 default. |
| ORM | **Prisma 5** | Type-safe schema-as-source-of-truth, generates migrations, plays well with TypeScript. Alternative (TypeORM) rejected — Prisma's migration story and DX are stronger for a small team. |
| Object storage | **MinIO (S3-compatible, on-prem)** + optional cloud bucket for backup | Keeps student files inside the school. S3 API means we can mirror to any cloud later without code changes. |
| Background jobs | **BullMQ on Redis** | Push notifications, media transcoding, nightly backup. |
| Reverse proxy | **Caddy 2** | Automatic HTTPS via Let's Encrypt, simple Caddyfile, HTTP/3. Alternative (Nginx) is fine but more config. |
| Container runtime | **Docker + Docker Compose** | Single `docker compose up` brings up the whole stack on the school server. |
| CI/CD | **GitHub Actions** | Repo is already on GitHub. Builds, lints, tests, builds Docker images. |
| Monitoring | **Loki + Grafana + Prometheus** (lightweight) | One dashboard for DB health, API errors, queue depth. Sentry optional for client-side errors. |

**Deviations from spec §3 and why.**

- **Caddy instead of Nginx** — simpler ops for a single-school team.
- **Prisma instead of raw SQL migrations** — safer for a small team, schema is reviewable in PRs.
- **MinIO on-prem as primary object storage** (spec lists S3-compatible, which MinIO is) — keeps files in-country for DPPA 2019 data residency.

---

## 3. Repository structure

The repo is a **pnpm workspace monorepo**. The scaffold already exists (see `README.md`); Phase 1 fills in the implementation.

```
la-chat/
├── apps/
│   ├── api/                 # NestJS backend (REST + WS + worker)
│   ├── web/                 # Next.js 15 web app
│   └── mobile/              # Expo (React Native) app — Phase 7
├── packages/
│   ├── shared-types/        # DTOs, enums, API contracts shared across apps
│   ├── validation/          # Zod schemas for every DTO
│   ├── design-system/       # Tokens + primitive components (Phase 2)
│   └── shared-utils/        # Date, id, slug helpers
├── infrastructure/
│   ├── docker/              # Per-service Dockerfiles
│   ├── school-server/       # Caddyfile, systemd units, backup scripts
│   ├── cloud/               # Terraform for cloud backup bucket (optional)
│   └── monitoring/          # Grafana dashboards, alert rules
├── database/
│   ├── migrations/          # Prisma migration history
│   ├── seeds/               # Synthetic seed data only
│   └── schema/              # schema.prisma + ERD diagrams
├── documentation/
│   ├── architecture/        # ← you are here
│   ├── api/                 # OpenAPI spec, generated
│   ├── security/
│   ├── deployment/
│   └── user-guides/
├── tests/                   # Cross-app integration & e2e
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

**Dependency rules.**

- `apps/*` may import from `packages/*`, never from each other.
- `packages/*` may import from each other but must not import from `apps/*`.
- `shared-types` and `validation` must remain runtime-free (no Node-only APIs) so they work in the browser, in React Native and in Node.

---

## 4. Database entity-relationship design (overview)

Full design in `architecture/erd.md`. Summary:

- **Identity cluster**: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sessions`, `devices`.
- **Academic cluster**: `classes` (S1–S6), `streams` (S1 East…), `subjects`, `teacher_assignments`, `student_enrolments`.
- **Profile cluster**: `student_profiles`, `staff_profiles`, `parent_profiles` (1-to-1 with `users`).
- **Messaging cluster**: `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_reactions`, `message_read_receipts`, `message_delivery_status`.
- **Groups cluster**: `groups`, `group_members`, `group_admins`.
- **School comms cluster**: `announcements`, `announcement_acknowledgements`.
- **Moderation cluster**: `reports`, `moderation_actions`, `moderation_access_log`.
- **Operations cluster**: `notifications`, `audit_logs`, `system_settings`.

All tables have `id` (UUID v7, time-ordered), `created_at`, `updated_at`. Soft delete via `deleted_at` for anything that must remain auditable (users, messages, reports). Foreign keys are explicit and indexed. Deletion policy: `RESTRICT` on critical references (user→message), `SET NULL` on optional ones (message→reply_to).

---

## 5. User-role and permission matrix (overview)

Full matrix in `security/permissions-matrix.md`. Summary of the 10 roles (9 from spec §5 + Parent/Guardian):

| Role | Can message students | Can publish announcements | Can manage accounts | Can read reported content | Can configure system |
|---|---|---|---|---|---|
| Student | Within authorised groups only | No | No | No | No |
| Teacher | Own students + groups | Class-level (own classes) | No | No | No |
| Class Teacher | Own class | Class-level (own class) | No | No | No |
| Headteacher | All (formal channels) | School-wide | Delegate only | Authorised only | No |
| Deputy Headteacher | Delegated | Delegated | Delegated | Delegated | No |
| School Administrator | No | Admin notices | Yes (students + staff) | No | No |
| ICT Administrator | No | No | Yes (technical) | No (technical access only) | Yes |
| School Secretary | Authorised admin groups | Admin notices | No | No | No |
| Parent/Guardian | Their child's teachers + formal announcements | No | No | No | No |

**Two non-negotiable rules.**

1. No role gets unrestricted access to private conversations. Reported content is the *only* private content an authorised moderator can read, and every read is logged with a reason.
2. ICT Administrator and School Administrator are separated: ICT owns the *system* (servers, backups, settings, audit logs); the School Administrator owns *people* (accounts, classes, groups). Neither can do the other's job without an explicit second role assignment.

---

## 6. Hybrid hosting architecture (overview)

Full design in `deployment/hybrid-hosting.md`. Summary:

- **On-prem (school):** the entire live stack — API, web, Postgres, Redis, MinIO, worker. Reachable on the LAN by IP and on the WAN via Caddy + HTTPS.
- **Cloud (small subscription):** nightly encrypted DB backup, nightly encrypted MinIO mirror, push-notification service (FCM/APNs), optional external uptime monitor.
- **No direct internet exposure of Postgres, Redis or MinIO.** Only Caddy's ports 80/443 are public. The DB is bound to `127.0.0.1` inside the container network.
- **Offline tolerance:** clients keep an outgoing queue; on reconnect they replay pending sends by client message UUID. The server is idempotent on `(client_message_id, conversation_id)`.
- **Single-server sizing target:** 4 vCPU, 8 GB RAM, 250 GB SSD handles ~5 000 users and ~50 000 messages/day with headroom — see hosting doc for the worked numbers.

---

## 7. Development roadmap (overview)

Eight phases, ~12–16 weeks to a usable MVP. Full breakdown in `deployment/roadmap.md`.

1. **Foundation** — repo, stack, design system, app shell. *(this commit)*
2. **Auth & users** — register, login, roles, classes, streams. *(this commit — partial)*
3. **Messaging** — private + group, real-time, reactions, receipts, search.
4. **Media & notifications** — file sharing, voice, video, push.
5. **School features** — announcements, subject/class groups, parent-teacher.
6. **Security & moderation** — reports, audit log, retention, DPPA review.
7. **Mobile** — Android + iOS builds, push integration.
8. **Testing & deployment** — automated tests, prod-like staging, release.

---

## 8. First implementation milestone

**Milestone 1 (delivered in this commit):** A developer can clone the repo, run `docker compose up`, run `pnpm migrate && pnpm seed`, and exercise a working auth flow:

- `POST /auth/register` (student or staff, with admission/staff number).
- `POST /auth/login` → returns JWT.
- `GET /users/me` with the JWT → returns the user's profile and roles.
- `GET /admin/users` with an ICT Admin JWT → returns the user list. A student JWT returns 403.
- Web app at `http://localhost:3000` shows a branded login screen; logging in lands on a stub dashboard showing the user's name and role.

Build & verify commands are in `STATUS.md`.
