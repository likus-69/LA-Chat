# LA Chat — Permissions Matrix

This document defines, for every role, **what they can do, what they cannot do, and what they may do only with delegated authority**. It is the authoritative source for the `@Roles()` and `@Permissions()` guards in the backend.

## Roles

Light Academy Secondary School uses 10 roles. A user may hold more than one (e.g. a teacher who is also a Class Teacher for S1 East).

| # | Role | Who typically holds it |
|---|---|---|
| 1 | `STUDENT` | Every enrolled student |
| 2 | `TEACHER` | Subject teachers |
| 3 | `CLASS_TEACHER` | The class teacher of a specific stream |
| 4 | `HEADTEACHER` | The headteacher of the school |
| 5 | `DEPUTY_HEADTEACHER` | The deputy headteacher |
| 6 | `SCHOOL_ADMINISTRATOR` | The school office (bursar/secretariat) |
| 7 | `ICT_ADMINISTRATOR` | The ICT team |
| 8 | `SCHOOL_SECRETARY` | The school secretary |
| 9 | `PARENT_GUARDIAN` | A parent or guardian of a student |

> `ICT_ADMINISTRATOR` is a **technical** role: it owns the *system*. `SCHOOL_ADMINISTRATOR` is a **people** role: it owns *accounts and academic structure*. They are deliberately separate so that neither can do the other's job without an explicit second role grant.

## Permission catalogue

Permissions are dotted strings: `<domain>.<action>.<scope?>`.

| Code | Meaning |
|---|---|
| `user.create` | Create a user account (always requires admin approval) |
| `user.read.self` | Read own profile |
| `user.read.students` | Read student profiles in scope |
| `user.read.staff` | Read staff profiles |
| `user.update.self` | Edit own profile (name, avatar, password) |
| `user.update.others` | Edit another user's profile |
| `user.suspend` | Suspend an account |
| `user.restore` | Restore a suspended account |
| `user.reset_password` | Trigger a password reset for another user |
| `user.import_csv` | Bulk import via CSV |
| `user.export_csv` | Export user records |
| `class.manage` | Create / rename / delete classes and streams |
| `subject.manage` | Create / rename subjects, assign teachers |
| `enrolment.manage` | Assign students to streams |
| `conversation.create.private` | Start a private conversation (within policy) |
| `conversation.create.group` | Create a group conversation |
| `conversation.manage.group` | Rename / set description / upload picture |
| `conversation.add_members` | Add members to a group |
| `conversation.remove_members` | Remove members from a group |
| `conversation.pin_message` | Pin a message in a group |
| `message.send` | Send a message in an authorised conversation |
| `message.edit.self` | Edit own message |
| `message.delete.self` | Delete own message |
| `message.delete.others` | Delete another's message (moderation) |
| `message.search` | Search across visible messages |
| `announcement.publish.class` | Publish to a class |
| `announcement.publish.stream` | Publish to a stream |
| `announcement.publish.staff` | Publish to staff |
| `announcement.publish.school` | School-wide announcement |
| `announcement.publish.admin` | Administrative notice |
| `announcement.delete` | Delete an announcement |
| `report.create` | Submit a report |
| `report.review` | Open and act on reports |
| `moderation.access_private` | Open a private message (always logged) |
| `system.settings` | Change system settings |
| `system.audit.read` | Read audit logs |
| `system.backup.manage` | Trigger / restore backups |
| `system.db.maintain` | Run DB maintenance |
| `system.deploy` | Deploy or update the system |

## Role × permission matrix

Legend: ✓ = granted · ✗ = denied · D = delegated only (requires explicit grant by Headteacher)

| Permission | Student | Teacher | Class T. | Head | Deputy | Sch. Admin | ICT Admin | Secretary | Parent |
|---|---|---|---|---|---|---|---|---|---|
| `user.create` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `user.read.self` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.read.students` | ✗ | ✓ (own) | ✓ (own class) | ✓ | D | ✓ | ✗ | ✗ | ✗ |
| `user.read.staff` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `user.update.self` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.update.others` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `user.suspend` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `user.restore` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `user.reset_password` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `user.import_csv` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| `user.export_csv` | ✗ | ✗ | ✗ | ✓ | D | ✓ | ✗ | ✗ | ✗ |
| `class.manage` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `subject.manage` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `enrolment.manage` | ✗ | ✗ | ✗ | D | D | ✓ | ✗ | ✗ | ✗ |
| `conversation.create.private` | ✓ (policy) | ✓ (policy) | ✓ (policy) | ✓ | ✓ (delegated) | ✗ | ✗ | ✓ (admin groups) | ✓ (child's teachers) |
| `conversation.create.group` | ✗ | ✓ (subject/class) | ✓ (class) | ✓ | D | ✓ | ✗ | ✓ (admin) | ✗ |
| `conversation.manage.group` | ✗ | ✓ (own) | ✓ (own) | ✓ | D | ✓ | ✗ | ✓ (admin) | ✗ |
| `conversation.add_members` | ✗ | ✓ (own) | ✓ (own) | ✓ | D | ✓ | ✗ | ✓ (admin) | ✗ |
| `conversation.remove_members` | ✗ | ✓ (own) | ✓ (own) | ✓ | D | ✓ | ✗ | ✓ (admin) | ✗ |
| `conversation.pin_message` | ✗ | ✓ (own) | ✓ (own) | ✓ | D | ✓ | ✗ | ✓ (admin) | ✗ |
| `message.send` | ✓ (auth) | ✓ (auth) | ✓ (auth) | ✓ | ✓ | ✗ | ✗ | ✓ (admin) | ✓ (auth) |
| `message.edit.self` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| `message.delete.self` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| `message.delete.others` | ✗ | ✗ | ✗ | D | D | D | ✗ | ✗ | ✗ |
| `message.search` | ✓ (visible) | ✓ (visible) | ✓ (visible) | ✓ | ✓ | ✗ | ✗ | ✓ (visible) | ✓ (visible) |
| `announcement.publish.class` | ✗ | ✓ (own) | ✓ (own) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `announcement.publish.stream` | ✗ | ✓ (own) | ✓ (own) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `announcement.publish.staff` | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `announcement.publish.school` | ✗ | ✗ | ✗ | ✓ | D | ✗ | ✗ | ✗ | ✗ |
| `announcement.publish.admin` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| `announcement.delete` | ✗ | ✓ (own) | ✓ (own) | ✓ | D | ✓ | ✗ | ✓ (own) | ✗ |
| `report.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report.review` | ✗ | ✗ | ✗ | D | D | D | ✗ | ✗ | ✗ |
| `moderation.access_private` | ✗ | ✗ | ✗ | D | D | D | ✗ | ✗ | ✗ |
| `system.settings` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `system.audit.read` | ✗ | ✗ | ✗ | D | ✗ | ✗ | ✓ | ✗ | ✗ |
| `system.backup.manage` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `system.db.maintain` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| `system.deploy` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |

## Policy rules (enforced in service layer, not just guards)

The matrix says *who*; these rules say *when*.

1. **Student-to-student private chat is off by default.** A school administrator may enable it per-class. The default is "students can only message teachers and their class group".
2. **Teacher → student private chat requires an active `teacher_assignments` row** for that teacher in the student's class or subject. A teacher cannot DM a random student.
3. **Parent → teacher chat is allowed only for the parent's own child's teachers.** The link is via `parent_profiles.child_user_id → student_enrolments → teacher_assignments`.
4. **Group creation by a teacher** auto-creates the group from the academic structure (subject + class); the teacher cannot add arbitrary students outside that class.
5. **`moderation.access_private`** is the only permission that lets a person read a private message they did not send or receive. Every invocation **writes a `moderation_access_log` row with a reason string**. The log is append-only and visible to the Headteacher and ICT Administrator.
6. **Headteacher delegation** is explicit: the Headteacher grants a `delegated` permission to the Deputy via the dashboard; the grant itself is logged in `audit_logs`.
7. **No role gets `message.delete.others` by default.** It must be granted explicitly per-moderator by the Headteacher.

## Implementation notes

- The `@Permissions('user.suspend')` decorator + `PermissionsGuard` reads the user's effective permission set (union of all `role_permissions` for the user's current `user_roles`) and rejects with 403 if missing.
- "In scope" qualifiers (e.g. *own class*, *own subject*) are enforced inside the service, not the guard, because they need row-level checks against `teacher_assignments` / `student_enrolments`.
- Every permission check that succeeds writes nothing; every permission check that **fails** writes an `audit_log` row with `action='permission.denied'`.
