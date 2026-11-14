# LA Chat — Threat Model (OWASP Top 10 — 2021)

**Document owner:** LA Chat project — ICT Administrator role
**Last updated:** Phase 6, Security & Moderation
**Scope:** Web API (`apps/api`), web client (`apps/web`), supporting infrastructure (Postgres, Redis, MinIO, Caddy).
**Method:** Mapping to the OWASP Top 10 — 2021 categories. For each: the risk, how LA Chat mitigates it, residual risks, and any open follow-ups.

---

## A01 — Broken Access Control

**Risk:** A user performs an action they are not authorised for (e.g. a student approves another student, a teacher reads a class they don't teach, a parent messages a teacher who doesn't teach their child).

**Mitigations in LA Chat:**

- **RBAC layer:** 9 roles (`STUDENT`, `TEACHER`, `CLASS_TEACHER`, `HEADTEACHER`, `DEPUTY_HEADTEACHER`, `SCHOOL_ADMINISTRATOR`, `ICT_ADMINISTRATOR`, `SCHOOL_SECRETARY`, `PARENT_GUARDIAN`) and 38 permission codes. The canonical map lives in `@la-chat/shared-types/ROLE_PERMISSIONS` and is seeded into the `role_permissions` table on boot.
- **`PermissionsGuard`:** Applied via `@Permissions(...)` on every protected controller method. Failed checks return `403 Forbidden` and log a warning.
- **Row-level checks:**
  - *Messaging* — `ConversationPolicy` enforces who can talk to whom (student↔student off by default; teacher→student requires an active assignment; parent→teacher requires the teacher to teach the parent's child).
  - *Messages* — edit/delete restricted to the sender (or `MESSAGE_DELETE_OTHERS` permission).
  - *Conversations* — list/history endpoints only return conversations the caller is a participant in.
  - *Announcements* — read access gated by audience (ALL / CLASS / STREAM / STAFF / PARENTS); write requires `announcement.publish.*` permission matching the audience.
  - *Moderation* — `MODERATION_ACCESS_PRIVATE` permission required to view the body of a reported message; every such access is recorded in the append-only `moderation_access_log`.
  - *Audit log* — `SYSTEM_AUDIT_READ` permission required.
- **JWT:** Short-lived access tokens (15 min) include `sub`, `roles`, `status`. Rejected if the user is no longer `ACTIVE`.

**Residual risks:**

- ⚠️ In-memory `ThrottleGuard` is per-process. Acceptable for the single-server deployment model; revisit if horizontal scaling.
- ⚠️ No automated test that **every** route is permission-decorated. A code-review checklist item.

**Open follow-ups:** Add a lint rule / reflection test that fails if any controller method lacks `@Permissions` (other than the public auth endpoints).

---

## A02 — Cryptographic Failures

**Risk:** Passwords, tokens, or message content are exposed in plaintext, weak hashes, or over an unencrypted channel.

**Mitigations in LA Chat:**

- **Passwords:** hashed with **argon2id** (memory-hard, salted) via `argon2` npm package. Parameters: memory cost 19456 KiB, time cost 2, parallelism 1.
- **Refresh tokens:** stored in `user_sessions` as a **SHA-256** hash. Only the unhashed token ever leaves the server, once, on issue/rotation.
- **Transport:** TLS 1.3 enforced by Caddy (`infrastructure/school-server/Caddyfile`). HSTS sent on every response. WebSocket runs over `wss://`.
- **Media:** MinIO pre-signed URLs (5-minute TTL) for downloads. The signed URL key is never exposed to clients.
- **JWT signing:** HS256 with a server-side secret from `JWT_SECRET` env var. The secret is read once at boot.
- **No plaintext secrets in the repo:** `.env.example` contains only placeholder values; real secrets live in `.env` (git-ignored).

**Residual risks:**

- ⚠️ JWT secret rotation is not automated. If `JWT_SECRET` is changed, all active sessions are invalidated (acceptable).
- ⚠️ Database at rest is **not** encrypted by the application. Relies on host-level LUKS during deployment.

**Open follow-ups:** Confirm LUKS is enabled on the school server's `/var/lib/docker/volumes` partition.

---

## A03 — Injection

**Risk:** SQL injection, NoSQL injection, command injection, LDAP injection.

**Mitigations in LA Chat:**

- **Prisma ORM:** Every database query goes through Prisma's parameterised query builder. No raw `$queryRawUnsafe` is used anywhere in the codebase.
- **Input validation:** Every controller method validates the request body with a Zod schema from `@la-chat/validation`. Invalid input throws `ZodValidationException` (HTTP 400).
- **No shell execution:** The API never spawns a child process with user input. Backups are run by the host cron, not by the application.
- **No LDAP / NoSQL:** Postgres is the only data store.
- **WebSocket payload validation:** The messaging gateway validates incoming event payloads against typed interfaces; malformed events are dropped.

**Residual risks:** None identified.

---

## A04 — Insecure Design

**Risk:** Missing security controls by design (not bugs) — e.g. allowing unmonitored student-to-student messaging, no audit trail for moderator access to private content.

**Mitigations in LA Chat:**

- **Conversation policy engine:** A first-class component (`apps/api/src/messaging/conversation.policy.ts`) that decides who may talk to whom. Defaults to the **least permissive** policy: student↔student private chat off by default.
- **Moderation access logging:** The `moderation_access_log` table is **append-only** — the schema intentionally has no `UPDATE` or `DELETE` path. Moderators cannot view private message content without leaving an indelible trail.
- **Audit log:** Every administrative action (approve user, suspend user, take moderation action, etc.) writes a row to `audit_logs` before the response is returned.
- **Idempotent message send:** `(conversationId, clientMessageId)` unique constraint prevents duplicate messages from network retries — protecting message integrity.
- **Threat model:** This document, plus `dppa-2019-review.md` and `permissions-matrix.md`, are checked in to the repo and updated each phase.

**Residual risks:**

- ⚠️ No rate limiting on message-send. A misbehaving client could flood a conversation. Mitigation: WebSocket-level throttling is a Phase 8 backlog item.

**Open follow-ups:** Add WebSocket send-throttling.

---

## A05 — Security Misconfiguration

**Risk:** Default credentials, verbose error messages, open CORS, missing security headers.

**Mitigations in LA Chat:**

- **`helmet`** middleware on the API: sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, etc.
- **CORS:** Locked down to the configured web origin (`CORS_ORIGIN` env var, defaults to `http://localhost:3000` for dev).
- **Environment-based secrets:** All secrets (`DATABASE_URL`, `JWT_SECRET`, `MINIO_SECRET_KEY`, `REDIS_URL`) come from env vars. No secrets in source.
- **Swagger UI:** Exposed at `/docs` — acceptable in school-internal deployment. If the API is ever exposed to the internet, `/docs` should be gated.
- **Default accounts:** The seed script (`apps/api/prisma/seed.ts`) creates accounts with the placeholder password `Password1` and **clearly marks them as synthetic**. Production deployments are expected to change these on first login.
- **Docker:** Containers run as non-root users where the base image supports it.

**Residual risks:**

- ⚠️ Swagger UI is publicly reachable on the school network. Acceptable while the API is on the school LAN; revisit if WAN-exposed.

---

## A06 — Vulnerable and Outdated Components

**Risk:** Known vulnerabilities in npm dependencies.

**Mitigations in LA Chat:**

- **`pnpm` lockfile:** `pnpm-lock.yaml` is committed, ensuring reproducible installs.
- **`pnpm audit`:** Run on every CI build (planned Phase 8). High-severity findings block the build.
- **GitHub Dependabot:** Configured to open PRs for outdated dependencies. (Enable in repo settings — Phase 8 task.)
- **Prisma:** Generates a type-safe client at build time, so schema mismatches surface as TypeScript errors.
- **Limited dependency surface:** No analytics SDKs, no ad SDKs, no third-party UI component libraries that ship runtime JS.

**Residual risks:**

- ⚠️ Dependabot is not yet enabled on the repo. Manual `pnpm audit` cadence (monthly) until then.

**Open follow-ups:** Enable Dependabot + automated security PR merge for patch-level updates.

---

## A07 — Identification and Authentication Failures

**Risk:** Weak passwords, brute force, session fixation, credential stuffing.

**Mitigations in LA Chat:**

- **Password policy:** Minimum 8 chars, must contain uppercase, lowercase, and a digit (`passwordSchema` in `@la-chat/validation`).
- **Password hashing:** argon2id (see A02).
- **Rate limiting:** `@Throttle({ limit: 10, windowSec: 60 })` on `/auth/login` and `/auth/register`. In-memory per process for now.
- **Refresh-token rotation:** Each refresh issues a new refresh token and revokes the old one. Reuse of a revoked token triggers `RefreshTokenReuseException` and revokes the entire session family.
- **JWT `status` claim:** Tokens include the user's `status`. A `SUSPENDED` user's tokens fail the guard even before expiry.
- **Session revocation:** `POST /auth/logout` revokes the refresh session; suspending a user revokes **all** their sessions (`UserSession.revokedAt = now()`).
- **Multi-device support:** Each login creates a separate session row, so revoking one device does not log out the others.

**Residual risks:**

- ⚠️ No MFA enforcement for privileged accounts. The `mfa_secret` column exists; enforcement is pending Phase 2 follow-up.
- ⚠️ No credential-stuffing detection (e.g. "same password used across many accounts"). Mitigation: rate limiting + audit log review.

**Open follow-ups:** Roll out TOTP-based MFA for `HEADTEACHER`, `SCHOOL_ADMINISTRATOR`, `ICT_ADMINISTRATOR`.

---

## A08 — Software and Data Integrity Failures

**Risk:** Tampered CI pipeline, unsigned dependencies, anti-tampering missing on critical data.

**Mitigations in LA Chat:**

- **Audit log:** Every privileged action is recorded with actor, action, target, IP, user-agent, timestamp. Tampering with a row would itself be visible (no `UPDATE` path is exposed).
- **Moderation access log:** Append-only by schema design (no `UPDATE`/`DELETE`).
- **Idempotent message send:** `(conversationId, clientMessageId)` unique constraint. A client cannot inject duplicate messages.
- **Message soft-delete:** Deletion sets `deletedAt` and nulls `body`; the original row is preserved for audit. A hard-delete requires DBA access.
- **CI integrity:** Planned — Conventional Commits + signed tags (Phase 8).
- **Dependency integrity:** `pnpm` verifies package integrity hashes from the lockfile.

**Residual risks:**

- ⚠️ No code signing on the API Docker image. Mitigation: images are built on the school server itself (no external registry) — the build host is the trust root.

---

## A09 — Security Logging and Monitoring Failures

**Risk:** Security events happen but nobody notices.

**Mitigations in LA Chat:**

- **Audit log module:** `apps/api/src/audit/audit.service.ts` exposes `/admin/audit` (filterable by actor, action, target). Permission: `SYSTEM_AUDIT_READ`.
- **What is logged:**
  - Every failed permission check (warning level).
  - Every successful admin action: `user.approve`, `user.suspend`, `user.restore`, `announcement.create`, `announcement.delete`, `report.create`, `moderation.warn`, `moderation.remove_message`, `moderation.suspend_account`, `moderation.dismiss`.
  - Every moderation access to private message content (`moderation_access_log`).
  - Every login (successful or failed) — recorded by the auth module.
- **Dashboard widget:** Headteacher's dashboard surfaces the last 10 admin actions.
- **Server-side logging:** API logs to stdout (Docker logs / journald collect it on the school server).

**Residual risks:**

- ⚠️ No alerting on threshold breaches (e.g. > 50 failed logins in 5 min). Manual monitoring via dashboard.
- ⚠️ No centralised log aggregation beyond Docker logs. For a single-server deployment this is acceptable.

**Open follow-ups:** Add a simple alert script (cron) that emails the DPO when failed-login count exceeds a threshold.

---

## A10 — Server-Side Request Forgery (SSRF)

**Risk:** The server fetches a URL controlled by the user, allowing it to reach internal services.

**Mitigations in LA Chat:**

- **No user-controlled URL fetching.** The API does **not** have any endpoint that accepts a URL and fetches it server-side.
- **Media:** Files are uploaded directly to MinIO via the API's signed upload flow — the API does not fetch URLs on behalf of users.
- **Push notifications:** Push tokens are stored as opaque strings; the FCM/APNs endpoint is fixed at compile time, not user-controlled.
- **Webhooks:** None.
- **Avatar / profile image:** Not yet implemented. When added, the design will be **upload-only** (no URL ingestion).

**Residual risks:** None identified.

---

## Summary

| OWASP category | Status |
|---|---|
| A01 Broken Access Control | ✅ Strong (RBAC + row-level + audit) |
| A02 Cryptographic Failures | ✅ Strong (argon2id, TLS 1.3, signed URLs) |
| A03 Injection | ✅ Strong (Prisma + Zod) |
| A04 Insecure Design | ✅ Strong (conversation policy, moderation log) |
| A05 Security Misconfiguration | ✅ Adequate (helmet + env secrets) |
| A06 Vulnerable Components | 🟡 Partial (Dependabot pending) |
| A07 Auth Failures | 🟡 Partial (MFA pending) |
| A08 Software/Data Integrity | ✅ Strong (audit log, idempotency) |
| A09 Logging/Monitoring | 🟡 Partial (alerting pending) |
| A10 SSRF | ✅ Strong (no URL fetching) |

**Verdict:** LA Chat meets the OWASP Top 10 — 2021 bar for a school-internal chat application. Open follow-ups (MFA, Dependabot, alerting, hard-delete scheduler) are tracked in `STATUS.md` and the Phase 8 backlog.
