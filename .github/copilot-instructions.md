# GitHub Copilot Instructions – Workflow System

## Project Overview

This is a **NestJS + Prisma + PostgreSQL** backend for a Government/ERP-style permit application system.

### Key Features
- Class Table Inheritance (CTI) for application types
- Workflow state machine with role-based transitions
- JWT authentication with refresh tokens
- Soft delete with audit logging

## Architecture

### Domain Model
- **Application**: Aggregate root with workflow status
- **ParkingApplication / EventApplication**: CTI subtypes
- **User**: With roles (APPLICANT, REVIEWER, ADMIN)
- **AuditLog**: Immutable change history

### Workflow States
`DRAFT` → `SUBMITTED` → `IN_REVIEW` → `APPROVED` | `REJECTED` | `CANCELLED` | `NEEDS_INFO`

## Code Conventions

### Naming
- Files: `kebab-case.ts` (e.g., `parking-application.service.ts`)
- Classes: `PascalCase` (e.g., `ParkingApplicationService`)
- Methods: `camelCase` (e.g., `findByApplicantId`)
- DB columns: `snake_case` (e.g., `applicant_id`)
- Enums: `SCREAMING_SNAKE_CASE` (e.g., `IN_REVIEW`)

### DTOs
```typescript
// Use class-validator decorators
export class CreateApplicationDto {
  @IsEnum(ApplicationType)
  type: ApplicationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateParkingDataDto)
  parkingData?: CreateParkingDataDto;
}
```

### Services
```typescript
// Business logic in services, use transactions for CTI
async createWithSubtype(dto: CreateApplicationDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: { ...baseData, applicantId: userId }
    });
    
    if (dto.type === ApplicationType.PARKING && dto.parkingData) {
      await tx.parkingApplication.create({
        data: { applicationId: app.id, ...dto.parkingData }
      });
    }
    
    return app;
  });
}
```

### Workflow Validation
```typescript
// Always validate transitions
private readonly transitions: Record<Status, Partial<Record<Role, Status[]>>> = {
  DRAFT: {
    APPLICANT: [Status.SUBMITTED, Status.CANCELLED]
  },
  SUBMITTED: {
    REVIEWER: [Status.IN_REVIEW],
    APPLICANT: [Status.CANCELLED]
  },
  IN_REVIEW: {
    REVIEWER: [Status.NEEDS_INFO, Status.APPROVED, Status.REJECTED]
  },
  NEEDS_INFO: {
    APPLICANT: [Status.SUBMITTED]
  }
};
```

### Soft Delete
```typescript
// Always filter deleted records
async findAll(userId: string): Promise<Application[]> {
  return this.prisma.application.findMany({
    where: {
      applicantId: userId,
      deletedAt: null  // Always include this
    }
  });
}
```

### Audit Logging
```typescript
// Log all state changes
private async logTransition(
  applicationId: string,
  userId: string,
  from: Status,
  to: Status,
  comment?: string
) {
  await this.prisma.auditLog.create({
    data: {
      applicationId,
      actorUserId: userId,
      actionType: ActionType.STATUS_CHANGE,
      payload: { from, to, comment }
    }
  });
}
```

## Important Patterns

1. **CTI Writes**: Always use `prisma.$transaction()` for multi-table operations
2. **Workflow**: Validate transitions in service layer, never in controller
3. **Soft Delete**: Filter `deletedAt: null` in all queries by default
4. **Audit**: Create audit log entry for every state change
5. **Auth**: Use guards for authorization, services assume user is authenticated

## Testing

```typescript
describe('ApplicationService', () => {
  describe('submit', () => {
    it('should transition from DRAFT to SUBMITTED', async () => {
      // Arrange
      const app = await createDraftApplication();
      
      // Act
      const result = await service.submit(app.id, userId);
      
      // Assert
      expect(result.status).toBe(Status.SUBMITTED);
    });

    it('should throw when subtype data is missing', async () => {
      const app = await createDraftWithoutSubtype();
      
      await expect(service.submit(app.id, userId))
        .rejects.toThrow(BadRequestException);
    });
  });
});
```

## Don't

- Put business logic in controllers
- Skip validation for "simple" operations
- Use `any` type
- Delete audit logs
- Forget soft delete filtering
- Skip transactions for CTI operations
