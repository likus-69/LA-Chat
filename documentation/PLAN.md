# LA Chat — Project Plan

**School:** Light Academy Secondary School
**Motto:** A Different Approach to Education
**Mission:** Connecting the Light Academy community through secure, simple and effective communication.
**Repo:** https://github.com/likus-69/LA-Chat
**Document owner:** ICT Administrator (Light Academy)
**Last updated:** 2026-11-11

---

## 1. Executive summary (for school leadership)

LA Chat is a private, school-owned communication platform — modelled on the simplicity of WhatsApp — that connects students, teachers, administrators and parents of Light Academy Secondary School. It runs on a single server inside the school, with encrypted cloud backup for safety, and is reachable from Android, iOS and any web browser.

**Why we are building it.** Today the school relies on a mix of WhatsApp groups, printed notices and phone calls. That works, but it leaks student data outside school control, gives parents no single source of truth, and gives the headteacher no audit trail. LA Chat fixes all three.

**What it will do (in plain language).**

- Let students and teachers message each other inside the school's authorised class, stream and subject groups.
- Let the headteacher and office push official announcements that everyone receives.
- Let teachers message parents about a specific child, without exposing the child's private chats.
- Let the ICT team manage accounts, classes, backups and security from one dashboard.
- Keep a complete record of who said what, when — for safety, audits and dispute resolution — without giving any one person unrestricted access to private conversations.

**How it will be run.** A single server on school premises hosts the database, the API and the web app. A small cloud subscription handles nightly encrypted backups and push notifications to Android/iOS. If the internet goes down, messaging inside the school keeps working; when the internet returns, messages sync automatically.

**What it costs (indicative).** One-time: a modest server (recycled desktop or small rack server) and setup labour. Recurring: electricity, a domain name, an SSL certificate, and a small cloud bucket for backups and push notifications. Detailed costing is in `documentation/deployment/hybrid-hosting.md`.

**How long it takes.** Eight phases over an estimated 12–16 weeks to a usable MVP, with safety and security built in from phase 1. See `documentation/deployment/roadmap.md`.

**What we will NOT do.**

- No public sign-up — every account is created or approved by the school.
- No unrestricted surveillance of private conversations — moderation access is logged and requires a reason.
- No real student data in development or test environments.
- No claim of legal compliance until a Ugandan Data Protection and Privacy Act, 2019 review has been completed.

---

## 2. Index of planning documents

| # | Document | Audience | What it covers |
|---|----------|----------|----------------|
| 1 | `architecture/system-architecture.md` | Developers + ICT | The eight deliverables from spec §28: architecture, stack, repo structure, ERD, permission matrix, hybrid hosting, roadmap, milestone 1. |
| 2 | `architecture/tech-stack.md` | Developers | Chosen stack and justification, with the few deviations from spec §3. |
| 3 | `architecture/repository-structure.md` | Developers | Monorepo layout, package boundaries, dependency rules. |
| 4 | `architecture/erd.md` | Developers + DBA | Normalised relational design, 25+ tables, key relationships, indexes. |
| 5 | `security/permissions-matrix.md` | Developers + Admin | Role-by-role permission matrix for all 9 roles + Parent. |
| 6 | `deployment/hybrid-hosting.md` | ICT + Leadership | **Focus area.** School-server + cloud topology, offline sync, DR, firewall, single-server sizing. |
| 7 | `deployment/roadmap.md` | All | 8-phase plan, milestones, acceptance gates, MVP scope. |
| 8 | `../STATUS.md` | All | Live development status: done / in progress / blocked, per spec §26. |

---

## 3. What is already done in this repo

This commit contains:

- The full planning documentation listed above.
- **Phase 1 working code**: backend (NestJS + Prisma + PostgreSQL) with authentication, user management, role-based access control and the full database schema; a Next.js web shell with login; Docker Compose for local development; a seed script with synthetic data only.
- A live `STATUS.md` listing what works, what is partial, and what is still to build.

What is **not** in this commit: real-time messaging engine, media sharing, mobile apps, moderation queue, push notifications, audit log UI. These are phases 3–8.

---

## 4. How to read this plan

- **School leadership / headteacher / bursar:** read §1 above, then `deployment/hybrid-hosting.md` (costs and risk) and `deployment/roadmap.md` (timeline).
- **ICT administrator:** read everything, starting with `architecture/system-architecture.md` and `deployment/hybrid-hosting.md`.
- **Developers:** start with `architecture/system-architecture.md`, then `architecture/repository-structure.md`, `architecture/erd.md`, `security/permissions-matrix.md`, then the code under `apps/`.
- **Compliance / data protection officer:** `security/permissions-matrix.md` + `deployment/hybrid-hosting.md` (data residency, backups, retention) — and note the open compliance items in `STATUS.md`.
