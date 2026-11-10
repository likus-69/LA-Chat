# LA Chat — Database Entity-Relationship Design

PostgreSQL is the primary database. The Prisma schema at `database/schema/schema.prisma` is the source of truth; this document explains the design.

## Design principles

1. **Normalised to 3NF** — no redundant student/class denormalisation at the schema level; read models can be added later for performance.
2. **UUID v7 primary keys** — time-ordered, so indexes stay friendly and we can sort by id without a separate `created_at` index for many queries.
3. **Soft delete for auditable rows** — `users`, `messages`, `reports`, `audit_logs`, `moderation_actions` use `deleted_at TIMESTAMP NULL`. Hard delete only for genuinely transient rows (e.g. `notifications` past retention).
4. **Explicit join tables** — even for many-to-many that Prisma could hide, because we almost always need extra columns (e.g. `role` on `conversation_participants`).
5. **Server-side authority** — every permission-relevant row has an `owner_id` or equivalent; row-level security is enforced in the service layer, not (yet) via Postgres RLS.

## Tables (26 total)

### Identity & access (7)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Account record | `id`, `email`, `phone`, `password_hash`, `status` (PENDING/ACTIVE/SUSPENDED/DELETED), `mfa_secret` |
| `roles` | Role catalog (enum-backed) | `id`, `name` (STUDENT, TEACHER, …) |
| `permissions` | Permission catalog | `id`, `code` (e.g. `announcement.publish.school`) |
| `role_permissions` | Many-to-many | `role_id`, `permission_id` |
| `user_roles` | Users ←→ roles (a user may hold >1) | `user_id`, `role_id`, `granted_by`, `granted_at` |
| `user_sessions` | Refresh tokens / device sessions | `id`, `user_id`, `refresh_token_hash`, `device_id`, `expires_at`, `revoked_at` |
| `devices` | Registered devices for push | `id`, `user_id`, `platform`, `push_token`, `last_seen_at` |

### Profiles (3)

| Table | Purpose | Key columns |
|---|---|---|
| `student_profiles` | 1-to-1 with `users` where role=STUDENT | `user_id`, `admission_no` (unique), `class_id`, `stream_id`, `guardian_user_id` |
| `staff_profiles` | 1-to-1 with `users` where role in (TEACHER, ADMIN, …) | `user_id`, `staff_no` (unique), `department` |
| `parent_profiles` | 1-to-1 with `users` where role=PARENT | `user_id`, `child_user_id` (FK → users), `relationship` |

### Academic (5)

| Table | Purpose | Key columns |
|---|---|---|
| `classes` | S1–S6 | `id`, `level` (1–6), `name` ("Senior One") |
| `streams` | S1 East, S1 West… | `id`, `class_id`, `name` |
| `subjects` | Math, English… | `id`, `name`, `code` |
| `teacher_assignments` | Teacher × subject × class/stream | `teacher_user_id`, `subject_id`, `class_id`, `stream_id?` |
| `student_enrolments` | Student × stream × academic year | `student_user_id`, `stream_id`, `academic_year` |

### Messaging (7)

| Table | Purpose | Key columns |
|---|---|---|
| `conversations` | 1-to-1 or group chat | `id`, `type` (PRIVATE/GROUP), `group_id?`, `last_message_at` |
| `conversation_participants` | Membership | `conversation_id`, `user_id`, `role` (MEMBER/ADMIN), `joined_at`, `left_at` |
| `messages` | One row per message | `id`, `conversation_id`, `sender_id`, `client_message_id` (unique per convo), `type` (TEXT/IMAGE/…), `body`, `reply_to_id?`, `edited_at`, `deleted_at` |
| `message_attachments` | Files linked to a message | `message_id`, `storage_key`, `filename`, `mime`, `size_bytes` |
| `message_reactions` | Emoji reactions | `message_id`, `user_id`, `emoji` (composite unique) |
| `message_read_receipts` | Per-user read watermarks | `conversation_id`, `user_id`, `last_read_message_id`, `last_read_at` |
| `message_delivery_status` | Per-recipient delivery state | `message_id`, `recipient_id`, `state` (SENT/DELIVERED/READ), `at` |

### Groups (2)

| Table | Purpose | Key columns |
|---|---|---|
| `groups` | Class, stream, subject, club, admin… | `id`, `type` (CLASS/STREAM/SUBJECT/DEPARTMENT/CLUB/ADMIN), `name`, `conversation_id`, `created_by` |
| `group_members` | Membership | `group_id`, `user_id`, `role` (MEMBER/ADMIN), `added_by`, `added_at` |

### School comms (2)

| Table | Purpose | Key columns |
|---|---|---|
| `announcements` | Official notices | `id`, `author_id`, `category`, `priority`, `title`, `body`, `audience` (ALL/CLASS/STREAM/STAFF), `published_at`, `expires_at` |
| `announcement_acknowledgements` | Read receipts for announcements | `announcement_id`, `user_id`, `acknowledged_at` |

### Moderation & safety (3)

| Table | Purpose | Key columns |
|---|---|---|
| `reports` | User-submitted reports | `id`, `reporter_id`, `reported_user_id?`, `reported_message_id?`, `category`, `reason`, `status` (OPEN/REVIEWING/RESOLVED/DISMISSED) |
| `moderation_actions` | Decisions taken on reports | `report_id`, `moderator_user_id`, `action` (WARN/REMOVE/SUSPEND/DISMISSED), `note` |
| `moderation_access_log` | **Append-only** — every time a moderator opens a private message | `moderator_user_id`, `message_id`, `reason`, `opened_at` |

### Operations (4)

| Table | Purpose | Key columns |
|---|---|---|
| `notifications` | In-app + push queue | `user_id`, `type`, `payload`, `read_at`, `created_at` |
| `audit_logs` | Auth + admin actions | `actor_user_id`, `action`, `target_type`, `target_id`, `ip`, `user_agent`, `at` |
| `system_settings` | Key-value config | `key`, `value`, `updated_by`, `updated_at` |
| `backup_records` | Backup manifest | `id`, `kind` (DB/FILES), `location`, `size_bytes`, `checksum`, `started_at`, `finished_at`, `status` |

## Key relationships (text ERD)

```
users 1───∗ user_roles ∗───1 roles
users 1───∗ user_sessions
users 1───∗ devices
users 1───1 student_profiles  ∗───1 classes
                              ∗───1 streams ∗───1 classes
users 1───1 staff_profiles
users 1───1 parent_profiles  ∗───1 users (child)

classes 1──∗ streams 1──∗ student_enrolments ∗──1 users (student)
classes 1──∗ teacher_assignments ∗──1 users (teacher)
classes 1──∗ teacher_assignments ∗──1 subjects

groups 1──1 conversations 1──∗ messages ∗──1 users (sender)
messages 1──∗ message_attachments
messages 1──∗ message_reactions
messages 1──∗ message_delivery_status
conversations 1──∗ conversation_participants ∗──1 users

users 1──∗ announcements
announcements 1──∗ announcement_acknowledgements ∗──1 users

users 1──∗ reports (reporter)
users 1──∗ reports (reported)
reports 1──∗ moderation_actions ∗──1 users (moderator)
users 1──∗ moderation_access_log (append-only)
```

## Indexes (key ones)

- `users(email)` unique; `users(phone)` unique partial (where not null).
- `student_profiles(admission_no)` unique; `staff_profiles(staff_no)` unique.
- `messages(conversation_id, created_at)` composite — drives the chat history query.
- `messages(client_message_id, conversation_id)` unique — drives idempotent send.
- `conversation_participants(user_id, last_read_at)` — drives the "unread count" badge.
- `reports(status, created_at)` — drives the moderation queue.
- `audit_logs(actor_user_id, at)` and `audit_logs(target_type, target_id)` — two query patterns.
- `announcements(published_at desc)` partial where `deleted_at is null`.
- `messages`全文索引 on `body` (Postgres `tsvector`) — gated behind `search_messages` permission at the service layer so it never returns rows the user cannot see.

## Migrations

- Managed by Prisma. Each migration is a reviewed PR.
- Migrations are forward-only in production; destructive changes require a paired data-backfill script.
- Migration history lives in `database/migrations/`.

## Seed data

`database/seeds/seed.ts` populates:

- 1 ICT Administrator, 1 School Administrator, 1 Headteacher.
- 2 Teachers (Maths, English).
- 1 Class (S1) with 2 streams (East, West).
- 4 synthetic students (2 per stream) with admission numbers `S1E-0001`…`S1W-0002`.
- 1 Parent linked to the first student.

**No real student data is ever used.** This is enforced by a CI check that fails if a seed file imports any CSV that does not match the synthetic naming pattern.
