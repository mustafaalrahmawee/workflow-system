# MAPPING – EER → Relational Schema (CTI) + Enforcement Strategy

## 1. Strategy: CTI (Class Table Inheritance)

EER specialization:
Application (superclass) -> ParkingApplication, EventApplication (subclasses)

Relational:

- application (supertype table)
- parking_application (subtype table)
- event_application (subtype table)

Subtype key rule:

- subtype.application_id is both PK and FK to application.application_id
- ensures 1:1 relationship between supertype and each subtype

---

## 2. Mapping Summary

### 2.1 Application → application

- application_id (PK)
- reference_no (UNIQUE)
- type (enum)
- status (enum)
- applicant_id (FK -> user)
- assigned_to_id (FK -> user, nullable)
- submitted_at (nullable)
- created_at, updated_at, deleted_at

### 2.2 ParkingApplication → parking_application

- application_id (PK, FK -> application)
  - FK uses `ON DELETE CASCADE` for **hard deletes only** (soft delete does not trigger cascades)
- license_plate, zone, start_date, end_date

### 2.3 EventApplication → event_application

- application_id (PK, FK -> application)
  - FK uses `ON DELETE CASCADE` for **hard deletes only** (soft delete does not trigger cascades)
- location, expected_visitors, noise_level, event_date

### 2.4 AuditLog → audit_log

- audit_id (PK)
- application_id (FK -> application)
  - Recommended hard-delete policy: `ON DELETE RESTRICT` (keep audit history; applications are soft-deleted in MVP)
- actor_user_id (FK -> user)
- action_type (enum)
- payload_json
- created_at

---

## 3. Enforcing EER Constraints

### 3.1 Disjointness (exactly one subtype)

Primary enforcement: service layer (NestJS)

- all writes use transactions (`prisma.$transaction`)
- when setting/changing type:
  - delete subtype rows in other subtype tables
  - create/upsert subtype row for the chosen type

DB support:

- each subtype table has PK(application_id), preventing duplicates within that subtype table

Optional DB-level:

- triggers to block illegal inserts into subtype tables
- used only when multiple writers exist (imports, legacy systems)

### 3.2 Partial vs Total specialization

- Partial in DRAFT: allow application creation before subtype is complete
- Total-at-submit: submit endpoint requires subtype presence and required fields

### 3.3 Type guard

- service layer ensures payload matches application.type
- submit endpoint re-validates subtype completeness before status change

---

## 4. Soft Delete

Source of truth:

- application.deleted_at

Subtype behavior:

- subtype rows follow the parent lifecycle
- recommended: no deleted_at columns in subtype tables for MVP
- subtype rows are deleted/kept according to parent operations and invariants

Note: `ON DELETE CASCADE` is kept as a safety net for rare hard-delete scenarios; the MVP uses soft delete (`application.deleted_at`) as the source of truth.

---

## 5. Index Strategy (Postgres)

Key query pattern: reviewer inbox

- WHERE deleted_at IS NULL
- AND status IN (...)
- AND assigned_to_id = ? OR unassigned
- ORDER BY submitted_at DESC
- pagination

Recommended (created via SQL migrations if partial indexes are needed):

- partial index for active inbox queries
  - (assigned_to_id, status, submitted_at DESC) WHERE deleted_at IS NULL
- applicant list
  - (applicant_id, created_at DESC) WHERE deleted_at IS NULL
