# LA Chat — Repository Structure

The repo is a **pnpm workspace monorepo**. The scaffold already exists; Phase 1 fills in the implementation under `apps/api` and `apps/web`.

## Layout

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

## Dependency rules

- `apps/*` may import from `packages/*`, **never** from each other.
- `packages/*` may import from each other but **never** from `apps/*`.
- `shared-types` and `validation` must remain runtime-free (no Node-only APIs) so they work in the browser, in React Native and in Node.
- `design-system` may use React but must not import app-specific business logic.

## Naming conventions

- Packages are published under the `@la-chat/` scope (workspace-only, not published to npm).
- Every package exposes a barrel `src/index.ts`.
- TypeScript paths are configured in the root `tsconfig.base.json` and referenced by each app.

## What lives where (common questions)

| Concern | Location |
|---|---|
| Prisma schema | `database/schema/schema.prisma` (source of truth) — symlinked into `apps/api/prisma/schema.prisma` |
| Migrations | `database/migrations/` (Prisma-managed) |
| Seed data | `database/seeds/seed.ts` (synthetic only) |
| OpenAPI spec | `documentation/api/openapi.json` (generated from NestJS controllers) |
| Environment variables | `.env.example` at root; per-app `.env` files in dev, real secrets in `infrastructure/school-server/secrets.env` |
| Caddyfile | `infrastructure/school-server/Caddyfile` |
| Backup scripts | `infrastructure/school-server/scripts/backup-*.sh` |
