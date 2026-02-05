# CLAUDE.md – Agent Instructions for Workflow System

## Project Overview

This is an **Application & Workflow System** (Gov/ERP style) built with:

- **Frontend**: Angular + Tailwind CSS + TypeScript (located in `app/`)
- **Backend**: NestJS + Prisma ORM + PostgreSQL (located in `api/`)
- **DevOps**: Docker + Docker Compose
- **Architecture**: Class Table Inheritance (CTI) for application types
- **API**: RESTful with role-based access control

The system handles permit applications (Parking, Event) with a finite state machine workflow.

## Project Structure

```
workflow-system/
├── api/                      # NestJS Backend
│   ├── src/
│   ├── prisma/
│   ├── test/
│   └── package.json
├── app/                      # Angular Frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── docs/                     # Documentation
│   ├── MINIWORLD.md
│   ├── ERR.md
│   ├── MAPPING.md
│   └── USER_STORIES.md
└── CLAUDE.md                 # This file
```

---

## Quick Reference

### Tech Stack

```
Runtime:     Node.js 22+
Framework:   NestJS 10+, Angular 21+
ORM:         Prisma 7+
Database:    PostgreSQL 16+
Auth:        JWT (access + refresh tokens)
Validation:  class-validator + class-transformer
Testing:     Jest + Supertest
```

### Project Structure (Target)

```
api/src/
├── auth/                     # Authentication module
│   ├── dto/
│   ├── guards/
│   └── strategies/
├── users/                    # User management
│   ├── dto/
│   └── repositories/
├── applications/             # Core application module (aggregate root)
│   ├── dto/
│   ├── subtypes/
│   │   ├── parking/
│   │   └── event/
│   ├── guards/
│   ├── repositories/         # Soft-delete filtering here
│   └── services/
├── audit/                    # Audit logging module
├── common/
│   ├── decorators/
│   ├── filters/              # Exception filters
│   ├── guards/
│   ├── interceptors/
│   └── utils/
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts
```

---

## Core Domain Rules

### 1. Application Lifecycle (FSM)

```
DRAFT ──submit──▶ SUBMITTED ──start_review──▶ IN_REVIEW ──approve──▶ APPROVED
  │                 │   │                      │   ├──reject──▶ REJECTED
  │                 │   └──assign (no status)  │   └──request_info──▶ NEEDS_INFO
  └──cancel──▶      └──cancel──▶               │                      │
CANCELLED (terminal)                            └────────resubmit──────┘
                                                (NEEDS_INFO → SUBMITTED)

```

**Terminal states**: `APPROVED`, `REJECTED`, `CANCELLED` (no further transitions allowed)

**Important**: `assign` is NOT a status transition – it only updates `assigned_to_id` and creates an audit entry. The status remains unchanged (typically `SUBMITTED` or `IN_REVIEW`).

### 2. Role Permissions

| Action                | APPLICANT | REVIEWER | ADMIN |
| --------------------- | --------- | -------- | ----- |
| Create draft          | ✓         | ✗        | ✗     |
| Edit own draft        | ✓         | ✗        | ✗     |
| Submit                | ✓         | ✗        | ✗     |
| Cancel own            | ✓         | ✗        | ✓     |
| View own applications | ✓         | ✗        | ✓     |
| View inbox            | ✗         | ✓        | ✓     |
| Assign to self        | ✗         | ✓        | ✓     |
| Change status         | ✗         | ✓        | ✓     |
| Reassign              | ✗         | ✗        | ✓     |

### 3. CTI (Class Table Inheritance) Rules

- `application` table = supertype (shared fields)
- `parking_application` / `event_application` = subtypes (type-specific fields)
- **Disjoint**: max one subtype row per application (enforced in service layer)
- **Partial in DRAFT**: subtype data optional during draft phase
- **Total at SUBMIT**: subtype must exist and be complete before submission

**Enforcement Rules:**

1. On `PATCH /applications/{id}/type-data`: validate that payload matches `application.type`
2. On `POST /applications/{id}/submit`: re-validate subtype completeness
3. On type change: delete old subtype row, create new one (within transaction)

### 4. ID Strategy

- **Internal ID**: UUID (`application_id`) – used in database and API responses
- **Public Reference**: `reference_no` (human-readable, e.g., `APP-2024-001234`) – for display and search
- UUIDs are safe to expose in API responses (no information leakage)

### 5. Soft Delete

- All main entities have `deleted_at` column (nullable timestamp)
- Soft-deleted records are filtered **explicitly in repository methods**
- Audit logs are **never** deleted (append-only)

---

## Soft Delete Strategy

We use **explicit repository filtering** instead of Prisma middleware for clarity and predictability.

### Why Not Middleware?

Prisma middleware has pitfalls:

- `findUnique` behaves differently than `findFirst`
- `count`, `aggregate`, `groupBy` need separate handling
- Hidden behavior causes debugging nightmares

### Repository Pattern

```typescript
// application.repository.ts
@Injectable()
export class ApplicationRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Application | null> {
    return this.prisma.application.findFirst({
      where: { id, deletedAt: null }, // Always explicit
    });
  }

  async findMany(filters: ApplicationFilters): Promise<Application[]> {
    return this.prisma.application.findMany({
      where: {
        ...filters,
        deletedAt: null, // Always explicit
      },
    });
  }

  async findByIdIncludeDeleted(id: string): Promise<Application | null> {
    return this.prisma.application.findUnique({
      where: { id }, // Intentionally includes soft-deleted
    });
  }

  async softDelete(id: string): Promise<Application> {
    return this.prisma.application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

**Rule**: Every query method must explicitly handle `deletedAt` – either filter it out or document why it's included.

---

## Authentication Policy (MVP vs Planned Extension)

### MVP (current implementation)

The system supports user registration for **APPLICANT** accounts only.

**Email verification behavior:**

- Newly registered applicants are marked as verified immediately:
  - `isEmailVerified = true` (or `emailVerifiedAt = NOW()`)
- Login is allowed immediately after registration
- No email verification token generation or email sending

**Rationale (MVP):**

- Keep the core workflow implementation fast and testable
- Avoid external dependencies (email provider, background workers) during the MVP phase
- Focus on core business logic (application workflow, CTI, audit trail)

**Account creation policy:**

- **APPLICANT**: self-registration via `POST /auth/register`
- **REVIEWER**: created by ADMIN (not self-service)
- **ADMIN**: created manually or via migration/seed

---

### Planned Extension (Enterprise-style email verification)

**Goal:** Require email verification before an applicant can fully use the system.

#### Planned behavior

**After registration:**

- `isEmailVerified = false` (or `emailVerifiedAt = null`)
- A verification token is generated and stored securely (hash + expiry)
- Verification email is sent asynchronously via queue

**Verification is completed via token endpoint:**

```
POST /auth/verify-email
Body: { token: "..." }
```

**Optional resend endpoint:**

```
POST /auth/resend-verification
```

#### Access policy options (choose later)

1. **Strict**: Login is blocked until email is verified
   - `POST /auth/login` returns `403 Forbidden` with error code `EMAIL_NOT_VERIFIED`

2. **Soft** (recommended): Login is allowed, but critical actions are blocked until verified
   - Login succeeds, JWT is issued
   - Critical endpoints require `@EmailVerifiedGuard`:
     - Submit application
     - Status changes
     - Reviewer inbox access
   - Applicant can view own draft applications but cannot submit

#### Operational implementation (later)

**Email dispatch via queue:**

- Verification emails will be sent asynchronously via a queue (e.g., **BullMQ + Redis**)
- Benefits: retries, backoff, resilience, and decoupled email sending
- Worker process handles email delivery

**Database schema (future-proof):**

```prisma
model User {
  // ... existing fields
  isEmailVerified         Boolean   @default(false)  // or emailVerifiedAt
  emailVerificationToken  String?   @unique
  emailVerificationExpiry DateTime?
}
```

**Token security:**

- Store only hashed tokens in database
- Use cryptographically secure random tokens
- Set reasonable expiry (e.g., 24 hours)
- Invalidate token after successful verification

**Note:**

- Reviewer/Admin accounts are not self-registered
- They are created/activated by an Admin (no email verification loop)

---

## Error Handling

### NestJS Exceptions

Use built-in exceptions for consistency:

| Scenario                    | Exception               | HTTP Status |
| --------------------------- | ----------------------- | ----------- |
| Resource not found          | `NotFoundException`     | 404         |
| Unauthorized access         | `UnauthorizedException` | 401         |
| Forbidden action            | `ForbiddenException`    | 403         |
| Invalid input               | `BadRequestException`   | 400         |
| Invalid workflow transition | `BadRequestException`   | 400         |
| Duplicate resource          | `ConflictException`     | 409         |

### Prisma Error Mapping

```typescript
// common/filters/prisma-exception.filter.ts
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    switch (exception.code) {
      case "P2002": // Unique constraint violation
        return response.status(409).json({
          statusCode: 409,
          message: "Resource already exists",
          error: "Conflict",
        });
      case "P2025": // Record not found
        return response.status(404).json({
          statusCode: 404,
          message: "Resource not found",
          error: "Not Found",
        });
      default:
        return response.status(500).json({
          statusCode: 500,
          message: "Internal server error",
          error: "Internal Server Error",
        });
    }
  }
}
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Database
npx prisma generate          # Generate Prisma client
npx prisma migrate dev       # Run migrations (dev)
npx prisma migrate deploy    # Run migrations (prod)
npx prisma db seed           # Seed database
npx prisma studio            # Visual database browser

# Development
npm run start:dev            # Start with hot reload
npm run build                # Build for production
npm run start:prod           # Start production build

# Testing
npm run test                 # Unit tests
npm run test:e2e             # E2E tests
npm run test:cov             # Coverage report

# Linting
npm run lint                 # ESLint
npm run format               # Prettier
```

---

## Code Conventions

### Naming

| Type              | Convention           | Example                          |
| ----------------- | -------------------- | -------------------------------- |
| Files             | kebab-case           | `parking-application.service.ts` |
| Classes           | PascalCase           | `ParkingApplicationService`      |
| Methods/Variables | camelCase            | `findByApplicantId`              |
| Database columns  | snake_case           | `applicant_id`                   |
| Enums             | SCREAMING_SNAKE_CASE | `ApplicationStatus.IN_REVIEW`    |

### DTOs

- Suffix with purpose: `CreateApplicationDto`, `UpdateApplicationDto`, `ApplicationResponseDto`
- Use `class-validator` decorators for validation
- Use `class-transformer` for transformation

### Services

- Business logic lives in services, not controllers
- Use transactions for multi-table writes: `prisma.$transaction()`
- Validate workflow transitions in service layer

---

## Key Documentation

Read these before making changes:

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `docs/MINIWORLD.md`        | Business requirements & domain model |
| `docs/ERR.md`              | Entity-Relationship model            |
| `docs/MAPPING.md`          | CTI mapping strategy & constraints   |
| `docs/USER_STORIES.md`     | User stories                         |
| `api/prisma/schema.prisma` | Database schema (source of truth)    |

---

## Important Patterns

### 1. Workflow Transition Validation

```typescript
// application.service.ts
private readonly transitionRules: Record<ApplicationStatus, Partial<Record<Role, ApplicationStatus[]>>> = {
  [ApplicationStatus.DRAFT]: {
    [Role.APPLICANT]: [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
  },
  [ApplicationStatus.SUBMITTED]: {
    [Role.APPLICANT]: [ApplicationStatus.CANCELLED],
    [Role.REVIEWER]: [ApplicationStatus.IN_REVIEW],
  },
  [ApplicationStatus.IN_REVIEW]: {
    [Role.REVIEWER]: [
      ApplicationStatus.NEEDS_INFO,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED,
    ],
  },
  [ApplicationStatus.NEEDS_INFO]: {
    [Role.APPLICANT]: [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
  },
  // Terminal states have no transitions
  [ApplicationStatus.APPROVED]: {},
  [ApplicationStatus.REJECTED]: {},
  [ApplicationStatus.CANCELLED]: {},
};

validateTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus, role: Role): void {
  const allowedTransitions = this.transitionRules[currentStatus]?.[role] ?? [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new BadRequestException(
      `Invalid transition: ${currentStatus} → ${newStatus} for role ${role}`
    );
  }
}
```

### 2. CTI Subtype Creation (Transaction)

```typescript
async createWithSubtype(dto: CreateApplicationDto, userId: string): Promise<Application> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create supertype
    const app = await tx.application.create({
      data: {
        referenceNo: await this.generateReferenceNo(tx),
        type: dto.type,
        status: ApplicationStatus.DRAFT,
        applicantId: userId,
      },
    });

    // 2. Create subtype if data provided
    if (dto.type === ApplicationType.PARKING && dto.parkingData) {
      await tx.parkingApplication.create({
        data: { applicationId: app.id, ...dto.parkingData },
      });
    } else if (dto.type === ApplicationType.EVENT && dto.eventData) {
      await tx.eventApplication.create({
        data: { applicationId: app.id, ...dto.eventData },
      });
    }

    // 3. Create audit log
    await tx.auditLog.create({
      data: {
        applicationId: app.id,
        actorUserId: userId,
        actionType: ActionType.CREATED,
        payload: { type: dto.type },
      },
    });

    return app;
  });
}
```

### 3. Subtype Validation on Submit

```typescript
async submit(applicationId: string, userId: string): Promise<Application> {
  const app = await this.repository.findById(applicationId);

  if (!app) {
    throw new NotFoundException('Application not found');
  }

  // Ownership check
  if (app.applicantId !== userId) {
    throw new ForbiddenException('Not your application');
  }

  // Workflow validation
  this.validateTransition(app.status, ApplicationStatus.SUBMITTED, Role.APPLICANT);

  // CTI completeness check
  await this.validateSubtypeComplete(app);

  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        applicationId,
        actorUserId: userId,
        actionType: ActionType.STATUS_CHANGE,
        payload: { from: app.status, to: ApplicationStatus.SUBMITTED },
      },
    });

    return updated;
  });
}

private async validateSubtypeComplete(app: Application): Promise<void> {
  if (app.type === ApplicationType.PARKING) {
    const subtype = await this.prisma.parkingApplication.findUnique({
      where: { applicationId: app.id },
    });
    if (!subtype) {
      throw new BadRequestException('Parking application data is required');
    }
    if (!subtype.licensePlate || !subtype.zone || !subtype.startDate || !subtype.endDate) {
      throw new BadRequestException('Parking application data is incomplete');
    }
  } else if (app.type === ApplicationType.EVENT) {
    const subtype = await this.prisma.eventApplication.findUnique({
      where: { applicationId: app.id },
    });
    if (!subtype) {
      throw new BadRequestException('Event application data is required');
    }
    if (!subtype.location || !subtype.eventDate || !subtype.expectedVisitors) {
      throw new BadRequestException('Event application data is incomplete');
    }
  }
}
```

### 4. Audit Logging

```typescript
async logStatusChange(
  tx: Prisma.TransactionClient,
  applicationId: string,
  userId: string,
  oldStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
  comment?: string,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      applicationId,
      actorUserId: userId,
      actionType: ActionType.STATUS_CHANGE,
      payload: {
        from: oldStatus,
        to: newStatus,
        ...(comment && { comment }),
      },
    },
  });
}
```

---

## API Endpoints Overview

### Authentication

```
POST   /auth/register          # Register new user for applicant-only
POST   /auth/login             # Login, returns JWT tokens
POST   /auth/refresh           # Refresh access token
POST   /auth/logout            # Invalidate refresh token
```

### Applications (Applicant)

```
POST   /applications                    # Create draft
GET    /applications?mine=true          # List own applications
GET    /applications/:id                # Get details (own only)
PATCH  /applications/:id                # Update draft (supertype fields)
PATCH  /applications/:id/type-data      # Update draft (subtype fields)
POST   /applications/:id/submit         # Submit draft
POST   /applications/:id/cancel         # Cancel (draft/submitted)
```

### Applications (Reviewer)

```
GET    /applications/inbox              # List inbox (filter, sort, paginate)
POST   /applications/:id/assign         # Assign to self
POST   /applications/:id/status         # Change status (with optional comment)
```

### Applications (Admin)

```
POST   /applications/:id/reassign       # Reassign to another reviewer
GET    /reports/by-status               # Statistics by status
GET    /reports/processing-time         # Average processing time
```

---

## Testing Strategy

### Unit Tests

- Service methods (workflow logic, validations)
- Guards (authorization)
- Repository methods
- Utility functions

### E2E Tests

- Full API flows per role
- Workflow transitions (happy path + edge cases)
- Error scenarios (403, 404, 400)
- Pagination and filtering

### Test Naming

```typescript
describe("ApplicationService", () => {
  describe("submit", () => {
    it("should transition DRAFT to SUBMITTED when subtype is complete", async () => {});
    it("should throw BadRequestException when subtype data is missing", async () => {});
    it("should throw BadRequestException when status is not DRAFT", async () => {});
    it("should throw ForbiddenException when user is not the owner", async () => {});
    it("should create audit log entry on success", async () => {});
  });
});
```

---

## Common Tasks

### Add a New Application Type

1. Add enum value to `ApplicationType` in `prisma/schema.prisma`
2. Create new subtype table in Prisma schema
3. Run `npx prisma migrate dev --name add_construction_application`
4. Create subtype module under `applications/subtypes/construction/`
5. Add DTOs for the new subtype
6. Update `ApplicationService.validateSubtypeComplete()`
7. Update `ApplicationService.createWithSubtype()`
8. Add E2E tests for the new type

### Add a New Workflow Status

1. Add enum value to `ApplicationStatus` in `prisma/schema.prisma`
2. Run migration
3. Update `transitionRules` in `ApplicationService`
4. Update role permissions if needed
5. Add audit logging for new transitions
6. Update tests

### Add a New Index for Query Performance

```sql
-- For reviewer inbox query
CREATE INDEX idx_application_inbox
ON application (assigned_to_id, status, submitted_at DESC)
WHERE deleted_at IS NULL;

-- For applicant list query
CREATE INDEX idx_application_applicant
ON application (applicant_id, created_at DESC)
WHERE deleted_at IS NULL;
```

Add to Prisma schema as `@@index` or create via raw migration.

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/workflow_db?schema=public"

# JWT
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_REFRESH_EXPIRES_IN="7d"

# App
PORT=3000
NODE_ENV=development
```

---

## Do's and Don'ts

### ✅ Do

- Use transactions for multi-table operations (CTI writes)
- Validate workflow transitions in service layer
- Write audit logs for ALL state changes
- Filter soft-deleted records explicitly in repository
- Use DTOs for input validation
- Keep controllers thin (max 5-10 lines per method)
- Map Prisma errors to appropriate HTTP exceptions
- Use UUIDs for all primary keys

### ❌ Don't

- Skip validation for "simple" operations
- Hardcode status transitions in controllers
- Delete audit logs (ever)
- Use raw SQL unless absolutely necessary (and document why)
- Use Prisma middleware for soft-delete filtering
- Put business logic in controllers
- Forget to handle terminal states in workflow
- Expose sensitive data in error messages
