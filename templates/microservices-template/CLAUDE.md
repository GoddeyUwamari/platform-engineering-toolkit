# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudBill is a multi-tenant SaaS billing platform built with microservices architecture. The system handles subscription management, invoicing, payments, and notifications for multiple tenant organizations with complete data isolation.

**Tech Stack:** Express.js, TypeScript, PostgreSQL (with Row-Level Security), Redis, Kafka, Docker, Kubernetes

## Architecture

### Microservices Structure

The codebase follows a **microservices architecture** with 5 independent services:

1. **API Gateway** (`services/api-gateway/`) - Port 8080
   - Single entry point for all client requests
   - Routes requests to appropriate services via HTTP proxy
   - Handles rate limiting and CORS
   - No direct database access

2. **Auth Service** (`services/auth-service/`) - Port 3001
   - User authentication (JWT with Redis sessions)
   - OAuth2 integration (Google, GitHub via Passport.js)
   - Password management
   - Session management with automatic expiration

3. **Billing Service** (`services/billing-service/`) - Port 3002
   - Subscription and invoice management
   - Usage-based billing calculations
   - PDF invoice generation

4. **Payment Service** (`services/payment-service/`) - Port 3003
   - Payment processing (Stripe integration)
   - Payment method management

5. **Notification Service** (`services/notification-service/`) - Port 3004
   - Email, SMS, webhook notifications
   - Template management

### Shared Code (`shared/`)

All services share common utilities and types:

- **`shared/types/index.ts`** - Comprehensive TypeScript types used across all services (User, Tenant, Invoice, Payment, etc.)
- **`shared/database/connection.ts`** - PostgreSQL connection pool with tenant context management
- **`shared/middleware/auth.middleware.ts`** - JWT verification and token generation utilities
- **`shared/middleware/tenant.middleware.ts`** - Multi-tenancy middleware with multiple resolution strategies (subdomain, header, token, param)
- **`shared/middleware/error-handler.ts`** - Centralized error handling with custom error classes
- **`shared/cache/`** - Redis connection and session management
- **`shared/utils/logger.ts`** - Winston-based structured logging
- **`shared/events/billing-events.ts`** - Event types for Kafka event-driven architecture

### Multi-Tenancy Implementation

The system uses **Row-Level Security (RLS)** in PostgreSQL for complete tenant data isolation:

- Each request must include tenant identification (via subdomain, header, or JWT token)
- Tenant context is set using `SET LOCAL app.current_tenant_id = 'tenant-uuid'`
- Database queries automatically filter by tenant_id via RLS policies
- See `shared/database/migrations/003_enable_row_level_security.sql` for RLS setup

### TypeScript Path Aliases

All services use `@shared/*` path alias to import shared code:
```typescript
import { logger } from '@shared/utils/logger';
import { User, Tenant } from '@shared/types';
```

Configured in root `tsconfig.json` with `"paths": { "@shared/*": ["./shared/*"] }`

## Development Commands

### Full Stack Development
```bash
# Start all services in development mode (requires local PostgreSQL/Redis or Docker containers)
npm run dev

# Start individual service
npm run dev --workspace=services/api-gateway
npm run dev --workspace=services/auth-service
npm run dev --workspace=services/billing-service
```

### Docker Development (Recommended)
```bash
# Start all containerized services (PostgreSQL, Redis, Auth, Gateway)
npm run docker:up
# Or: docker-compose up -d

# View logs for all services
npm run docker:logs
# Or: docker-compose logs -f

# View logs for specific service
docker-compose logs -f api-gateway
docker-compose logs -f auth-service

# Check container status
docker-compose ps

# Stop all containers
npm run docker:down

# Rebuild and restart specific service
docker-compose up -d --build auth-service
```

**Docker Configuration:**
- PostgreSQL: `localhost:5433` (mapped from container 5432)
- Redis: `localhost:6380` (mapped from container 6379)
- Auth Service: `localhost:3001`
- API Gateway: `localhost:8080`
- Services communicate internally using Docker network service names (e.g., `postgres:5432`, `redis:6379`)

### Building & Testing
```bash
# Build all services
npm run build

# Build specific service
npm run build --workspace=services/auth-service

# Run all tests
npm run test

# Run tests for specific service
npm run test --workspace=services/api-gateway

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (in service directory)
cd services/auth-service && npm run test:watch
```

### Database Management
```bash
# Run all migrations (executes .sql files in shared/database/migrations/)
npm run db:migrate
# Or: ./scripts/migrate-db.sh

# Seed database with initial data
npm run db:seed

# Connect to PostgreSQL (Docker)
docker-compose exec postgres psql -U postgres -d cloudbill

# Connect to Redis (Docker)
docker-compose exec redis redis-cli -a redis123
```

### Linting & Formatting
```bash
# Lint all TypeScript files
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format all files with Prettier
npm run format

# Check formatting without modifying
npm run format:check
```

### Service-Specific Commands
```bash
# Type-check without building (useful for debugging)
cd services/api-gateway && npm run type-check

# Start service in production mode
cd services/auth-service && npm run start:prod
```

## Key Implementation Patterns

### Service Port Convention
- API Gateway: 8080 (client-facing)
- Auth Service: 3001
- Billing Service: 3002
- Payment Service: 3003
- Notification Service: 3004
- Analytics Service: 3005

### Request Flow
1. Client → API Gateway (8080)
2. API Gateway validates JWT and tenant context
3. Gateway proxies to appropriate service (e.g., auth-service:3001)
4. Service processes request with tenant-scoped database queries
5. Response flows back through gateway to client

### Error Handling Pattern
All services use standardized error classes from `shared/middleware/error-handler.ts`:
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `NotFoundError` (404)
- `ValidationError` (400)
- `ConflictError` (409)

Wrap route handlers with `asyncHandler()` to automatically catch async errors.

### Database Query Pattern
```typescript
import { queryOne, query, setTenantContext } from '@shared/database/connection';

// Always set tenant context before queries
await setTenantContext(tenantId);

// Use type-safe query helpers
const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
```

### JWT Authentication Pattern
```typescript
import { authenticate, requireRole, generateAccessToken } from '@shared/middleware/auth.middleware';

// Protect routes with authentication
router.get('/profile', authenticate, async (req, res) => {
  // req.user contains decoded JWT payload
  const userId = req.user.userId;
});

// Require specific role
router.delete('/users/:id', authenticate, requireRole(UserRole.ADMIN), handler);
```

### Event-Driven Communication
Services communicate asynchronously via Kafka events. See `shared/events/billing-events.ts` for event types like:
- `INVOICE_CREATED`
- `PAYMENT_SUCCEEDED`
- `USER_CREATED`

## Database Migrations

Migrations are SQL files in `shared/database/migrations/` executed in order:
1. `001_create_tenants_table.sql`
2. `002_create_users_table.sql`
3. `003_enable_row_level_security.sql`
4. `004_seed_initial_data.sql`
5. `005_create_billing_tables.sql`
6. `006_create_billing_indexes.sql`
7. `007_seed_subscription_plans.sql`

**Important:** Always create new migrations with sequential numbering (e.g., `008_add_feature.sql`)

## Environment Variables

Each service requires environment configuration. Copy `.env.docker` as reference:

**Critical Variables:**
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Must match across services
- `DB_HOST` - Use `localhost` for local, `postgres` in Docker
- `REDIS_HOST` - Use `localhost` for local, `redis` in Docker
- `NODE_ENV` - `development` or `production`

**Auth Service Specific:**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth2 Google
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth2 GitHub

**Payment Service Specific:**
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`

## Testing Strategy

- Unit tests use Jest with TypeScript
- Tests are colocated in `tests/` directory within each service
- Shared utilities have tests in `shared/tests/`
- Mock external dependencies (database, Redis, Kafka) in unit tests

## Project Status

Current implementation status (see STATUS.md for details):
- ✅ Auth Service (containerized, fully functional)
- ✅ API Gateway (containerized, proxying to auth)
- ✅ Database & Redis (containerized)
- ⏳ Billing Service (structure created, implementation in progress)
- ⏳ Payment Service (structure created)
- ⏳ Notification Service (structure created)

## Common Development Workflows

### Adding a New Endpoint to Existing Service
1. Add route in `services/{service}/src/routes/`
2. Create controller in `services/{service}/src/controllers/`
3. Add business logic in `services/{service}/src/services/`
4. Update repository layer if database access needed
5. Add types to `shared/types/index.ts` if needed
6. Update API Gateway proxy routes if needed

### Creating a New Shared Utility
1. Add utility to `shared/utils/` or appropriate directory
2. Export from shared module
3. Import using `@shared/*` alias in services
4. Rebuild services to pick up changes

### Database Schema Changes
1. Create new migration file: `shared/database/migrations/00X_description.sql`
2. Run migration: `npm run db:migrate`
3. Update TypeScript types in `shared/types/index.ts`
4. Update repository layer queries

### Debugging Containerized Services
```bash
# View service logs
docker-compose logs -f auth-service

# Execute shell in container
docker-compose exec auth-service sh

# Restart service after code changes
docker-compose restart auth-service

# Rebuild service after dependency changes
docker-compose up -d --build auth-service
```
