# LA Chat

**Secure school communication platform for Light Academy Secondary School.**
*A Different Approach to Education.*

LA Chat connects students, teachers, administrators and parents of Light Academy Secondary School through a single, school-owned, auditable messaging system. It runs on a single server inside the school, with encrypted cloud backup for safety, and is reachable from Android, iOS and any web browser.

> **Status:** Phase 1 + partial Phase 2 complete. See [`STATUS.md`](./STATUS.md) for what works, what is in progress, and what is still to build.

---

## Quick start (developer)

> Requires Node 22+, pnpm 9+, Docker, and Docker Compose.

```bash
git clone https://github.com/likus-69/LA-Chat.git
cd LA-Chat
cp .env.example .env            # then edit secrets
pnpm install
docker compose up -d            # Postgres + Redis + MinIO
pnpm -w migrate                 # create the schema
pnpm -w seed                    # synthetic data only — no real students
pnpm -w dev:api                 # http://localhost:4000  (Swagger at /docs)
pnpm -w dev:web                 # http://localhost:3000  (login screen)
```

Test logins (password is `Password1` for all seed accounts):

| Role | Identifier |
|---|---|
| ICT Administrator | `ict.admin@la-chat.local` |
| School Administrator | `school.admin@la-chat.local` |
| Headteacher | `headteacher@la-chat.local` |
| Teacher | `teacher1@la-chat.local` |
| Student | `student.s1e-0001@la-chat.local` |

---

## Repository layout

The full layout and dependency rules are in [`documentation/architecture/repository-structure.md`](./documentation/architecture/repository-structure.md). Headline:

```
apps/
  api/      NestJS + Prisma + PostgreSQL — auth, users, RBAC, academic
  web/      Next.js 15 — login, dashboard shell
  mobile/   Expo (React Native) — Phase 7
packages/
  shared-types/   DTOs, enums, role→permission map (runtime-free)
  validation/     Zod schemas (one per DTO)
infrastructure/
  docker/         Dockerfiles
  school-server/  Caddyfile, backup scripts, systemd units
database/
  schema/         Prisma schema (canonical)
  seeds/          synthetic seed data only
documentation/
  PLAN.md         executive summary + index — start here
  architecture/   system-architecture, tech-stack, erd, repository-structure
  security/       permissions-matrix
  deployment/     hybrid-hosting (focus), roadmap
```

---

## Documentation

- **Start here:** [`documentation/PLAN.md`](./documentation/PLAN.md) — executive summary + index for both school leadership and developers.
- **Architecture:** [`documentation/architecture/system-architecture.md`](./documentation/architecture/system-architecture.md)
- **Database design:** [`documentation/architecture/erd.md`](./documentation/architecture/erd.md)
- **Permissions matrix:** [`documentation/security/permissions-matrix.md`](./documentation/security/permissions-matrix.md)
- **Hybrid hosting (focus area):** [`documentation/deployment/hybrid-hosting.md`](./documentation/deployment/hybrid-hosting.md)
- **Roadmap:** [`documentation/deployment/roadmap.md`](./documentation/deployment/roadmap.md)
- **Live status:** [`STATUS.md`](./STATUS.md)

---

## What works today (Phase 1 + partial Phase 2)

- ✅ Working NestJS API with PostgreSQL, Prisma, JWT auth, refresh-token rotation, role-based access control with 9 roles + Parent/Guardian, and the full normalised schema (26 tables).
- ✅ Account registration for students (admission no) and staff (staff no), with approval workflow and suspend/restore.
- ✅ Academic structure CRUD: classes (S1–S6), streams, subjects.
- ✅ Next.js web shell with branded login screen, token storage, refresh-on-401, and a stub dashboard showing the authenticated user's profile and roles.
- ✅ Docker Compose for Postgres + Redis + MinIO.
- ✅ Swagger UI at `/docs`.
- ✅ Unit tests for the validation layer.

## What is not yet done

- ⏳ Real-time messaging, groups, media, voice (Phases 3–4).
- ⏳ Mobile apps (Phase 7).
- ⏳ Moderation queue UI, audit log UI (Phase 6).
- ⏳ Push notifications (Phase 4).
- ⏳ Production deployment runbook + staging environment (Phase 8).
- ⏳ Uganda DPPA 2019 compliance review (Phase 6, tracked in STATUS.md).

---

## Contributing

PRs welcome. Please:

1. Branch from `main`.
2. Run `pnpm -w lint && pnpm -w typecheck && pnpm -w test` before pushing.
3. Keep the schema in `apps/api/prisma/schema.prisma` as the source of truth — regenerate migrations with `pnpm -w migrate`.
4. **Never commit real student data.** The seed script uses only synthetic data; a CI check (planned) will reject any CSV that does not match the `S[1-6][EW]-\d{4}` admission-number pattern.

## License

MIT — see [`LICENSE`](./LICENSE).
