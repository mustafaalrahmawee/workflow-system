# USER_STORIES – Application & Workflow System (CTI)

This document defines user stories aligned with the current **MINIWORLD.md** specification
(MVP scope). It is written in a Jira/Trello-friendly format and reflects the current REST API,
workflow rules, and role policies.

---

## EPIC A – Authentication & Authorization (MVP)

### US-A1 – Register Applicant Account

**As an** applicant  
**I want** to register an account  
**so that** I can create and submit applications.

**Acceptance Criteria**

- Endpoint: `POST /auth/register`
- Only **APPLICANT** self-registration is supported.
- Newly registered applicants are marked as verified in MVP:
  - `isEmailVerified = true` (or `emailVerifiedAt = NOW()`)
- The user’s role is set to `APPLICANT` (cannot self-select REVIEWER/ADMIN).
- Duplicate email returns **409 Conflict**.

---

### US-A2 – Login

**As a** registered user  
**I want** to log in  
**so that** I can access the system based on my role.

**Acceptance Criteria**

- Endpoint: `POST /auth/login`
- Valid credentials return an access token (and refresh token if implemented).
- Invalid credentials return **401 Unauthorized**.
- Token payload includes at minimum: `userId`, `role` (email optional).

---

### US-A3 – Refresh Session

**As a** logged-in user  
**I want** to refresh my access token  
**so that** I can stay logged in without re-authentication.

**Acceptance Criteria**

- Endpoint: `POST /auth/refresh`
- Valid refresh token returns a new access token.
- Invalid/expired refresh token returns **401 Unauthorized**.

---

### US-A4 – Update My Profile (User)

**As a** user  
**I want** to update my profile information  
**so that** my account data stays correct.

**Acceptance Criteria**

- Endpoint: `PATCH /users/me`
- Allowed fields (MVP): `email` (optional), `password` (optional)
- Changing email must keep it unique (409 on conflict).
- If email changes:
  - MVP: `isEmailVerified` remains true (simplified)
  - Planned extension: `isEmailVerified` becomes false and verification is required again
- Response returns updated user data (excluding password hash).

---

### US-A5 – Admin Updates a User (Admin)

**As an** admin  
**I want** to update a user's role or activation state  
**so that** I can manage access for reviewers and applicants.

**Acceptance Criteria**

- Endpoint: `PATCH /users/{id}`
- Only ADMIN can access (403 otherwise).
- Allowed fields (MVP):
  - `role` (APPLICANT/REVIEWER/ADMIN)
  - `isActive` (optional but recommended)
  - `isEmailVerified` (optional; typically true for managed accounts)
- Role changes are audited (optional, recommended).
- Attempting to update a soft-deleted user returns 404 or 410 (policy choice).

---

### US-A6 – Admin Soft Deletes a User (Admin)

**As an** admin  
**I want** to soft delete a user  
**so that** the account is disabled without losing audit/history.

**Acceptance Criteria**

- Endpoint: `DELETE /users/{id}` (soft delete)
- Only ADMIN can access (403 otherwise).
- Implementation sets `deleted_at = NOW()` (no hard delete).
- Soft-deleted users:
  - cannot log in (401/403 depending on policy)
  - do not appear in normal user lists
- The action is auditable (optional, recommended).

---

### US-A7 – User List (Admin) (optional MVP)

**As an** admin  
**I want** to list users (reviewers/applicants)  
**so that** I can manage accounts.

**Acceptance Criteria**

- Endpoint: `GET /users`
- Only ADMIN can access.
- Default excludes soft-deleted users.
- Supports filters:
  - role
  - active/inactive
  - includeDeleted=true (optional)
- Pagination supported.

### US-A8 – Managed Accounts for Reviewer/Admin (Policy)

**As the** system owner  
**I want** reviewer and admin accounts to be managed by admins/seed  
**so that** privileged access cannot be obtained via self-registration.

**Acceptance Criteria**

- REVIEWER accounts are created by Admin (no public registration flow).
- ADMIN accounts are created manually or via seed.
- Applicants cannot elevate their own role via API.

---

## EPIC B – Applications (Applicant Features)

### US-B1 – Create Draft Application

**As an** applicant  
**I want** to create a new draft application  
**so that** I can fill it out before submission.

**Acceptance Criteria**

- Endpoint: `POST /applications`
- Only `APPLICANT` can create a draft (403 otherwise).
- Newly created application has `status = DRAFT`.
- The application is owned by the current applicant (`applicant_id = currentUser.id`).

---

### US-B2 – Update Draft (Supertype Fields)

**As an** applicant  
**I want** to update the general fields of my draft  
**so that** I can prepare it for submission.

**Acceptance Criteria**

- Endpoint: `PATCH /applications/{id}`
- Allowed only when:
  - current user is the owner
  - application `status = DRAFT`
- Attempts to edit non-owned applications return 403.
- Attempts to edit non-editable statuses return 409 (or 400).

---

### US-B3 – Update Draft (Subtype Fields via CTI)

**As an** applicant  
**I want** to update type-specific fields of my draft  
**so that** I can provide required information.

**Acceptance Criteria**

- Endpoint: `PATCH /applications/{id}/type-data`
- Allowed only when:
  - current user is the owner
  - application `status = DRAFT`
- Payload must match `application.type` (type guard).
- Disjointness is enforced: at most one subtype exists per application.
- Changes are atomic (transaction).

---

### US-B4 – Submit Application (Total-at-submit)

**As an** applicant  
**I want** to submit my application  
**so that** it enters the review process.

**Acceptance Criteria**

- Endpoint: `POST /applications/{id}/submit`
- Allowed transitions:
  - `DRAFT → SUBMITTED`
  - `NEEDS_INFO → SUBMITTED`
- On submit:
  - `status = SUBMITTED`
  - `submitted_at` is set (if not already)
- Submission requires **total-at-submit**:
  - `type` must be set
  - exactly one matching subtype must exist (CTI)
  - required subtype fields must be present and valid (e.g., date range checks)
- Violations return **400 Bad Request** (validation).
- Only the owner can submit (403 otherwise).

---

### US-B5 – Cancel Own Application

**As an** applicant  
**I want** to cancel my application  
**so that** it is no longer processed.

**Acceptance Criteria**

- Endpoint: `POST /applications/{id}/cancel`
- Allowed transitions:
  - `DRAFT → CANCELLED`
  - `SUBMITTED → CANCELLED` only if review has not started yet
- Cannot cancel terminal states (409).
- Only the owner can cancel (403 otherwise).
- Cancellation creates an audit entry (STATUS_CHANGE).

---

### US-B6 – List My Applications

**As an** applicant  
**I want** to list my applications  
**so that** I can track their status.

**Acceptance Criteria**

- Endpoint: `GET /applications?mine=true`
- Returns only applications owned by the current applicant.
- Default excludes soft-deleted rows (`deleted_at IS NULL`).
- Supports pagination and sorting (default: last updated).

---

### US-B7 – View Application Details (Applicant Scope)

**As an** applicant  
**I want** to view my application details  
**so that** I can see subtype data and audit history.

**Acceptance Criteria**

- Endpoint: `GET /applications/{id}`
- Applicant can only view own applications (403 otherwise).
- Response includes:
  - application (supertype)
  - subtype data (parking/event)
  - audit trail entries (chronological)

---

## EPIC C – Applications (Reviewer Features)

### US-C1 – Reviewer Inbox

**As a** reviewer  
**I want** an inbox of applications  
**so that** I can efficiently process pending work.

**Acceptance Criteria**

- Endpoint: `GET /applications/inbox`
- Only REVIEWER/ADMIN can access (APPLICANT gets 403).
- Supports filters:
  - status (SUBMITTED, IN_REVIEW, NEEDS_INFO)
  - assignment (unassigned / assigned-to-me)
  - application type
  - date range
- Default sort: `submitted_at DESC`
- Pagination is supported (prefer cursor-based pagination).

---

### US-C2 – Assign Application to Self (No Status Change)

**As a** reviewer  
**I want** to assign an application to myself  
**so that** it is clear I am responsible for it.

**Acceptance Criteria**

- Endpoint: `POST /applications/{id}/assign`
- Assign updates `assigned_to_id := reviewerId` and writes an audit entry (ASSIGNMENT_CHANGE).
- Assign does **not** change application status.
- Cannot assign terminal states (409).
- Concurrency rule:
  - if another reviewer assigns first, the action returns **409 Conflict**.

---

### US-C3 – Start Review (Auto-assign if Unassigned)

**As a** reviewer  
**I want** to start reviewing a submitted application  
**so that** I can process it.

**Acceptance Criteria**

- Per MVP policy, a reviewer can transition `SUBMITTED → IN_REVIEW` only if:
  1. `assigned_to_id == reviewerId`, OR
  2. `status == SUBMITTED` AND `assigned_to_id IS NULL` (Start Review auto-assigns)
- Endpoint: `POST /applications/{id}/status` with `{ status: "IN_REVIEW" }`
- When condition (2) applies, the system **atomically** sets `assigned_to_id := reviewerId`.
- If another reviewer claims first, return **409 Conflict**.
- Writes audit entry (STATUS_CHANGE).

---

### US-C4 – Request Additional Information (Comment Required)

**As a** reviewer  
**I want** to request additional information  
**so that** the applicant can clarify missing data.

**Acceptance Criteria**

- Transition: `IN_REVIEW → NEEDS_INFO`
- Endpoint: `POST /applications/{id}/status`
- Comment is **mandatory** (validation error 400 if missing/empty).
- Only allowed if reviewer is assigned to the application (or per policy).
- Writes audit entry (STATUS_CHANGE with comment).

---

### US-C5 – Approve Application (Comment Optional)

**As a** reviewer  
**I want** to approve an application  
**so that** it is finalized as accepted.

**Acceptance Criteria**

- Transition: `IN_REVIEW → APPROVED`
- Endpoint: `POST /applications/{id}/status`
- Comment is optional (recommended).
- Only allowed if reviewer is assigned to the application (policy).
- Writes audit entry (STATUS_CHANGE).
- Approved applications become read-only (terminal).

---

### US-C6 – Reject Application (Comment Optional)

**As a** reviewer  
**I want** to reject an application  
**so that** it is finalized as denied.

**Acceptance Criteria**

- Transition: `IN_REVIEW → REJECTED`
- Endpoint: `POST /applications/{id}/status`
- Comment is optional (recommended).
- Only allowed if reviewer is assigned to the application (policy).
- Writes audit entry (STATUS_CHANGE).
- Rejected applications become read-only (terminal).

---

### US-C7 – View Application Details (Reviewer Scope)

**As a** reviewer  
**I want** to view application details including subtype data and audit trail  
**so that** I can make a correct decision.

**Acceptance Criteria**

- Endpoint: `GET /applications/{id}`
- Only REVIEWER/ADMIN.
- Response includes supertype + subtype + audit trail.
- Default excludes soft-deleted applications (404/410 based on policy).

---

## EPIC D – Admin Features (MVP + Optional)

### US-D1 – View All Applications

**As an** admin  
**I want** to view all applications  
**so that** I can provide oversight and support.

**Acceptance Criteria**

- Admin can access all application detail endpoints without ownership restriction.
- Admin can access reviewer inbox endpoint.

---

### US-D2 – Reassign to Another Reviewer

**As an** admin  
**I want** to reassign an application to another reviewer  
**so that** workload can be balanced.

**Acceptance Criteria**

- Endpoint: `POST /applications/{id}/reassign`
- Only ADMIN.
- Target reviewer must exist and have role REVIEWER.
- Writes audit entry (ASSIGNMENT_CHANGE with previous/new assignee).
- Cannot reassign terminal states (409).

---

### US-D3 – Admin Cancel Application (Support Case, Optional MVP)

**As an** admin  
**I want** to cancel an application  
**so that** I can resolve support cases.

**Acceptance Criteria**

- Endpoint: `POST /applications/{id}/cancel`
- Only ADMIN (and owner applicant) can cancel.
- Only allowed **before final decision** (not terminal).
- Writes audit entry (STATUS_CHANGE with actor role ADMIN).

---

### US-D4 – Reporting: Applications by Status

**As an** admin  
**I want** a report of applications grouped by status  
**so that** I can understand backlog and throughput.

**Acceptance Criteria**

- Endpoint: `GET /reports/applications-by-status`
- Read-only and ADMIN-only.
- Returns counts grouped by status (optionally by type).

---

### US-D5 – Reporting: Processing Time

**As an** admin  
**I want** a processing time report  
**so that** I can monitor workflow performance.

**Acceptance Criteria**

- Endpoint: `GET /reports/processing-time`
- Read-only and ADMIN-only.
- Uses timestamps/audit trail to compute average or distribution of processing times.

---

## EPIC E – Audit & Traceability (MVP)

### US-E1 – Audit Log on Status Changes

**As the** system  
**I want** to record every status transition  
**so that** actions are traceable.

**Acceptance Criteria**

- Every status change writes an audit entry with:
  - actor user id, timestamp
  - from/to status
  - optional comment
- Audit log is append-only.

---

### US-E2 – Audit Log on Assignment Changes

**As the** system  
**I want** to record reviewer assignment changes  
**so that** responsibility is traceable.

**Acceptance Criteria**

- Assign and reassign actions write an audit entry:
  - previous assignee, new assignee
  - actor user id, timestamp

---

### US-E3 – View Audit Trail in Details Response

**As an** authorized user  
**I want** to see the audit trail in the application details  
**so that** I can understand what happened.

**Acceptance Criteria**

- Included in `GET /applications/{id}` response.
- Sorted chronologically.
- Applicants only see audits for their own applications.

---

## EPIC F – Consistency, Concurrency & Errors (MVP)

### US-F1 – Transactional Multi-table Writes

**As the** system  
**I want** multi-table writes to be atomic  
**so that** invariants cannot be broken by partial updates.

**Acceptance Criteria**

- Operations that touch multiple tables run in `prisma.$transaction`, e.g.:
  - create application + subtype
  - change type + delete other subtype + upsert correct subtype
  - status change + audit entry
  - assign/reassign + audit entry

---

### US-F2 – Disjointness & Type Guard (CTI)

**As the** system  
**I want** CTI invariants enforced  
**so that** applications remain consistent.

**Acceptance Criteria**

- Disjointness: at most one subtype row exists per application.
- Type guard: subtype payload must match `application.type`.
- Violations return 400 (validation) or 409 (conflict) based on context.

---

### US-F3 – Concurrency Safety for Claim/Assign

**As the** system  
**I want** claim/assign operations to be race-safe  
**so that** two reviewers cannot claim the same application.

**Acceptance Criteria**

- Assign/start-review updates are performed atomically.
- If another reviewer claims first, return **409 Conflict**.

---

## Role Permissions Summary (MVP)

| Action                | APPLICANT | REVIEWER | ADMIN |
| --------------------- | --------- | -------- | ----- |
| Register              | ✓         | ✗        | ✗     |
| Login / Refresh       | ✓         | ✓        | ✓     |
| Create draft          | ✓         | ✗        | ✗     |
| Edit own draft        | ✓         | ✗        | ✗     |
| Submit                | ✓         | ✗        | ✗     |
| Cancel own            | ✓         | ✗        | ✓     |
| View own applications | ✓         | ✗        | ✓     |
| View inbox            | ✗         | ✓        | ✓     |
| Assign to self        | ✗         | ✓        | ✓     |
| Change status         | ✗         | ✓        | ✓     |
| Reassign              | ✗         | ✗        | ✓     |
| Reports               | ✗         | ✗        | ✓     |
