# LA Chat — Security Test Checklist

OWASP Top 10 (2021) verification checklist for the LA Chat platform.

## A01: Broken Access Control
- [ ] JWT auth guard on every protected route
- [ ] `@Permissions()` decorator + `PermissionsGuard` enforces RBAC
- [ ] Row-level checks: users can only see conversations they're participants in
- [ ] Conversation policy: student→student chat disabled by default
- [ ] Teacher→student requires `teacher_assignments` row
- [ ] Parent→teacher requires teacher teaches parent's child
- [ ] Moderation access logged in append-only `moderation_access_log`
- [ ] File downloads require ownership OR conversation participation
- [ ] Search respects visibility (only searches conversations the user is in)

## A02: Cryptographic Failures
- [ ] Passwords hashed with argon2id (not bcrypt/SHA)
- [ ] TLS 1.3 enforced by Caddy
- [ ] Refresh tokens stored hashed (SHA-256) in DB
- [ ] Signed URLs expire after 5 minutes
- [ ] No secrets in source control (`.env` gitignored)
- [ ] HSTS header set (1 year, preload)

## A03: Injection
- [ ] All DB queries via Prisma (parameterized)
- [ ] All input validated via Zod schemas
- [ ] No raw SQL string concatenation
- [ ] No `eval()` or `Function()` usage

## A04: Insecure Design
- [ ] Conversation policy enforced server-side, not client-side
- [ ] Idempotent message send prevents duplicate on reconnect
- [ ] Rate limiting on auth endpoints (10/min per IP)
- [ ] Account approval workflow (no public registration)

## A05: Security Misconfiguration
- [ ] Helmet middleware sets security headers
- [ ] CORS restricted to known origins
- [ ] Debug mode off in production (`NODE_ENV=production`)
- [ ] Swagger UI disabled in production (or auth-gated)

## A06: Vulnerable Components
- [ ] `pnpm audit` passes with no high/critical vulnerabilities
- [ ] Dependabot enabled on GitHub
- [ ] Docker images pinned to specific versions

## A07: Authentication Failures
- [ ] Login rate limited (10 attempts/min)
- [ ] Refresh token rotation on every use
- [ ] Session revocation on suspend/logout
- [ ] JWT expiry: access 15min, refresh 7 days

## A08: Software/Data Integrity Failures
- [ ] Audit log records every admin action
- [ ] Message integrity: `client_message_id` prevents duplication
- [ ] Webhook signatures (if any) verified

## A09: Logging/Monitoring Failures
- [ ] Audit log module captures auth, admin, moderation events
- [ ] Failed permission checks logged
- [ ] Prometheus metrics endpoint planned
- [ ] Error tracking (Sentry) planned

## A10: SSRF
- [ ] No user-controlled URL fetching
- [ ] Signed URL generation uses internal S3 client, not user input
