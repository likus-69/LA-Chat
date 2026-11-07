# LA-Chat

LA-Chat is a monorepo for a multi-platform conversational application. The repository is organized to separate application code, shared libraries, infrastructure, documentation, and test assets.

## Repository structure

```text
la-chat/
├── apps/
│   ├── web/                 # Client-facing web application
│   ├── mobile/              # Android and iOS client
│   └── api/                 # Backend API and business logic
├── packages/
│   ├── shared-types/        # Shared domain and API contract types
│   ├── validation/          # Validation utilities and schemas
│   ├── design-system/       # Shared UI components and design tokens
│   └── shared-utils/        # Cross-project utility helpers
├── infrastructure/
│   ├── docker/              # Local/container configuration
│   ├── school-server/       # School/server deployment assets
│   ├── cloud/               # Cloud deployment and infra-as-code
│   └── monitoring/          # Logs, telemetry, and monitoring config
├── database/
│   ├── migrations/          # Database schema migrations
│   ├── seeds/               # Seed scripts and sample data
│   └── schema/              # ERD and schema definitions
├── documentation/
│   ├── architecture/        # System design and architecture docs
│   ├── api/                 # API reference and specs
│   ├── security/            # Security and auth docs
│   ├── deployment/          # Deployment guides and runbooks
│   └── user-guides/         # End-user and admin guides
├── tests/                   # Integration, e2e, and shared test assets
├── .env.example             # Example environment variables
├── docker-compose.yml       # Local service orchestration
├── LICENSE                  # License information
├── README.md                # Project overview and onboarding
└── .gitignore               # Git ignore rules
```

## Getting started

This repository is scaffolded but does not yet include the application implementation, dependencies, or runtime configuration. As each component is added, the relevant app or package should include its own setup, environment variables, and scripts.

### Typical developer workflow

1. Copy `.env.example` to a local environment file and fill in values.
2. Start local infrastructure with Docker Compose.
3. Run the web, mobile, or API app in its own directory.
4. Use the shared packages for validation, types, and UI components.

## Notes

- The monorepo is intentionally split by concern to support multiple frontend/client targets and a shared backend.
- The structure is ready for future growth as features, services, and deployment logic are introduced.

## License

See [LICENSE](LICENSE).
