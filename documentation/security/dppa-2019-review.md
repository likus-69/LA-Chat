# Uganda Data Protection and Privacy Act 2019 — Compliance Review

**Document owner:** LA Chat project — ICT Administrator role
**Reviewer (sign-off required):** School Data Protection Officer (DPO) — *to be designated*
**Last updated:** Phase 6, Security & Moderation
**Status:** Draft for DPO review

---

## Purpose

This document maps the LA Chat system against the requirements of the **Data Protection and Privacy Act, 2019** of Uganda (Act No. 9 of 2019, in force since 25 February 2019) and its accompanying regulations. The Act applies to LA Chat because the school, located in Uganda, processes personal data of students, staff, and parents — including children's data, which attracts enhanced protection under Part V of the Act.

The goal of this review is to:

1. Identify the personal data categories LA Chat processes.
2. Verify that processing is lawful, fair, and limited to the school's stated educational purpose.
3. Confirm that data subjects can exercise their rights.
4. Confirm that retention, security, and breach-notification obligations are met.
5. Identify open items requiring school management / DPO sign-off.

---

## 1. Personal data inventory

LA Chat processes the following categories of personal data:

| Data category | Examples | Sensitivity | Source |
|---|---|---|---|
| Identity | Full name, admission/staff number, role (student/teacher/etc.) | Standard | Provided by the data subject at registration, verified by School Administrator |
| Contact | Email, phone | Standard | Provided by data subject |
| Authentication | Password hash (argon2id), JWT refresh-token hash (SHA-256) | High | System-generated |
| Biometric | *None* — LA Chat does **not** collect biometric data | n/a | n/a |
| Academic | Class, stream, subjects, teacher assignments | Standard | School records |
| Relationship | Parent ↔ child links | Standard | School records |
| Communications | Message bodies, attachments, voice notes | High — may contain health, religious, or other sensitive personal data | Created by users |
| Usage metadata | Login timestamps, IP addresses, user agents | Standard | System-generated |
| Moderation records | Reports, moderation actions, access logs | High — names of accused parties | System-generated |

**Special-category data under §5 of the Act:** LA Chat is **not designed** to collect special-category data (health, religion, race, political opinion, biometric, sex life). However, **users may voluntarily include** such data in messages or attachments. This is mitigated by:

- Conversation policy engine restricting who can message whom.
- Moderation queue for review of harmful content.
- End-to-end school-server storage (no third-party message processors).

---

## 2. Lawful basis and purpose limitation

**Lawful basis (§7 of the Act):** Processing is necessary for the school's legitimate function of providing education and safeguarding students. For children's data (Part V), parental consent is obtained at enrolment.

**Purpose limitation — what each data category is used for:**

| Data category | Permitted purpose | Prohibited use |
|---|---|---|
| Identity | Account creation, roster display, moderation | Marketing, profiling |
| Contact | Account recovery, in-app notifications | Sharing with third parties |
| Authentication | Login only | Never logged in plaintext |
| Academic | Class/stream membership, group auto-joining | Selling or transferring to other schools |
| Communications | Real-time school communications | Public disclosure outside the school |
| Usage metadata | Security auditing, abuse prevention | Commercial analytics |
| Moderation records | Investigating and acting on reports | Retaliation or public disclosure |

**Open item:** The school must publish a privacy notice (§7(1)(c)) visible at login. *Draft text in `documentation/security/privacy-notice.md` — pending.*

---

## 3. Data minimisation

LA Chat collects only data needed for its stated purpose. Verified per phase:

- ✅ Registration form asks for full name, identifier, contact, role, class/stream — **no** marital status, nationality, religion, or other extraneous fields.
- ✅ No tracking pixels, no third-party analytics SDKs in the web or (future) mobile apps.
- ✅ Audit log stores IP and user-agent — used only for security investigations.
- ⚠️ Message attachments can be up to 100 MB. The school should periodically review orphaned assets and purge them.

---

## 4. Data subject rights

The Act grants the following rights (Part III). LA Chat's support status:

| Right | Section | LA Chat support | Notes |
|---|---|---|---|
| **Access** — right to know what data is held | §8 | ✅ `/users/me` returns the data subject's own profile. The DPO can serve full exports via direct DB query. | A self-service "export my data" endpoint is a Phase 8 backlog item. |
| **Rectification** — right to correct inaccurate data | §9 | 🟡 `PATCH /users/me` is currently a stub. Full implementation pending Phase 2 follow-up. | In the interim, the School Administrator can edit records via the users API. |
| **Erasure / deletion** | §10 | 🟡 Soft-delete (`deletedAt`) is implemented for users and messages. **Hard-delete after the retention period is not yet scheduled.** | See §5 below. |
| **Object to processing** | §18 | ✅ Users can mute conversations, turn off push notifications, and close their account (request to DPO). | |
| **Restrict processing** | §19 | ✅ Suspending an account (`User.status = SUSPENDED`) halts all further processing except retention. | |
| **Data portability** | §20 | 🟡 Not directly supported. The schema is structured and a SQL export script can be written on request. | |

**Open item:** Implement a self-service data-export endpoint (CSV + JSON) before declaring full compliance.

---

## 5. Data retention

The school's records policy governs retention. LA Chat provides the technical hooks; the periods below are defaults pending DPO confirmation.

| Data type | Default retention | Action at end of period |
|---|---|---|
| Active student records | 7 years after leaving the school | Hard-delete personal data; retain anonymised academic summary |
| Staff records | 7 years after departure | Hard-delete personal data |
| Messages (text, voice, attachments) | 1 year after the conversation becomes inactive | Soft-delete; hard-delete after the additional 6-month grace period |
| Audit logs | 5 years | Archive then hard-delete |
| Moderation access logs | 5 years | Archive then hard-delete |
| Backup snapshots | 30 days rolling | Automatic rotation in `backup.sh` |
| Account registration data (rejected accounts) | 90 days | Hard-delete |

**Implementation status:**

- ✅ `deletedAt` columns exist on `users`, `messages`, `announcements`.
- ⚠️ Scheduled hard-delete job (`pnpm -w purge:retention`) — **not yet implemented**. Tracked as Phase 8.
- ⚠️ Backup rotation script exists but needs real MinIO config (see `infrastructure/school-server/scripts/backup.sh`).

**Open item:** DPO to confirm retention periods against the school's records policy.

---

## 6. Security measures

**Encryption:**

- ✅ Passwords hashed with **argon2id** (memory-hard, salted).
- ✅ Refresh tokens stored hashed with **SHA-256**.
- ✅ TLS 1.3 enforced at the Caddy reverse proxy (`infrastructure/school-server/Caddyfile`) with HSTS.
- ✅ Media assets served via **time-limited signed URLs** (5-minute TTL).
- ⚠️ Database at rest is **not** encrypted by the application layer. The school server relies on full-disk encryption (LUKS) at the OS level — to be confirmed by the ICT Administrator during deployment.

**Access control:**

- ✅ Role-based access control with 9 roles and 38 permission codes.
- ✅ `PermissionsGuard` enforces permission checks on every protected route.
- ✅ Conversation policy engine enforces who may message whom (no unmonitored student-to-student private chat by default).
- ✅ Moderation access to private message content requires `MODERATION_ACCESS_PRIVATE` permission and is recorded in the append-only `moderation_access_log`.

**Audit:**

- ✅ Every administrative action writes to the `audit_logs` table (actor, action, target, IP, user-agent, timestamp).
- ✅ `/admin/audit` endpoint exposes the log to the ICT Administrator with filtering by actor, action, and target type.

**Operational:**

- ✅ Rate limiting on auth endpoints (`@Throttle`, 10/min/IP).
- ✅ Refresh-token rotation on use; old tokens revoked.
- ✅ Account suspension revokes all active sessions.

**Open items:**

- ⚠️ MFA for privileged accounts (schema column exists; enforcement pending Phase 2 follow-up).
- ⚠️ Throttle guard is in-memory per process — acceptable for the single-server deployment model; revisit if the deployment scales horizontally.

---

## 7. Breach notification

**Legal obligation (§7 of the Act and §9 of the regulations):** Personal-data breaches must be notified to the Personal Data Protection Office **within 72 hours** of detection, and to affected data subjects "without undue delay" where the breach is likely to result in a high risk to their rights.

**Detection:**

- Application errors are logged to stdout (collected by Docker logs / journald on the school server).
- Anomalous patterns (e.g. mass login failures, spike in `report.create` audit entries) are surfaced via the dashboard's "recent activity" widget.

**Runbook** (drafted in `documentation/deployment/hybrid-hosting.md` §10):

1. **Contain** — ICT Administrator isolates the affected service (e.g. `docker compose stop api`).
2. **Assess** — within 4 hours, determine scope: which records, how many users, what categories.
3. **Notify DPO** — within 24 hours, regardless of severity.
4. **Notify regulator** — DPO files the 72-hour notification to the Uganda Personal Data Protection Office.
5. **Notify data subjects** — DPO drafts a notice; Headteacher approves; ICT Administrator pushes it as a CRITICAL announcement via LA Chat itself.
6. **Post-incident review** — within 30 days, written report filed in `documentation/security/incidents/`.

**Open items:**

- ⚠️ No automated alerting (e.g. SMS to DPO on threshold breach). Manual monitoring only.
- ⚠️ Incident report template — to be drafted.

---

## 8. Data transfer outside Uganda

The school's primary deployment is **on-premises** (school server, see `hybrid-hosting.md`). No personal data leaves Uganda during normal operation.

**Cloud backup scenario:** If the school elects to mirror encrypted backups to a cloud bucket (e.g. AWS S3, Backblaze B2), this constitutes a transfer outside Uganda. Conditions that must be met:

1. ✅ Backups must be **encrypted at rest** before upload (server-side LUKS or application-level `gpg --symmetric`).
2. ✅ The cloud provider must offer a region in a country with an adequate data-protection regime, or sign standard contractual clauses.
3. ✅ The DPO must record the transfer in the school's data-processing register.
4. ✅ Data subjects must be informed in the privacy notice.

**Open items:**

- ⚠️ Cloud backup target is **not yet configured**. If and when enabled, this section must be revisited.
- ⚠ DPO to confirm whether the chosen provider's region meets the "adequate protection" test.

---

## 9. Children's data (Part V)

Students under 18 are children under the Act. LA Chat's safeguards:

- ✅ Parental consent is captured at enrolment (separate from LA Chat; school records).
- ✅ Students cannot create private 1-to-1 conversations with other students by default (conversation policy).
- ✅ Teacher → Student contact requires an active teacher-assignment record — students cannot be contacted by arbitrary staff.
- ✅ Headteacher has oversight of all moderation actions.
- ✅ No advertising, profiling, or behavioural tracking anywhere in the system.

**Open item:** Privacy notice must explicitly address children's data (separate child-friendly version pending).

---

## 10. Open items requiring DPO sign-off

The following items are **not yet closed** and require the school's DPO to review and approve:

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Appoint a DPO for the school | Headteacher | Pending |
| 2 | Publish the privacy notice at login | ICT Administrator | Draft pending |
| 3 | Confirm retention periods against the school records policy | DPO + Headteacher | Pending |
| 4 | Implement self-service data-export endpoint | ICT Administrator | Backlog (Phase 8) |
| 5 | Implement `PATCH /users/me` for self-service rectification | ICT Administrator | Backlog (Phase 2 follow-up) |
| 6 | Implement scheduled hard-delete (`purge:retention`) | ICT Administrator | Backlog (Phase 8) |
| 7 | Confirm cloud-backup region adequacy (if enabled) | DPO | Pending |
| 8 | Approve breach-notification runbook | DPO | Pending |
| 9 | Approve incident-report template | DPO | Pending |
| 10 | Confirm MFA rollout timeline for privileged accounts | DPO + ICT Administrator | Pending |
| 11 | Child-friendly privacy notice | DPO | Pending |
| 12 | Data Processing Register (article 30-style record of processing) | DPO | Pending |

**Sign-off:**

```
School DPO: ____________________   Date: ____________
Headteacher: ___________________   Date: ____________
ICT Administrator: _____________   Date: ____________
```

Until items 1, 2, 8, 11 are signed off, LA Chat must **not** be declared production-ready.
