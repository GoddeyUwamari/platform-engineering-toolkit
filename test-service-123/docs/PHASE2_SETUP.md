# Phase 2: Database Layer Setup Guide

This guide walks you through setting up the complete database layer with PostgreSQL, TypeORM, Redis, and Repository Pattern.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Database Migrations](#database-migrations)
5. [Seeding Data](#seeding-data)
6. [Testing the Implementation](#testing-the-implementation)
7. [Architecture Overview](#architecture-overview)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting Phase 2, ensure you have:

- ✅ Node.js 20+ and npm 9+ installed
- ✅ PostgreSQL 15+ installed (or Docker)
- ✅ Redis 7+ installed (or Docker)
- ✅ Phase 1 completed successfully

### Option 1: Using Docker (Recommended)

If you have Docker installed, this is the easiest way to get started:

```bash
# Verify Docker is installed
docker --version
docker-compose --version
```

### Option 2: Native Installation

**PostgreSQL:**
- macOS: `brew install postgresql@15`
- Ubuntu: `sudo apt-get install postgresql-15`
- Windows: Download from https://www.postgresql.org/download/

**Redis:**
- macOS: `brew install redis`
- Ubuntu: `sudo apt-get install redis-server`
- Windows: Download from https://redis.io/download/

---

## Quick Start

### Step 1: Install Dependencies

```bash
# Install all project dependencies
npm install
```

### Step 2: Start Database Services

**Using Docker (Recommended):**

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

**Using Native Installation:**

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@15

# Start Redis (macOS with Homebrew)
brew services start redis

# Verify PostgreSQL is running
psql --version
pg_isready

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Step 3: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE production_api;

# Grant permissions (if needed)
GRANT ALL PRIVILEGES ON DATABASE production_api TO postgres;

# Exit psql
\q
```

### Step 4: Configure Environment

The `.env` file should already exist. Verify the database configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_api
DB_USER=postgres
DB_PASSWORD=postgres_dev_password
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_dev_password
REDIS_DB=0
REDIS_TTL=3600
```

**Important:** Update `DB_PASSWORD` and `REDIS_PASSWORD` to match your setup.

### Step 5: Run Migrations

```bash
# Run database migrations to create tables
npm run migration:run
```

Expected output:
```
🔌 Attempting to connect to database...
✅ Database connection established successfully
📊 Database: production_api
🏢 Host: localhost:5432
🔧 Connection pool: 2-10
query: SELECT * FROM "migrations"
query: CREATE TABLE IF NOT EXISTS "migrations" ...
Migration CreateUsersTable1702000000000 has been executed successfully
Migration CreateTasksTable1702000000001 has been executed successfully
```

### Step 6: Seed Development Data

```bash
# Populate database with sample data
npm run seed
```

Expected output:
```
🌱 Starting database seeding...
============================================================
🗑️  Clearing existing data...
✅ Cleared tasks table
✅ Cleared users table

📦 Seeding users...
✅ Created admin user: admin@example.com
✅ Created user: john.doe@example.com
✅ Created user: jane.smith@example.com
✅ Created user: bob.wilson@example.com

✅ Seeded 4 users

📦 Seeding tasks...
✅ Seeded 10 tasks

============================================================
✅ Database seeding completed successfully!
============================================================

📝 Default credentials:
   Email: admin@example.com
   Password: Password123!

   All users have the same password: Password123!
============================================================
```

### Step 7: Start the Server

```bash
# Start development server
npm run dev
```

Expected output:
```
🔧 Initializing services...

🔌 Attempting to connect to database...
✅ Database connection established successfully
📊 Database: production_api
🏢 Host: localhost:5432
🔧 Connection pool: 2-10
🔌 Attempting to connect to Redis...
✅ Redis connection established successfully
📊 Redis: localhost:6379
🗃️  Database: 0

✅ All services initialized successfully

============================================================
🚀 Server started successfully!
============================================================
📦 Application: production-api-framework
🌍 Environment: development
🔗 URL: http://localhost:3000
📡 API Version: v1
⏰ Started at: 2024-01-01T00:00:00.000Z
============================================================
📍 Health Check: http://localhost:3000/health
📍 Readiness Check: http://localhost:3000/ready
📍 API Info: http://localhost:3000/api/v1
📍 Users API: http://localhost:3000/api/v1/users
📍 Tasks API: http://localhost:3000/api/v1/tasks
============================================================
```

### Step 8: Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/ready
```

Expected response:
```json
{
  "success": true,
  "message": "API is ready",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 5.123,
  "environment": "development",
  "version": "v1",
  "services": {
    "database": {
      "status": "healthy",
      "healthy": true,
      "details": {
        "database": "production_api",
        "host": "localhost",
        "port": 5432,
        "isConnected": true
      }
    },
    "redis": {
      "status": "healthy",
      "healthy": true,
      "details": {
        "host": "localhost",
        "port": 6379,
        "db": 0,
        "status": "ready"
      }
    }
  }
}
```

**🎉 Congratulations! Phase 2 is now complete.**

---

## Detailed Setup

### Project Structure

Phase 2 adds the following structure:

```
production-api-framework/
├── src/
│   ├── core/
│   │   ├── database/
│   │   │   ├── data-source.ts          # TypeORM configuration
│   │   │   └── base.repository.ts      # Generic repository base class
│   │   └── cache/
│   │       └── redis.config.ts         # Redis connection setup
│   ├── models/
│   │   ├── user.entity.ts              # User entity with TypeORM decorators
│   │   └── task.entity.ts              # Task entity with relationships
│   ├── repositories/
│   │   ├── user.repository.ts          # User data access layer
│   │   └── task.repository.ts          # Task data access layer
│   ├── services/
│   │   ├── cache.service.ts            # Redis caching service
│   │   ├── user.service.ts             # User business logic
│   │   └── task.service.ts             # Task business logic
│   ├── api/v1/
│   │   ├── users/
│   │   │   ├── user.controller.ts      # User HTTP controllers
│   │   │   ├── user.routes.ts          # User route definitions
│   │   │   └── user.validator.ts       # User input validation
│   │   └── tasks/
│   │       ├── task.controller.ts      # Task HTTP controllers
│   │       ├── task.routes.ts          # Task route definitions
│   │       └── task.validator.ts       # Task input validation
│   ├── middlewares/
│   │   └── validation.middleware.ts    # express-validator middleware
│   ├── migrations/
│   │   ├── 1702000000000-CreateUsersTable.ts
│   │   └── 1702000000001-CreateTasksTable.ts
│   └── scripts/
│       └── seed-data.ts                # Database seeding script
├── docker-compose.yml                   # Local PostgreSQL & Redis setup
└── docs/
    └── PHASE2_SETUP.md                 # This file
```

---

## Database Migrations

### Understanding Migrations

Migrations are version-controlled database schema changes. They allow you to:
- Track database schema evolution
- Apply changes consistently across environments
- Roll back changes if needed
- Collaborate safely with teams

### Available Migration Commands

```bash
# Show migration status
npm run migration:show

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration from entity changes
npm run migration:generate -- src/migrations/MyMigration

# Sync schema (⚠️ development only, dangerous in production)
npm run schema:sync
```

### Creating a New Migration

1. Modify your entity files (e.g., add a new column to User entity)

2. Generate migration:
```bash
npm run migration:generate -- src/migrations/AddPhoneToUser
```

3. Review the generated migration file in `src/migrations/`

4. Run the migration:
```bash
npm run migration:run
```

### Migration Best Practices

- ✅ Always review generated migrations before running
- ✅ Test migrations on development database first
- ✅ Use descriptive migration names
- ✅ Never modify existing migrations that have been deployed
- ✅ Always create DOWN methods for rollback capability
- ❌ Never use `synchronize: true` in production
- ❌ Never run `schema:drop` in production

---

## Seeding Data

### Seed Script Overview

The seed script (`src/scripts/seed-data.ts`) creates initial data for development:

- **4 Users:**
  - 1 Admin user
  - 3 Regular users (1 active, 2 inactive)

- **10 Tasks:**
  - Various statuses (TODO, IN_PROGRESS, DONE)
  - Different priorities (LOW, MEDIUM, HIGH, URGENT)
  - Some assigned, some unassigned
  - Some with due dates

### Running Seed Script

```bash
# Seed database
npm run seed

# Or run migrations and seed in one command
npm run db:setup
```

### Default Credentials

All seeded users have the same password for development:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | Password123! | ADMIN |
| john.doe@example.com | Password123! | USER |
| jane.smith@example.com | Password123! | USER |
| bob.wilson@example.com | Password123! | USER |

### Customizing Seed Data

Edit `src/scripts/seed-data.ts` to add more users or tasks:

```typescript
const users = [
  {
    email: 'custom@example.com',
    passwordHash: defaultPassword,
    firstName: 'Custom',
    lastName: 'User',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  },
  // Add more users...
];
```

---

## Testing the Implementation

### Verify Database Tables

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost -d production_api

# List all tables
\dt

# Expected output:
#  Schema |   Name     | Type  |  Owner
# --------+------------+-------+----------
#  public | migrations | table | postgres
#  public | tasks      | table | postgres
#  public | users      | table | postgres

# Describe users table
\d users

# Count users
SELECT COUNT(*) FROM users;

# Exit
\q
```

### Verify Redis Connection

```bash
# Connect to Redis
redis-cli -h localhost -p 6379 -a redis_dev_password

# Ping Redis
PING
# Should return: PONG

# List all keys
KEYS *

# Exit
exit
```

### Test API Endpoints

See `docs/API_TESTING.md` for comprehensive API testing guide with curl examples.

Quick test:

```bash
# Get all users
curl http://localhost:3000/api/v1/users

# Get specific user
curl http://localhost:3000/api/v1/users/USER_ID_HERE

# Create new user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

---

## Architecture Overview

### Layer Architecture

Phase 2 implements a clean, layered architecture:

```
┌─────────────────────────────────────────┐
│         HTTP Layer (Controllers)        │  ← Request/Response handling
├─────────────────────────────────────────┤
│       Validation Layer (Middleware)     │  ← Input validation
├─────────────────────────────────────────┤
│       Business Logic (Services)         │  ← Business rules, caching
├─────────────────────────────────────────┤
│      Data Access (Repositories)         │  ← Database operations
├─────────────────────────────────────────┤
│         Database (PostgreSQL)           │  ← Data persistence
│           Cache (Redis)                 │  ← Performance optimization
└─────────────────────────────────────────┘
```

### Entity-Relationship Diagram

```
┌─────────────────────┐
│       Users         │
├─────────────────────┤
│ id (UUID, PK)       │
│ email (unique)      │
│ passwordHash        │
│ firstName           │
│ lastName            │
│ role (enum)         │
│ status (enum)       │
│ createdAt           │
│ updatedAt           │
│ deletedAt           │
└─────────────────────┘
         │ 1
         │
         │ created_by / assignee
         │
         │ *
┌─────────────────────┐
│       Tasks         │
├─────────────────────┤
│ id (UUID, PK)       │
│ title               │
│ description         │
│ status (enum)       │
│ priority (enum)     │
│ dueDate             │
│ assigneeId (FK)     │
│ createdById (FK)    │
│ createdAt           │
│ updatedAt           │
│ deletedAt           │
└─────────────────────┘
```

### Repository Pattern

The repository pattern abstracts data access:

**Benefits:**
- ✅ Separation of concerns
- ✅ Testability (easy to mock)
- ✅ Reusable CRUD operations
- ✅ Type safety with TypeScript
- ✅ Consistent error handling

**Example usage:**

```typescript
// Service layer uses repository
const user = await userRepository.findByEmail('user@example.com');

// Repository handles database operations
class UserRepository extends BaseRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({ where: { email } });
  }
}
```

### Caching Strategy

Redis is used for caching frequently accessed data:

**Cache TTL (Time To Live):**
- User data: 15 minutes (CacheTTL.LONG)
- Task data: 5 minutes (CacheTTL.MEDIUM)
- User task lists: 1 minute (CacheTTL.SHORT)
- Task statistics: 1 minute (CacheTTL.SHORT)

**Cache Invalidation:**
- Automatic invalidation on UPDATE operations
- Automatic invalidation on DELETE operations
- Pattern-based invalidation for related data

**Example:**

```typescript
// Cache-aside pattern
const user = await cacheService.getOrSet(
  `user:${userId}`,
  async () => {
    return await userRepository.findById(userId);
  },
  CacheTTL.LONG
);
```

---

## Troubleshooting

### Issue: Cannot connect to PostgreSQL

**Error:** `connection to server at "localhost" (::1), port 5432 failed`

**Solution:**

1. Check if PostgreSQL is running:
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Docker
docker-compose ps postgres
```

2. Verify connection settings in `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres_dev_password
```

3. Test direct connection:
```bash
psql -U postgres -h localhost -d production_api
```

4. Check PostgreSQL logs:
```bash
# macOS
tail -f /usr/local/var/log/postgres.log

# Docker
docker-compose logs -f postgres
```

### Issue: Cannot connect to Redis

**Error:** `Redis connection error: ECONNREFUSED`

**Solution:**

1. Check if Redis is running:
```bash
# macOS
brew services list | grep redis

# Linux
sudo systemctl status redis

# Docker
docker-compose ps redis
```

2. Test Redis connection:
```bash
redis-cli -h localhost -p 6379 -a redis_dev_password ping
# Should return: PONG
```

3. Check Redis logs:
```bash
# Docker
docker-compose logs -f redis
```

### Issue: Migration fails

**Error:** `relation "users" already exists`

**Solution:**

1. Check migration status:
```bash
npm run migration:show
```

2. If table exists but migration wasn't recorded:
```bash
# Connect to database
psql -U postgres -h localhost -d production_api

# Insert migration record manually
INSERT INTO migrations (timestamp, name)
VALUES (1702000000000, 'CreateUsersTable1702000000000');
```

3. Or drop and recreate (⚠️ development only):
```bash
npm run schema:drop
npm run migration:run
npm run seed
```

### Issue: TypeScript build errors

**Error:** `Cannot find module 'typeorm'` or similar

**Solution:**

1. Clean install dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Verify TypeScript compilation:
```bash
npm run type-check
```

3. Clean and rebuild:
```bash
npm run clean
npm run build
```

### Issue: Port already in use

**Error:** `Port 3000 is already in use`

**Solution:**

1. Find process using port:
```bash
# macOS/Linux
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

2. Kill the process:
```bash
# macOS/Linux
kill -9 PID

# Or change port in .env
PORT=3001
```

### Issue: Seed data fails

**Error:** `User with email already exists`

**Solution:**

The seed script clears data first. If it fails:

1. Manually clear tables:
```bash
psql -U postgres -h localhost -d production_api -c "DELETE FROM tasks; DELETE FROM users;"
```

2. Run seed again:
```bash
npm run seed
```

### Issue: Redis authentication fails

**Error:** `NOAUTH Authentication required`

**Solution:**

1. Check Redis password configuration:
```env
REDIS_PASSWORD=redis_dev_password
```

2. If using Docker, ensure password matches docker-compose.yml:
```yaml
command: redis-server --requirepass redis_dev_password
```

3. Test authentication:
```bash
redis-cli -h localhost -p 6379 -a redis_dev_password ping
```

### Getting Help

If you encounter issues not covered here:

1. Check application logs:
```bash
npm run dev
# Look for error messages in console
```

2. Check database logs (Docker):
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

3. Review TypeORM query logs (enabled in development):
   - Check console output for SQL queries
   - Verify queries are executing correctly

4. Create an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

## Next Steps

After completing Phase 2:

✅ Database layer with PostgreSQL
✅ Entity models with TypeORM
✅ Repository pattern implementation
✅ Redis caching layer
✅ Service layer with business logic
✅ RESTful API endpoints
✅ Input validation
✅ Health checks with service status

**Phase 3 Preview:** Authentication & Authorization
- JWT-based authentication
- User login/logout
- Password reset
- Role-based access control (RBAC)
- Protected routes with middleware
- Refresh token mechanism

---

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Phase 2 Complete! 🎉**

Your production API now has a robust, enterprise-ready database layer with proper architecture patterns, caching, and data persistence.
