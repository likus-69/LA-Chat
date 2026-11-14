# LA Chat — End-to-End Tests

Playwright E2E tests covering student, teacher, and administrator workflows.

## Prerequisites

- The web app running (`pnpm --filter @la-chat/web dev`)
- The API running (`pnpm --filter @la-chat/api dev`)
- Docker services up (`docker compose up -d db redis minio`)
- Seed data loaded (`pnpm -w seed`)

## Running

```bash
# Install Playwright
npx playwright install

# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run a specific file
npx playwright test student-workflow.spec.ts
```

## Test accounts

All use password `Password1`:

| Role | Identifier |
|---|---|
| Student | `student.s1e-0001@la-chat.local` |
| Teacher | `teacher1@la-chat.local` |
| Headteacher | `headteacher@la-chat.local` |
| ICT Admin | `ict.admin@la-chat.local` |

## Scenarios covered

- **Student**: login, view chat list, open announcements, cannot access moderation
- **Teacher**: login, send message, create announcement
- **Admin**: login, view dashboard stats, approve pending account, view audit log
