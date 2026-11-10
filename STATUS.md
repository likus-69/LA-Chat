# LA Chat — Development Status

**Last updated:** 2026-11-11
**Live source of truth for what works, what is partial, and what is still to build.** Per spec §26, this file is updated at every milestone.

---

## At a glance

| Phase | Status | Notes |
|---|---|---|
| 1. Foundation | ✅ Done | Repo, stack, design tokens, Docker Compose, app shells. |
| 2. Auth & Users | 🟡 Partial | Auth, RBAC, profiles, classes/streams/subjects done. MFA, CSV import, session UI pending. |
| 3. Messaging | ⏳ Not started | Next phase. |
| 4. Media & Notifications | ⏳ Not started | |
| 5. School Features | ⏳ Not started | |
| 6. Security & Moderation | ⏳ Not started | |
| 7. Mobile | ⏳ Not started | |
| 8. Testing & Deployment | ⏳ Partial | Unit tests for validation; full suite pending. |

Legend: ✅ done · 🟡 partial · ⏳ not started

---

## Phase 1 — Foundation ✅

### Completed

- pnpm workspace monorepo with `apps/`, `packages/`, `infrastructure/`, `database/`, `documentation/`, `tests/`.
- Shared packages: `@la-chat/shared-types` (DTOs, enums, role→permission map), `@la-chat/validation` (Zod schemas).
- Docker Compose for Postgres 16, Redis 7, MinIO.
- Caddyfile template for the school server with HSTS + auto-HTTPS.
- Nightly backup script template (`infrastructure/school-server/scripts/backup.sh`).
- Example env file (`.env.example`) — no real secrets.
- Brand palette placeholder in `apps/web/src/app/globals.css` (to be extracted from the official logo in Phase 2).

### Build verification (run in this commit)

```
pnpm install                                       # ✓
pnpm --filter @la-chat/shared-types build          # ✓
pnpm --filter @la-chat/validation build            # ✓
pnpm --filter @la-chat/api build                   # ✓ (nest build, 0 errors)
pnpm --filter @la-chat/web build                   # ✓ (Next.js build, 4 routes)
npx prisma generate                                # ✓
npx prisma migrate diff --script                   # ✓ 692-line init migration
pnpm --filter @la-chat/api test                    # ✓ 10/10 tests pass
```

### Not yet done in Phase 1

- `@la-chat/design-system` package — deferred to Phase 2 when the design tokens are extracted from the official logo.
- `@la-chat/shared-utils` package — not yet needed; will be added when the first util is shared.
- Mobile app scaffold (`apps/mobile/`) — Phase 7.

---

## Phase 2 — Auth & Users 🟡

### Completed

- **Registration** — student (admission no + class + stream) and staff (staff no + role). Email/phone uniqueness checked. Passwords hashed with argon2id. Accounts land in `PENDING` status.
- **Login** — by email, phone, admission no, or staff no. Returns access token (15 min) + refresh token (7 days). Refresh tokens are rotated on use and stored hashed (SHA-256) in `user_sessions`.
- **Logout** — revokes the refresh session.
- **JWT auth guard** — bearer token via `passport-jwt`. Tokens include `sub`, `roles`, `status`; rejected if user is no longer `ACTIVE`.
- **Roles & permissions** — 9 roles + `PARENT_GUARDIAN`. Permission catalogue of 38 codes. `@Permissions(...)` decorator + `PermissionsGuard` enforce on every protected route. Failed permission checks log a warning.
- **Role → permission seeding** — `RolesService.onModuleInit()` upserts the canonical `ROLE_PERMISSIONS` map into the DB on boot.
- **Users API** — `/users/me`, `/users` (paginated, filter by role/status), `/users/:id/approve`, `/users/:id/suspend`, `/users/:id/restore`. Audit log entries written for each admin action.
- **Academic API** — CRUD for classes (S1–S6), streams, subjects. Authenticated read for all; write requires `class.manage` / `subject.manage`.
- **Rate limiting** — `@Throttle({ limit, windowSec })` decorator + `ThrottleGuard` on auth endpoints (10/min per IP).
- **Input validation** — Zod schemas in `@la-chat/validation`, validated in controllers via `ZodValidationException`.
- **Swagger UI** — available at `GET /docs`.
- **Health check** — `GET /health` (bypasses API prefix).
- **Synthetic seed data** — ICT admin, school admin, headteacher, 2 teachers, 4 students (S1 East/West), 1 parent. **No real student data.**

### Not yet done in Phase 2

- ⏳ **MFA for privileged accounts** — schema has `mfa_secret` column; enforcement not implemented.
- ⏳ **CSV import / export** — `user.import_csv` / `user.export_csv` permissions exist; endpoint not implemented.
- ⏳ **Session management UI** — `user_sessions` table exists; no UI to view/revoke sessions.
- ⏳ **Device management** — `devices` table exists; no registration flow.
- ⏳ **Password reset flow** — endpoint not implemented (will use a printed code for students without email).
- ⏳ **Profile editing** — `PATCH /users/me` is a stub (returns null).
- ⏳ **Official logo extraction** — brand palette is a placeholder; needs the real logo asset from the school.

### Verification (run by the developer with Docker)

```bash
docker compose up -d db redis minio
pnpm -w migrate           # applies the init migration
pnpm -w seed              # loads synthetic data
pnpm -w dev:api           # http://localhost:4000/docs

# Smoke test
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"ict.admin@la-chat.local","password":"Password1"}'
# → 200 with { user, tokens: { accessToken, refreshToken, expiresIn } }

curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
# → 200 with the ICT admin's profile

curl -X POST http://localhost:4000/api/v1/users/me \  # using a student token
  ...
# A student calling /users (list) → 403
```

---

## Open compliance items

- ⏳ **Uganda DPPA 2019 review** — must be completed before declaring production-ready. Tracked here; owner: school's Data Protection Officer (to be designated).
- ⏳ **Records retention policy** — schema supports soft-delete + scheduled hard-delete; the actual retention periods (7 years post-leaving for student records) must be confirmed with the school's records policy.
- ⏳ **Breach notification runbook** — template drafted in `hybrid-hosting.md` §10; needs DPO sign-off.

---

## Known limitations

1. **No real-time messaging yet.** The WebSocket gateway is planned for Phase 3. Today the API is REST-only.
2. **ThrottleGuard is in-memory per process.** Sufficient for a single-server deployment; will move to Redis when (if) we go multi-instance.
3. **No mobile apps.** Phase 7.
4. **MinIO backup script is a template.** The `mc mirror` invocation needs a real config; left as a TODO from Phase 6.
5. **Brand colours are placeholders.** The official Light Academy logo must be supplied to extract the real palette.

---

## What to do next

Per `documentation/deployment/roadmap.md`, the next milestone is **Phase 3 — Messaging**:

1. WebSocket gateway in the API (`@WebSocketGateway`).
2. Message send/receive with idempotency on `client_message_id`.
3. Conversation list + history endpoints (cursor pagination).
4. Read receipts + delivery status.
5. Message reactions, edit, delete, reply, forward.
6. Postgres `tsvector` full-text search on `messages.body`, gated by `message.search` permission.

When Phase 3 is complete, update this file.
