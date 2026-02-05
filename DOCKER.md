# Docker Setup Guide

## Quick Start

1. **Copy environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Build and start all services:**

   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:3000
   - Database: localhost:5432

## Services

### 🗄️ Database (PostgreSQL)

- **Image:** postgres:16-alpine
- **Port:** 5432
- **Default credentials:** postgres/postgres
- **Database:** workflow_db

### 🔧 Backend API (NestJS)

- **Port:** 3000
- **Hot reload:** Enabled in development mode
- **Prisma:** Auto-generates client on startup

### 🎨 Frontend (Angular)

- **Port:** 4200
- **Hot reload:** Enabled with polling for Docker
- **API proxy:** Can access backend via /api prefix

## Commands

### Start services (detached):

```bash
docker-compose up -d
```

### View logs:

```bash
docker-compose logs -f          # All services
docker-compose logs -f api      # Backend only
docker-compose logs -f app      # Frontend only
```

### Stop services:

```bash
docker-compose down
```

### Rebuild after code changes:

```bash
docker-compose up --build
```

### Remove all data (including database):

```bash
docker-compose down -v
```

### Run Prisma migrations:

```bash
docker-compose exec api npx prisma migrate dev
```

### Access database shell:

```bash
docker-compose exec db psql -U postgres -d workflow_db
```

### Install new npm packages:

```bash
# Backend
docker-compose exec api npm install <package>

# Frontend
docker-compose exec app npm install <package>
```

## Troubleshooting

### Port already in use

If ports 3000, 4200, or 5432 are already in use, modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000" # Change left side only
```

### Database connection error

Make sure the DATABASE_URL in `.env` uses `db` as hostname (not `localhost`):

```
DATABASE_URL="postgresql://postgres:postgres@db:5432/workflow_db?schema=public"
```

### Frontend can't reach backend

Check that the API_URL in your Angular environment points to the correct backend URL.

### Changes not reflecting

Docker caches layers. Rebuild without cache:

```bash
docker-compose build --no-cache
docker-compose up
```

## Production Deployment

To use production builds:

1. Update `docker-compose.yml` to use production targets:

   ```yaml
   build:
     target: production
   ```

2. Set environment variables for production:

   ```bash
   NODE_ENV=production
   ```

3. Build and run:
   ```bash
   docker-compose -f docker-compose.yml up --build -d
   ```
