# LA Chat

LA Chat is a secure school communication and administration platform for Light Academy Secondary School. It is designed to provide a single, school-owned, auditable system for messaging, user management, academic records, and role-based access across students, teachers, administrators, and parents.

This repository contains the full monorepo for the platform, including the API backend, web frontend, mobile app scaffold, shared packages, database schema, and supporting infrastructure.

## Overview

LA Chat aims to replace fragmented communication tools with a unified platform that keeps records inside the school environment and supports secure, permissioned collaboration.

The system is structured around a core idea:

- school communications should be auditable
- access should be role-aware and policy-driven
- data ownership should remain with the institution
- the platform should support a gradual rollout across academic workflows

## Goals

- Centralized school communication for staff, students, and parents
- Role-based access control for multiple school roles
- Student and staff onboarding with approval workflows
- Academic organization for classes, streams, and subjects
- Clear auditability and future compliance alignment
- Extensible architecture for real-time messaging and mobile-first access

## Current status

This project is in active development.

Current completed areas include:

- NestJS API with PostgreSQL and Prisma
- JWT authentication and refresh-token rotation
- Role-based access control with multiple school roles
- Student and staff account registration flows
- Academic structure management
- Next.js web shell and login experience
- Docker-based local development environment
- Validation layer tests and seeded demo data

Planned areas include:

- real-time messaging and groups
- media and voice communication
- moderation and audit tooling
- push notifications
- production deployment and operational runbooks

For more detail, see the project status document: [STATUS.md](./STATUS.md).

## Architecture

The monorepo is organized as follows:

```text
LA-Chat/
├── apps/
│   ├── api/        # NestJS API, Prisma, authentication, RBAC, academic services
│   ├── web/        # Next.js application for school-facing UI
│   └── mobile/     # Expo / React Native app (planned/partial)
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   ├── validation/
│   └── design-system/
├── database/
│   └── schema/
├── infrastructure/
│   └── docker/
├── documentation/
│   ├── architecture/
│   ├── deployment/
│   └── security/
├── tests/
├── .env.example
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── LICENSE
├── README.md
├── STATUS.md
└── tsconfig.base.json
```

## Tech stack

### Backend
- Node.js 22+
- TypeScript
- NestJS
- Prisma
- PostgreSQL
- Redis
- JWT + refresh token rotation
- Swagger/OpenAPI

### Frontend
- Next.js 15
- React 19
- TypeScript

### Mobile
- Expo / React Native

### Shared tooling
- pnpm workspaces
- Docker Compose
- Zod validation schemas
- shared typed packages across apps

## Getting started

### Prerequisites

Make sure you have the following installed:

- Node.js 22 or later
- pnpm 9 or later
- Docker
- Docker Compose

### Clone the repository

```bash
git clone https://github.com/likus-69/LA-Chat.git
cd LA-Chat
```

### Configure environment variables

Copy the example environment file and update it for your local setup:

```bash
cp .env.example .env
```

Then edit `.env` to set the required secrets and local service configuration.

### Install dependencies

```bash
pnpm install
```

### Start local infrastructure

```bash
docker compose up -d
```

This starts the required Postgres, Redis, and MinIO services.

### Run database migration and seed data

```bash
pnpm -w migrate
pnpm -w seed
```

Seed data is synthetic and intended for local development only. It does not include real student information.

### Start the apps

```bash
pnpm -w dev:api
pnpm -w dev:web
```

Then open:

- API: http://localhost:4000
- Swagger docs: http://localhost:4000/docs
- Web app: http://localhost:3000

## Demo/test accounts

The seeded local environment includes the following accounts for testing:

| Role | Identifier |
| --- | --- |
| ICT Administrator | `ict.admin@la-chat.local` |
| School Administrator | `school.admin@la-chat.local` |
| Headteacher | `headteacher@la-chat.local` |
| Teacher | `teacher1@la-chat.local` |
| Student | `student.s1e-0001@la-chat.local` |

Password for all seeded accounts:

```text
Password1
```

## Key workflows

### Authentication and authorization
The backend uses JWT authentication with refresh-token rotation and access controls based on roles. The role model supports multiple school personas, including administrative, academic, and learner-facing permissions.

### Academic management
The platform models school structure through classes, streams, subjects, and related educational entities, making it easier to manage institutional data cleanly.

### Approval and governance
Staff and student onboarding includes approval workflows to support operational control and reduce unauthorized access.

## Documentation

The repository contains deeper product and engineering documentation:

- [documentation/PLAN.md](./documentation/PLAN.md) — project overview and index
- [documentation/architecture/system-architecture.md](./documentation/architecture/system-architecture.md)
- [documentation/architecture/erd.md](./documentation/architecture/erd.md)
- [documentation/security/permissions-matrix.md](./documentation/security/permissions-matrix.md)
- [documentation/deployment/hybrid-hosting.md](./documentation/deployment/hybrid-hosting.md)
- [documentation/deployment/roadmap.md](./documentation/deployment/roadmap.md)
- [STATUS.md](./STATUS.md) — current implementation and remaining work

## Useful development commands

```bash
pnpm install
pnpm -w lint
pnpm -w typecheck
pnpm -w test
pnpm -w migrate
pnpm -w seed
pnpm -w dev:api
pnpm -w dev:web
```

## Contributing

Contributions are welcome.

Before pushing changes:

1. Work from the `main` branch
2. Run linting, type checking, and tests
3. Keep Prisma schema changes authoritative in the API layer
4. Do not commit real student data or sensitive school information

## Security and privacy

This project is intended for a school environment and follows a privacy-first design. The system is built to keep communication and academic data under institutional control while making access policies explicit and auditable.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Project status summary

The current implementation covers the foundational platform and developer environment. The project is advancing toward a fuller school communication platform with messaging, moderation, and deployment features still to be built.
