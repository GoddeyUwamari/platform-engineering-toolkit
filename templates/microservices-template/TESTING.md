# CloudBill Testing Guide

Comprehensive testing suite for CloudBill microservices using Jest, Supertest, and @faker-js/faker.

## Overview

Each service has a complete testing infrastructure with:
- **Unit tests** - Business logic testing with mocked dependencies
- **Integration tests** - API endpoint testing with real database
- **Test factories** - Generate realistic test data
- **Test helpers** - Setup/teardown and mocking utilities
- **Coverage reporting** - 70% threshold for branches, functions, lines, statements

## Test Structure

```
services/<service-name>/
├── __tests__/
│   ├── helpers/
│   │   ├── setup.ts          # Test database setup/teardown
│   │   ├── factories.ts      # Test data factories
│   │   └── mocks.ts          # External service mocks
│   ├── unit/
│   │   └── *.test.ts         # Business logic tests
│   └── integration/
│       └── *.test.ts         # API endpoint tests
├── jest.config.js            # Jest configuration
└── .env.test                 # Test environment variables
```

## Running Tests

### All Services
```bash
# Run all tests across all services
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode (from root)
npm test -- --watch
```

### Individual Services
```bash
# Auth service
npm test --workspace=services/auth-service

# Billing service
npm test --workspace=services/billing-service

# Payment service
npm test --workspace=services/payment-service

# Notification service
npm test --workspace=services/notification-service

# API Gateway
npm test --workspace=services/api-gateway
```

### Specific Test Files
```bash
# Run specific test file
cd services/auth-service
npm test -- __tests__/unit/auth.service.test.ts

# Watch mode for specific service
cd services/auth-service
npm run test:watch
```

## Test Database Setup

Tests use a separate `cloudbill_test` database to avoid contaminating development data.

### Prerequisites

1. **PostgreSQL running on port 5433** (Docker default mapping)
2. **Create test database:**
   ```bash
   # Connect to PostgreSQL
   docker-compose exec postgres psql -U postgres

   # Create test database
   CREATE DATABASE cloudbill_test;

   # Exit
   \q
   ```

3. **Run migrations on test database:**
   ```bash
   DB_NAME=cloudbill_test npm run db:migrate
   ```

### Automatic Cleanup

- **beforeAll**: Sets up database connection
- **beforeEach**: Cleans all test data (DELETE FROM all tables)
- **afterAll**: Closes database connection

This ensures each test runs with a clean database state.

## Test Configuration

### Coverage Thresholds

All services enforce minimum 70% coverage:

```javascript
coverageThresholds: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### Test Environment Variables

Each service has a `.env.test` file with test-specific configuration:

- Database: `cloudbill_test` on port 5433
- Redis: Mocked (no real Redis required for tests)
- External APIs: Mocked (Stripe, Twilio, etc.)
- JWT secrets: Test-only values

## Service-Specific Testing

### Auth Service

**Unit Tests** (`__tests__/unit/auth.service.test.ts`):
- User registration validation
- Login authentication
- Password strength validation
- Email format validation
- Token generation

**Integration Tests** (`__tests__/integration/auth.routes.test.ts`):
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/auth/me - Get current user
- POST /api/auth/logout - User logout
- PATCH /api/auth/profile - Update profile

**Test Factories**:
- `createUser()` - Create test user with hashed password
- `createTenant()` - Create test tenant
- `createAuthData()` - Create tenant + user together
- `generateRegisterRequest()` - Generate registration request data

### Billing Service

**Unit Tests** (`__tests__/unit/subscription.service.test.ts`):
- Subscription creation
- Subscription cancellation
- Invoice generation

**Integration Tests** (`__tests__/integration/billing.routes.test.ts`):
- POST /api/billing/subscriptions
- GET /api/billing/invoices
- GET /api/billing/health

**Test Factories**:
- `createSubscriptionPlan()` - Create test subscription plan
- `createSubscription()` - Create test subscription
- `createInvoice()` - Create test invoice
- `createUsageRecord()` - Create usage tracking record

**Mocks**:
- Kafka producer for event publishing
- Stripe API for payment processing

### Payment Service

**Test Factories**:
- `createPayment()` - Create test payment record
- `createPaymentMethod()` - Create test payment method

**Mocks**:
- Stripe Payment Intents API
- Stripe Payment Methods API
- Stripe Customers API

### Notification Service

**Test Factories**:
- `createNotification()` - Create test notification
- `createNotificationTemplate()` - Create email/SMS template

**Mocks**:
- Nodemailer for email sending
- Twilio for SMS sending
- Axios for webhook calls

### API Gateway

**Integration Tests**:
- Service proxy routing
- Rate limiting enforcement
- JWT authentication
- Tenant context propagation

**Mocks**:
- Downstream service HTTP calls
- Redis rate limiter

## Writing New Tests

### Unit Test Example

```typescript
// __tests__/unit/my-service.test.ts
import { MyService } from '../../src/services/my-service';

jest.mock('../../src/models/my-model');

describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('myMethod', () => {
    it('should do something successfully', async () => {
      // Arrange
      const mockData = { id: '123', name: 'Test' };
      (MyModel.findById as jest.Mock).mockResolvedValue(mockData);

      // Act
      const result = await MyService.myMethod('123');

      // Assert
      expect(result).toEqual(mockData);
      expect(MyModel.findById).toHaveBeenCalledWith('123');
    });
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/my-routes.test.ts
import request from 'supertest';
import app from '../../src/index';
import { getTestPool } from '../helpers/setup';
import { createUser, createTenant } from '../helpers/factories';

describe('My Routes Integration Tests', () => {
  let testPool: any;

  beforeAll(async () => {
    testPool = getTestPool();
  });

  describe('GET /api/my-resource', () => {
    it('should retrieve resource successfully', async () => {
      // Arrange
      const tenant = await createTenant(testPool);
      const user = await createUser(testPool, { tenantId: tenant.id });

      // Act
      const response = await request(app)
        .get('/api/my-resource')
        .set('X-Tenant-ID', tenant.id)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toBeDefined();
    });
  });
});
```

## Troubleshooting

### Tests Failing Due to Database Connection

**Problem**: Cannot connect to `cloudbill_test` database

**Solution**:
```bash
# 1. Ensure PostgreSQL is running
docker-compose ps

# 2. Create test database if it doesn't exist
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE cloudbill_test;"

# 3. Run migrations
DB_NAME=cloudbill_test npm run db:migrate
```

### Tests Failing Due to Missing Tables

**Problem**: Relation does not exist errors

**Solution**: Run migrations on test database:
```bash
DB_NAME=cloudbill_test npm run db:migrate
```

### Jest Module Resolution Errors

**Problem**: Cannot find module '@shared/...'

**Solution**:
1. Ensure `jest.config.js` has correct `moduleNameMapper`
2. Rebuild the project: `npm run build`
3. Clear Jest cache: `npx jest --clearCache`

### Coverage Threshold Not Met

**Problem**: Coverage below 70% threshold

**Solution**:
1. Add more test cases for uncovered branches
2. Test error handling paths
3. Test edge cases
4. Check coverage report: `npm run test:coverage`
5. View HTML report: `open services/<service>/coverage/index.html`

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to clean database
- Mock external dependencies

### 2. Descriptive Test Names
```typescript
it('should throw ValidationError when email format is invalid', () => {
  // Test implementation
});
```

### 3. AAA Pattern
- **Arrange**: Set up test data
- **Act**: Execute the code under test
- **Assert**: Verify the results

### 4. Test Real Scenarios
```typescript
it('should prevent duplicate user registration with same email', async () => {
  // Real-world scenario testing
});
```

### 5. Mock External Services
```typescript
jest.mock('@shared/cache/redis-connection');
jest.mock('stripe');
jest.mock('nodemailer');
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: DB_NAME=cloudbill_test npm run db:migrate
      - run: npm test
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Coverage Reports

After running `npm run test:coverage`, view detailed coverage:

```bash
# Open HTML coverage report
open services/auth-service/coverage/index.html
open services/billing-service/coverage/index.html
# ... etc
```

## Next Steps

1. **Expand auth-service tests**: Add more edge cases and error scenarios
2. **Implement billing-service tests**: Complete subscription and invoice tests
3. **Add payment-service tests**: Test Stripe integration thoroughly
4. **Write notification-service tests**: Test email, SMS, webhook delivery
5. **Complete gateway tests**: Test rate limiting and proxy logic
6. **Add E2E tests**: Test complete user flows across services
7. **Performance tests**: Add load testing with k6 or Artillery

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Faker.js Documentation](https://fakerjs.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
