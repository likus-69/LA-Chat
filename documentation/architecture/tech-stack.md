# LA Chat — Technology Stack

Detailed justification lives in `system-architecture.md` §2. This page is the quick-reference card.

## Stack at a glance

| Layer | Technology | Version (target) |
|---|---|---|
| Web | Next.js (App Router) + React + TypeScript | 15.x / 19.x |
| Mobile | React Native + Expo (managed) | SDK 52 |
| Backend | NestJS + TypeScript | 10.x |
| Real-time | `ws` via NestJS `@WebSocketGateway` | 8.x |
| Database | PostgreSQL | 16 |
| Cache / queue | Redis | 7 |
| ORM | Prisma | 5.x |
| Object storage | MinIO (S3-compatible) | latest |
| Background jobs | BullMQ | 5.x |
| Reverse proxy | Caddy | 2.x |
| Containers | Docker + Docker Compose | 24+ / v2 |
| CI/CD | GitHub Actions | — |
| Monitoring | Prometheus + Grafana + Loki | latest |
| Package manager | pnpm (workspace) | 9+ |
| Node runtime | Node.js LTS | 22 LTS |

## Shared packages

| Package | Purpose | Runtime |
|---|---|---|
| `@la-chat/shared-types` | DTO interfaces, enums, role constants | Browser + RN + Node |
| `@la-chat/validation` | Zod schemas (one per DTO) | Browser + RN + Node |
| `@la-chat/design-system` | Design tokens, primitive components | Browser (+ RN via re-export) |
| `@la-chat/shared-utils` | Slug, date, id, class-name helpers | Browser + RN + Node |

## Deviations from spec §3

1. **Caddy** instead of Nginx — automatic HTTPS, simpler config for a small ICT team.
2. **Prisma** instead of raw SQL migrations — type-safe, reviewable schema-as-code.
3. **MinIO on-prem as primary object storage** — keeps student files in-country (DPPA 2019 data residency).

## Why not a microservices architecture

At ≤ 5 000 users and ≤ 50 000 messages/day, a single well-instrumented NestJS process is faster, simpler and cheaper to operate than a service mesh. We will split out the realtime gateway and the media-transcoding worker only when metrics show pressure — see `roadmap.md` §scaling.
