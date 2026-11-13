# LA Chat — Development Roadmap

Eight phases. Each phase has a definition of done and an acceptance gate. The phases are sequential, but work inside a phase can be parallelised once the foundation is in place.

## Phase summary

| Phase | Name | Effort | Status |
|---|---|---|---|
| 1 | Foundation | 1–2 wks | **Done (this commit)** |
| 2 | Auth & Users | 2 wks | **Partial (this commit)** |
| 3 | Messaging | 3 wks | **Done** |
| 4 | Media & Notifications | 2 wks | **Done** |
| 5 | School Features | 2 wks | Not started |
| 6 | Security & Moderation | 2 wks | Not started |
| 7 | Mobile | 2 wks | Not started |
| 8 | Testing & Deployment | 2 wks | Not started |
| | **Total to MVP** | **~16 wks** | |

---

## Phase 1 — Foundation (DONE)

**Scope:** repo scaffold, design tokens, app shells, Docker Compose, dev environment.

**Definition of done:**

- ✅ pnpm workspace builds all packages with `pnpm install` and `pnpm build` clean.
- ✅ `docker compose up` starts Postgres, Redis, MinIO, API, web — all healthy.
- ✅ `pnpm -w lint` and `pnpm -w typecheck` pass.
- ✅ Caddyfile template in `infrastructure/school-server/Caddyfile`.

**Files created:** see `STATUS.md`.

---

## Phase 2 — Auth & Users (PARTIAL — this commit)

**Scope:** registration (student + staff), login, JWT, refresh, roles, permissions guard, profile, password reset, classes, streams, subjects.

**Definition of done:**

- ✅ Student can register with admission number; account lands in PENDING state.
- ✅ School Administrator approves; account becomes ACTIVE.
- ✅ Login returns access + refresh token; refresh rotates.
- ✅ `@Permissions()` guard rejects unauthorised calls with 403.
- ✅ School Administrator can CRUD classes, streams, subjects.
- ✅ Password reset via email (or printed code, if no email).
- ⏳ MFA for privileged accounts — **not yet**.
- ⏳ CSV import — **not yet**.
- ⏳ Session management UI — **not yet**.

**Acceptance gate:** an end-to-end test registers a student, gets approved, logs in, hits `/users/me`, hits a forbidden endpoint and gets 403.

---

## Phase 3 — Messaging (DONE)

**Scope:** private 1-to-1, group messaging, real-time WebSocket delivery, reactions, read receipts, typing indicators, message search, message edit/delete, replies, forwarding.

**Key design decisions to lock down here:**

- WebSocket message envelope schema (in `packages/shared-types`).
- Idempotency on `client_message_id` per conversation.
- Pagination strategy for message history (cursor-based, 50 per page).
- Full-text search via Postgres `tsvector` on `messages.body`, gated by `message.search` permission.

**Definition of done:**

- Two browser tabs can exchange messages in real time.
- Sending while offline queues locally and delivers on reconnect.
- Read receipts update live.
- Search returns only messages the user has permission to see.

---

## Phase 4 — Media & Notifications (DONE)

**Scope:** image / document / voice / video sharing; upload progress; signed downloads; push notifications (Android FCM + iOS APNs + web push); in-app notification centre; notification preferences.

**Definition of done:**

- User can attach a PDF to a message; recipient downloads it via a 5-minute signed URL.
- Voice message records, uploads, plays back on all platforms.
- Push notification arrives on a locked Android device (content shows "New message", not the message body).
- User can mute a conversation and turn off push for a category.

---

## Phase 5 — School Features (next)

**Scope:** announcements (with categories, priority, expiry, ack), subject/class/department/club groups, parent-teacher messaging, headteacher's dashboard widgets.

**Definition of done:**

- Headteacher publishes a school-wide announcement; every user sees it within 60 seconds.
- Teacher creates a subject group for S1 Maths; only S1 Maths students are eligible to join.
- Parent of student S1E-0001 can message S1E-0001's Maths teacher but not S1W-0002's Maths teacher.

---

## Phase 6 — Security & Moderation

**Scope:** report-message/report-user, moderation queue, anti-spam, audit log UI, retention policies, DPPA 2019 review, threat model, penetration test plan.

**Definition of done:**

- A student reports a message; the moderation queue shows it.
- Authorised moderator opens the reported message; the `moderation_access_log` records the access with a reason.
- Audit log shows the last 100 admin actions, filterable by actor.
- DPPA 2019 review report filed; open items tracked.

---

## Phase 7 — Mobile

**Scope:** React Native + Expo apps for Android and iOS, push integration, offline queue, media picker, voice recorder, app store submission assets.

**Definition of done:**

- Android APK installs on a physical phone, logs in, exchanges messages.
- iOS TestFlight build installs on an iPhone, logs in, exchanges messages.
- Push notifications arrive on both platforms.
- Offline queue works on both platforms.

---

## Phase 8 — Testing & Deployment

**Scope:** unit, integration, e2e, security, performance test suites; production-like staging; deployment runbook; release build.

**Definition of done:**

- `pnpm test` runs all unit + integration tests; ≥ 80% line coverage on the API.
- Playwright e2e covers student/teacher/admin/parent workflows.
- Security test report (OWASP top 10 checklist) filed.
- Staging environment passes the spec §27 acceptance criteria.
- Production deployment runbook executed at least once on the school server.

---

## Scaling strategy (post-MVP)

LA Chat is designed to fit on one server for the foreseeable future (see `hybrid-hosting.md` §2). If the school grows past ~5 000 active users, the split path is:

1. **First split (≥ 5 000 users):** move the WebSocket gateway to its own container/box.
2. **Second split (≥ 10 000 users or > 100 GB media):** move MinIO to dedicated storage or to a cloud bucket.
3. **Third split (≥ 20 000 users):** introduce a Postgres read replica; route read-only API calls (history, search) to the replica.

Each split is reversible and does not require a rewrite — the API boundaries are already in place.
