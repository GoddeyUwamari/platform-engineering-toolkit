# Quick Start Guide - Testing CloudBill

## Prerequisites

1. **Docker Compose running** with PostgreSQL
2. **Node modules installed** (`npm install` already done)
3. **Test database created** (see step 1 below)

## Setup Test Database (One-Time)

```bash
# 1. Create test database
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE cloudbill_test;"

# 2. Run migrations on test database
DB_NAME=cloudbill_test npm run db:migrate

# Verify test database exists
docker-compose exec postgres psql -U postgres -c "\l" | grep cloudbill_test
```

## Run Tests

### All Services
```bash
# Run all tests
npm test

# With coverage
npm run test:coverage
```

### Individual Service
```bash
# Auth service (fully implemented with 35+ tests)
npm test --workspace=services/auth-service

# Other services (template tests)
npm test --workspace=services/billing-service
npm test --workspace=services/payment-service
npm test --workspace=services/notification-service
npm test --workspace=services/api-gateway
```

### Watch Mode
```bash
cd services/auth-service
npm run test:watch
```

## Verify Setup

```bash
# List all test files discovered by Jest
cd services/auth-service
npm test -- --listTests

# Run a single test file
npm test -- __tests__/unit/auth.service.test.ts
```

## Expected Output

```
PASS __tests__/unit/auth.service.test.ts
PASS __tests__/integration/auth.routes.test.ts

Test Suites: 2 passed, 2 total
Tests:       35 passed, 35 total
Time:        4.856 s
```

## Troubleshooting

### Cannot connect to database
```bash
# Check Docker is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres
```

### Test database doesn't exist
```bash
# Create it
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE cloudbill_test;"
```

### Tables not found
```bash
# Run migrations
DB_NAME=cloudbill_test npm run db:migrate
```

## What's Included

✅ **5 services** with complete test infrastructure
✅ **13 test files** with 35+ comprehensive test cases in auth-service
✅ **25 helper files** (setup, factories, mocks)
✅ **Coverage reporting** configured at 70% threshold
✅ **Comprehensive documentation** in TESTING.md

## Next Steps

1. Review `TESTING.md` for detailed documentation
2. Review `TESTING_IMPLEMENTATION_SUMMARY.md` for implementation details
3. Expand tests in billing, payment, notification, and gateway services
4. Customize test factories for your specific needs
5. Add more integration tests for complex workflows

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:coverage` | Run with coverage report |
| `npm test -- --watch` | Watch mode |
| `npm test -- --verbose` | Detailed output |
| `npm test -- path/to/test.ts` | Run specific test |

## Documentation Files

- **TESTING.md** - Comprehensive testing guide (500+ lines)
- **TESTING_IMPLEMENTATION_SUMMARY.md** - Implementation overview
- **TEST_QUICK_START.md** - This file (quick reference)

Happy testing! 🧪
