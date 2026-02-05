# ERR – ER/EER Model (Textual Diagram)

## 1. Entities

### 1.1 User

- user_id (PK)
- email (UNIQUE)
- first_name
- last_name
- phone_number
- password_hash
- role ∈ {APPLICANT, REVIEWER, ADMIN}
- is_email_verified (default: true in MVP)
- is_active (default: true)
- created_at, updated_at, deleted_at

### 1.2 Application (SUPERCLASS)

- application_id (PK)
- reference_no (UNIQUE, human-readable)
- type ∈ {PARKING, EVENT, (CONSTRUCTION)}
- status ∈ {DRAFT, SUBMITTED, IN_REVIEW, NEEDS_INFO, APPROVED, REJECTED, CANCELLED}
- applicant_id (FK -> User.user_id) [mandatory]
- assigned_to_id (FK -> User.user_id) [nullable, must be REVIEWER role – service guard]
- submitted_at [nullable]
- created_at, updated_at, deleted_at

### 1.3 ParkingApplication (SUBCLASS)

- application_id (PK, FK -> Application.application_id)
- license_plate
- zone
- start_date
- end_date

### 1.4 EventApplication (SUBCLASS)

- application_id (PK, FK -> Application.application_id)
- location
- expected_visitors
- noise_level (optional enum)
- event_date

### 1.5 AuditLog

- audit_id (PK)
- application_id (FK -> Application.application_id)
- actor_user_id (FK -> User.user_id)
- action_type ∈ {STATUS_CHANGE, ASSIGNMENT_CHANGE, COMMENT, DATA_CHANGE}
- created_at
- payload_json (optional)

---

## 2. Relationships & Cardinalities

### R1: User (Applicant) — creates — Application

- User 1 ---- N Application
- Each Application has exactly 1 applicant (mandatory)

### R2: User (Reviewer) — assigned_to — Application

- Application N ---- 0..1 Reviewer (each application is assigned to at most one reviewer)
- Reviewer 1 ---- 0..N Application (a reviewer can have many applications assigned)
- Only users with `role = REVIEWER` may be assigned (service guard)

### R3: Application — has — AuditLog

- Application 1 ---- N AuditLog
- Each AuditLog belongs to exactly 1 Application
- Users are not hard-deleted; audit FK references remain valid

### R4: EER Specialization (CTI) Application -> {ParkingApplication, EventApplication}

- Disjoint: at most one subtype row exists for an application
- Partial: draft may exist before subtype is filled
- Total-at-submit: on submit, subtype must exist and be complete

---

## 3. Constraints

### 3.1 Workflow constraints (service layer)

**Allowed transitions (role-based):**

- Applicant:
  - DRAFT → SUBMITTED
  - NEEDS_INFO → SUBMITTED
  - DRAFT → CANCELLED
  - SUBMITTED → CANCELLED (only if review not started)
- Reviewer:
  - SUBMITTED → IN_REVIEW
  - IN_REVIEW → NEEDS_INFO
  - IN_REVIEW → APPROVED
  - IN_REVIEW → REJECTED

**Terminal states:**

- APPROVED, REJECTED, CANCELLED are terminal (no outgoing transitions, read-only).

**Submission guard (total-at-submit):**

- Transition to SUBMITTED requires:
  - application.type set
  - exactly one matching subtype (CTI) exists, is complete, and matches application.type (type guard)

### 3.2 Reviewer MVP policy (service layer)

**Status change authorization:**

- Reviewer may change status only if:
  1. `assigned_to_id == reviewerId`, OR
  2. `status == SUBMITTED AND assigned_to_id IS NULL` (Start Review auto-assigns)

**Comment requirements:**

- IN_REVIEW → NEEDS_INFO: **mandatory** comment
- IN_REVIEW → APPROVED|REJECTED: **optional** comment (recommended for audit)

### 3.3 Concurrency constraints (service layer)

- Assign/claim operations are atomic (transaction)
- If another reviewer claims first → **409 Conflict**
- Terminal states are immutable (no assignment or status changes)

### 3.4 Specialization constraints (service layer + DB support)

- if type=PARKING then parking subtype must exist at submit time
- disjointness enforced in service layer; DB enforces 1:1 per subtype via PK/FK

### 3.5 Soft delete

- `deleted_at` indicates inactive records, filtered by default
- Users with `deleted_at` set cannot authenticate
- Audit logs are never soft-deleted (append-only)

### 3.6 DB integrity

- PK/FK, UNIQUE(email), UNIQUE(reference_no)
- optional CHECK: date ranges, expected_visitors >= 0
