# Claude Code Commands – Workflow System

## Quick Commands

Diese Befehle können direkt an Claude Code gegeben werden.

---

## 🚀 Setup & Installation

### Projekt initialisieren
```
Initialize the NestJS project with Prisma and PostgreSQL. Follow the structure defined in CLAUDE.md.
```

### Dependencies installieren
```
Install all required dependencies for NestJS, Prisma, JWT auth, validation, and testing.
```

---

## 📊 Database

### Prisma Schema erstellen
```
Create the Prisma schema based on docs/ERR.md and docs/MAPPING.md. Include all entities: User, Application, ParkingApplication, EventApplication, AuditLog with proper relations and enums.
```

### Migration ausführen
```
Create and run a Prisma migration for the current schema changes.
```

### Seed-Daten erstellen
```
Create a seed script with test users (one per role) and sample applications in different statuses.
```

---

## 🏗️ Module erstellen

### Auth Module
```
Create the auth module with JWT authentication, login/register endpoints, guards, and refresh token support.
```

### Users Module
```
Create the users module with CRUD operations, role management, and soft delete support.
```

### Applications Module (Core)
```
Create the applications module as the aggregate root. Include:
- CRUD for applications (supertype)
- Workflow state machine with transition validation
- Role-based access control
- Soft delete filtering
- Audit logging integration
```

### Parking Applications Module
```
Create the parking-applications module for the CTI subtype. Include:
- Subtype-specific DTOs
- Validation for parking permit fields
- Integration with parent application
```

### Event Applications Module
```
Create the event-applications module for the CTI subtype. Include:
- Subtype-specific DTOs  
- Validation for event permit fields
- Integration with parent application
```

### Audit Module
```
Create the audit module for logging all state changes. Include:
- Audit log service
- Action types enum
- Query methods for audit history
```

---

## 🔄 Workflow

### Workflow Service implementieren
```
Implement the workflow state machine in ApplicationService with:
- Valid transition rules per role
- Transition validation method
- Status change with audit logging
- Terminal state protection
```

### Submit-Logik implementieren
```
Implement the submit endpoint that:
- Validates subtype data is complete
- Transitions DRAFT → SUBMITTED
- Creates audit log entry
- Uses transaction for consistency
```

---

## 🧪 Testing

### Unit Tests für Services
```
Create unit tests for ApplicationService covering:
- All workflow transitions
- Invalid transition rejection
- Role-based permission checks
- Soft delete behavior
```

### E2E Tests für API
```
Create E2E tests for the applications API covering:
- Full workflow from DRAFT to APPROVED
- Role-based access control
- Error scenarios
- Pagination and filtering
```

---

## 🛠️ Common Tasks

### DTO erstellen
```
Create a DTO for [describe purpose] with class-validator decorators and proper typing.
```

### Guard erstellen
```
Create an authorization guard that checks [describe condition].
```

### Filter/Interceptor erstellen
```
Create a [filter/interceptor] for [describe purpose].
```

### Neuen Application Type hinzufügen
```
Add a new application type "[TypeName]" following the CTI pattern:
1. Add to Prisma schema
2. Create migration
3. Create NestJS module
4. Update ApplicationService
5. Add tests
```

---

## 🐛 Debugging

### Fehler analysieren
```
Analyze this error and suggest a fix: [paste error]
```

### Query optimieren
```
Optimize this Prisma query for performance: [paste query]
```

### Test fixen
```
This test is failing. Analyze and fix: [paste test + error]
```

---

## 📝 Documentation

### API Dokumentation generieren
```
Add Swagger/OpenAPI decorators to all controllers and DTOs for API documentation.
```

### README erstellen
```
Create a comprehensive README.md with setup instructions, API overview, and development guide.
```

---

## 🔧 Refactoring

### Code Review
```
Review this code for best practices, potential bugs, and improvements: [paste code]
```

### Service extrahieren
```
Extract [describe functionality] into a separate service with proper dependency injection.
```

### Error Handling verbessern
```
Improve error handling in [module/service] with proper exceptions and messages.
```
