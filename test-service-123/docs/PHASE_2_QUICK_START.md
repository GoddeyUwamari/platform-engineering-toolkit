# Phase 2 Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Start Services
```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

### 2. Run Migrations
```bash
# Run database migrations
npm run migration:run

# Expected output:
# ✅ Database connection established successfully
# 2 migrations executed successfully
```

### 3. Seed Development Data
```bash
# Populate database with test data
npm run seed

# Expected output:
# ✅ Seeded 4 users
# ✅ Seeded 10 tasks
# 📝 Default credentials:
#    Email: admin@example.com
#    Password: Password123!
```

### 4. Start Development Server
```bash
npm run dev

# Expected output:
# ✅ Database connection established successfully
# ✅ Redis connection established successfully
# 🚀 Server started successfully!
# 📍 Users API: http://localhost:3000/api/v1/users
# 📍 Tasks API: http://localhost:3000/api/v1/tasks
```

### 5. Test the API
```bash
# Health check
curl http://localhost:3000/ready

# List users
curl http://localhost:3000/api/v1/users

# Create a new user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "New",
    "lastName": "User"
  }'
```

## 📊 Default Accounts

After running `npm run seed`, you'll have these accounts:

| Email | Password | Role | Status |
|-------|----------|------|--------|
| admin@example.com | Password123! | ADMIN | ACTIVE |
| john.doe@example.com | Password123! | USER | ACTIVE |
| jane.smith@example.com | Password123! | USER | ACTIVE |
| bob.wilson@example.com | Password123! | USER | INACTIVE |

## 🔧 Common Commands

```bash
# Database Management
npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration
npm run migration:show     # Show migration status
npm run seed              # Seed development data
npm run db:setup          # Run migrations + seed

# Docker Management
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose ps         # Check service status
docker-compose logs -f    # View logs

# Development
npm run dev               # Start dev server
npm run build             # Build for production
npm start                 # Start production server
```

## 🐛 Troubleshooting

### Services won't start
```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API server

# Kill process if needed
kill -9 <PID>
```

### Database connection errors
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check credentials in .env match docker-compose.yml
cat .env | grep DB_

# Test connection manually
docker-compose exec postgres psql -U postgres -d production_api
```

### Redis connection errors
```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli -a redis_dev_password ping
# Should respond: PONG
```

### Migration errors
```bash
# Reset database (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d postgres redis
npm run migration:run
npm run seed
```

## 📚 API Examples

### Create User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "USER"
  }'
```

### List Users (with pagination)
```bash
curl "http://localhost:3000/api/v1/users?page=1&limit=5&status=ACTIVE"
```

### Get User by ID
```bash
curl http://localhost:3000/api/v1/users/{user-id}
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/v1/users/{user-id} \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "status": "ACTIVE"
  }'
```

### Create Task
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "description": "Task description",
    "status": "TODO",
    "priority": "HIGH",
    "createdById": "{user-id}"
  }'
```

### List Tasks (with filters)
```bash
curl "http://localhost:3000/api/v1/tasks?status=IN_PROGRESS&priority=HIGH&page=1&limit=10"
```

### Assign Task
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/{task-id}/assign \
  -H "Content-Type: application/json" \
  -d '{
    "assigneeId": "{user-id}"
  }'
```

### Update Task Status
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/{task-id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE"
  }'
```

## 🎯 What's Included

✅ **Database Layer**
- PostgreSQL 15 with TypeORM
- Connection pooling (2-10 connections)
- Automatic migrations
- Soft delete support

✅ **Caching Layer**
- Redis 7 with ioredis
- Cache-aside pattern
- Automatic invalidation
- 1-hour default TTL

✅ **API Endpoints**
- User CRUD operations
- Task CRUD operations
- Pagination support
- Filtering by status/role/priority
- Input validation

✅ **Business Logic**
- Password hashing (bcrypt)
- Email uniqueness validation
- User-task relationships
- Cache integration

✅ **DevOps Tools**
- Docker Compose configuration
- Database migrations
- Development seed data
- Health checks

## 🚀 Next Steps

After Phase 2 setup, you're ready for:

1. **Phase 3: Containerization**
   - Docker multi-stage builds
   - Kubernetes deployment
   - Helm charts

2. **Phase 4: CI/CD**
   - GitHub Actions
   - Automated testing
   - Container registry

3. **Phase 5: Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - ELK logging

## 📖 Full Documentation

For complete details, see [Phase 2 Complete Documentation](PHASE_2_COMPLETE.md)
