# MINIWORLD – Application & Workflow System (Enterprise / Gov Style)

## 1. Purpose & Scope

This system models a **generic application and approval workflow** commonly found in:

- Government services (permits, licenses, approvals)
- ERP systems (internal requests, compliance approvals)
- Enterprise back-office platforms

The system is designed with a strong focus on:

- data integrity
- explicit business rules
- auditability
- long-term maintainability

The backend is implemented using **NestJS + Prisma + PostgreSQL** and exposes a REST API
that can later be consumed by a frontend application (Angular).

---

## 2. Core Domain Concepts

### 2.1 Application (Aggregate Root)

An **Application** represents a request that must be reviewed and decided upon.

An application:

- is owned by exactly one applicant
- has exactly one application type
- follows a finite state machine (workflow)
- can be assigned to a reviewer
- is auditable and soft-deletable

The `Application` entity acts as the **aggregate root** for all write operations.

---

### 2.2 Application Types (Class Table Inheritance – CTI)

Applications differ by **type**, each type having its own domain-specific attributes.

Examples:

- Parking Permit Application
- Event Permit Application
- (Optional later) Construction Permit Application

Implementation:

- a shared `application` table (supertype)
- one subtype table per application type
- a strict 1:1 relationship between supertype and subtype

This design:

- avoids wide tables with many NULL values
- enables strict type-specific validation
- supports independent evolution of application types

---

## 3. Roles & Authorization Model

### 3.1 Applicant

A user who creates and submits applications.

Permissions:

- create applications (DRAFT)
- update own applications while editable
- submit applications
- respond to information requests
- view own applications and audit history
- cancel applications before final decision

Restrictions:

- cannot approve or reject
- cannot modify finalized applications

---

### 3.2 Reviewer (Clerk)

A user responsible for reviewing applications.

Permissions:

- view assigned and unassigned applications
- assign applications to self
- change application status during review
- request additional information
- approve or reject applications
- add internal comments

Restrictions:

- cannot modify application subtype data
- cannot edit applications after final decision

**✅ MVP Policy (Status Change Rules):**

A Reviewer can only change the status of an application if **one of the following** conditions is met:

1. **Assigned to them:** `assigned_to_id == reviewerId`
2. **Start Review action:** Application status is `SUBMITTED` and `assigned_to_id IS NULL`
   - The reviewer may transition `SUBMITTED → IN_REVIEW`
   - The system **atomically** assigns the application to that reviewer (`assigned_to_id := reviewerId`)
   - If another reviewer claims the application first, the action fails with **409 Conflict**

**Terminal states:**

- `APPROVED`, `REJECTED`, `CANCELLED` are terminal (no further status changes or assignment changes).

**Comment requirements:**

- `IN_REVIEW → NEEDS_INFO`: **mandatory** comment (explains what information is needed)
- `IN_REVIEW → APPROVED|REJECTED`: **optional** comment (recommended for audit trail)

---

### 3.3 Admin

A system-level role responsible for operational support and oversight.

Permissions:

- view all applications (no ownership restrictions)
- reassign applications to another reviewer
- access reporting endpoints (read-only)
- cancel an application (support case) **before** final decision (optional for MVP)

Restrictions:

- does not modify application subtype data (no form editing)
- does not change business decision outcomes by default (no approve/reject override in MVP)
- cannot modify terminal applications (`APPROVED`, `REJECTED`, `CANCELLED`) except read/reporting

Audit requirements:

- any reassignment or admin cancellation must create an audit log entry
  (e.g., `ASSIGNMENT_CHANGE`, `STATUS_CHANGE` with actor role ADMIN)

---

## 4. Application Lifecycle (Workflow)

### 4.1 Status Values

Applications move through the following states:

- `DRAFT`
- `SUBMITTED`
- `IN_REVIEW`
- `NEEDS_INFO`
- `APPROVED`
- `REJECTED`
- `CANCELLED`

---

### 4.2 Workflow Rules

```text
DRAFT ──submit──▶ SUBMITTED ──start_review──▶ IN_REVIEW ──approve──▶ APPROVED
  │                 │   │                      │   ├──reject──▶ REJECTED
  │                 │   └──assign (no status)  │   └──request_info──▶ NEEDS_INFO
  └──cancel──▶      └──cancel──▶               │                      │
CANCELLED (terminal)                            └────────resubmit──────┘
                                                (NEEDS_INFO → SUBMITTED)

```

#### Applicant-driven transitions

- `DRAFT → SUBMITTED`
- `NEEDS_INFO → SUBMITTED`
- `DRAFT → CANCELLED`
- `SUBMITTED → CANCELLED` (if not yet reviewed)

#### Reviewer-driven transitions

- `SUBMITTED → IN_REVIEW`
- `IN_REVIEW → NEEDS_INFO`
- `IN_REVIEW → APPROVED`
- `IN_REVIEW → REJECTED`

#### Final states

- `APPROVED`, `REJECTED`, `CANCELLED` are terminal states
- no further transitions are allowed

All transitions are validated in the **service layer**.

---

## 5. Application Creation & Editing Rules

### 5.1 Draft Phase

- an application can be created without subtype data
- subtype data may be added or updated while in `DRAFT`
- validation is lenient during draft

### 5.2 Submission Rules

Before transitioning to `SUBMITTED`:

- application type must be set
- exactly one matching subtype must exist
- all required subtype fields must be present
- logical checks must pass (e.g. date ranges)

This enforces **total specialization at submission time**.

---

## 6. Soft Delete Strategy

All main entities use soft delete via `deleted_at`.

Rules:

- soft-deleted records are excluded from normal queries
- audit logs remain intact
- soft delete is irreversible in the MVP

---

## 7. Audit & Traceability

### 7.1 Audit Log

The system records an audit entry for:

- every status transition
- reviewer assignment changes
- optional comments or notes

Each audit entry includes:

- timestamp
- actor (user)
- action type
- affected application
- optional payload (JSON)

Audit logs are append-only.

---

## 8. Authentication \u0026 Authorization

### 8.1 User Registration \u0026 Email Verification

**MVP behavior (current):**

- Only **APPLICANT** accounts can self-register via `POST /auth/register`
- Newly registered applicants are immediately marked as verified:
  - `isEmailVerified = true` (or `emailVerifiedAt = NOW()`)
- Login is allowed immediately after registration

**Rationale:**

- Simplifies MVP implementation and testing
- Avoids external dependencies (email provider, task queues) during initial phase

**Planned extension (enterprise):**

- After registration: `isEmailVerified = false`
- Verification email sent asynchronously via queue (BullMQ + Redis)
- Endpoints:
  - `POST /auth/verify-email` (with token)
  - `POST /auth/resend-verification`
- Access policy: login allowed, but critical actions (submit, status changes) require verified email

**Account types:**

- **APPLICANT**: self-service registration
- **REVIEWER**: created by Admin (no self-registration)
- **ADMIN**: created manually or via seed

### 8.2 JWT-based Authentication

- Access token (short-lived, e.g., 15 minutes)
- Refresh token (long-lived, e.g., 7 days)
- Token payload includes: `userId`, `email`, `role`

### 8.3 Role-Based Access Control (RBAC)

See sections 3.1–3.3 for detailed permissions per role.

### 8.4 User Soft Delete

- Users support soft delete via `deleted_at`.
- Soft-deleted users cannot authenticate and are excluded from default queries.
- Admin can soft delete users for compliance/support reasons.

---

## 8. REST API – Endpoints (MVP)

### 8.1 Authentication

```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout

```

### 8.2 User Management Endpoints

```
GET    /users/me              # current user profile (optional but useful)
PATCH  /users/me              # user updates own profile
POST   /users/me/deactivate   # user deactivates own account
GET    /users                 # admin list users (optional MVP)
PATCH  /users/{id}            # admin updates user (role/active/verified)
DELETE /users/{id}            # admin soft delete user
```

### 8.3 Applicant Endpoints

```
POST   /applications                 # create draft
PATCH  /applications/{id}            # update supertype fields (draft)
PATCH  /applications/{id}/type-data  # update subtype fields (draft)
POST   /applications/{id}/submit     # submit (draft -> submitted)
POST   /applications/{id}/cancel     # cancel (draft/submitted -> cancelled)
GET    /applications?mine=true       # list own applications
GET    /applications/{id}            # details (includes subtype + audit)
```

### 8.4 Reviewer Endpoints

```
GET    /applications/inbox           # inbox filter/sort/pagination
POST   /applications/{id}/assign     # assign to self (or admin reassign)
POST   /applications/{id}/status     # status transitions + optional comment
GET    /applications/{id}            # details (includes subtype + audit)
```

### 8.5 Reporting (Admin, optional MVP)

```
GET /reports/applications-by-status
GET /reports/processing-time
```

---

## 9. Consistency & Transactions

- All multi-table writes are executed in a single transaction (`prisma.$transaction`), e.g.:
  - create application + create subtype
  - change type + remove other subtype rows + upsert correct subtype
  - status change + audit log entry
  - assign/reassign + audit log entry
- Specialization invariants (CTI) are enforced in the service layer:
  - **disjointness**: at most one subtype row exists per application
  - **type guard**: subtype payload must match `application.type`
- Submission enforces **total-at-submit**:
  - type must be set, matching subtype must exist, required fields valid
- Concurrency policy (MVP):
  - claiming/assigning is atomic; if another user claims first → **409 Conflict**
- Terminal states (`APPROVED`, `REJECTED`, `CANCELLED`) are immutable (read-only)

---

## 10. Performance Considerations

Key query patterns:

- **Reviewer inbox**: filter (status/type/assignment/date range) + sort + pagination
- **Applicant list (mine)**: list own applications sorted by last update
- **Audit trail**: fetch audit entries for one application ordered by time

Performance rules:

- Prefer **cursor-based pagination** for inbox lists to keep queries stable at scale.
- Default queries exclude soft-deleted rows (`deleted_at IS NULL`).
- Indexes follow **query shape** (WHERE columns first, then ORDER BY columns).

Index examples (Postgres):

- Inbox: `(assigned_to_id, status, submitted_at DESC)` with `WHERE deleted_at IS NULL` (partial index)
- Applicant list: `(applicant_id, updated_at DESC)` with `WHERE deleted_at IS NULL`
- Audit trail: `(application_id, created_at ASC)`

---

## 11. Non-Goals (MVP)

The MVP intentionally focuses on the core workflow and data integrity. The following items are out of scope:

- **Complex notifications** (email/SMS/push, reminder scheduling, escalation rules)
- **External integrations** (identity providers, third-party APIs, payment, etc.)
- **File storage** (attachments/document management; only metadata may be added later)
- **Workflow customization by admins** (no dynamic workflow designer; status transitions are fixed in code)
- **Multi-tenant / organization model** (single-tenant MVP unless added later)
- **Advanced search** (no full-text search / Elasticsearch in MVP)
