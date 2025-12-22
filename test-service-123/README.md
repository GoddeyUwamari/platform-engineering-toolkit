# Production API Framework

> A production-ready Node.js/TypeScript API demonstrating enterprise-level backend development with comprehensive DevOps practices from code to cloud deployment.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Development Phases](#development-phases)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This project showcases a **production-grade backend API** built with modern best practices, including:

- **Clean Architecture** with separation of concerns
- **Type Safety** with TypeScript strict mode
- **Security Best Practices** (Helmet, CORS, input validation)
- **Comprehensive Error Handling** with custom error classes
- **Request Logging** and monitoring
- **Graceful Shutdown** for zero-downtime deployments
- **Environment-based Configuration** management
- **Code Quality Tools** (ESLint, Prettier, EditorConfig)
- **Docker & Kubernetes** ready (Phase 3)
- **CI/CD Pipeline** with GitHub Actions (Phase 4)

## ✨ Features

### Phase 1: Complete Project Foundation ✅

- ✅ Professional project structure with TypeScript
- ✅ Express.js server with security middleware
- ✅ Health check and readiness probe endpoints
- ✅ Comprehensive error handling
- ✅ Request logging with Morgan
- ✅ Environment configuration management
- ✅ Code quality tools (ESLint, Prettier)
- ✅ Development and production build scripts

### Phase 2: Database & Caching ✅ COMPLETE

- ✅ PostgreSQL 15 integration with TypeORM
- ✅ Redis 7 for caching and sessions
- ✅ Database migrations and seeders
- ✅ Repository pattern implementation
- ✅ User and Task entities with relationships
- ✅ Service layer with business logic
- ✅ RESTful API endpoints for Users and Tasks
- ✅ Input validation with express-validator
- ✅ Password hashing with bcryptjs
- ✅ Caching strategy implementation
- ✅ Health checks with database/Redis status

**📚 [View Phase 2 Documentation](docs/PHASE_2_COMPLETE.md)**

### Phase 3: Containerization (Coming Soon)

- Multi-stage Dockerfile
- Docker Compose for local development
- Kubernetes manifests (Deployments, Services, ConfigMaps)
- Helm charts for orchestration

### Phase 4: CI/CD & Automation (Coming Soon)

- GitHub Actions workflows
- Automated testing and linting
- Docker image building and pushing
- Automated deployments

### Phase 5: Monitoring & Observability (Coming Soon)

- Prometheus metrics
- Grafana dashboards
- Logging with ELK stack
- Distributed tracing

## 🛠 Tech Stack

### Core Technologies

- **Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5.x
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL 15 (Phase 2)
- **Caching:** Redis 7 (Phase 2)

### Security & Middleware

- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Compression** - Response compression
- **Morgan** - HTTP request logger
- **Express Validator** - Input validation

### Development Tools

- **TypeScript** - Type safety and modern JavaScript features
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **ts-node-dev** - Development server with hot reload
- **Nodemon** - Process manager

### DevOps (Future Phases)

- Docker & Docker Compose
- Kubernetes & Helm
- GitHub Actions
- Prometheus & Grafana

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

Optional (for future phases):

- **Docker** >= 24.0.0
- **Docker Compose** >= 2.20.0
- **kubectl** (Kubernetes CLI)

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/production-api-framework.git
cd production-api-framework
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` file with your configuration (defaults work for development).

### 4. Start development server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 5. Set up databases (Phase 2)

**Using Docker Compose (Recommended):**
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Run database migrations
npm run migration:run

# Seed development data
npm run seed
```

**Manual Setup:**
```bash
# Install PostgreSQL 15 and Redis 7
# Update .env with your database credentials

# Run migrations
npm run migration:run

# Seed development data
npm run seed
```

### 6. Verify the server is running

Open your browser or use curl:

```bash
# Health check
curl http://localhost:3000/health

# Readiness check (includes database/Redis status)
curl http://localhost:3000/ready

# API info
curl http://localhost:3000/api/v1

# Create a test user (Phase 2)
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Default Credentials (after seeding):**
- Email: `admin@example.com`
- Password: `Password123!`

## 📁 Project Structure

```
production-api-framework/
├── src/
│   ├── api/                    # API endpoints (Phase 2)
│   │   └── v1/
│   │       ├── users/          # User endpoints
│   │       │   ├── user.controller.ts
│   │       │   ├── user.routes.ts
│   │       │   └── user.validator.ts
│   │       └── tasks/          # Task endpoints
│   │           ├── task.controller.ts
│   │           ├── task.routes.ts
│   │           └── task.validator.ts
│   ├── config/                 # Configuration files
│   │   └── environment.ts      # Environment variables configuration
│   ├── controllers/            # Route controllers
│   │   ├── apiController.ts    # API info endpoints
│   │   └── healthController.ts # Health check endpoints
│   ├── core/                   # Core infrastructure (Phase 2)
│   │   ├── cache/
│   │   │   └── redis.config.ts # Redis configuration
│   │   └── database/
│   │       ├── base.repository.ts   # Base repository pattern
│   │       └── data-source.ts       # TypeORM data source
│   ├── middlewares/            # Custom middleware
│   │   ├── errorHandler.ts     # Error handling middleware
│   │   └── validation.middleware.ts # Input validation
│   ├── migrations/             # Database migrations (Phase 2)
│   │   ├── 1702000000000-CreateUsersTable.ts
│   │   └── 1702000000001-CreateTasksTable.ts
│   ├── models/                 # Data models (Phase 2)
│   │   ├── user.entity.ts      # User entity
│   │   ├── task.entity.ts      # Task entity
│   │   └── index.ts            # Export all entities
│   ├── repositories/           # Data access layer (Phase 2)
│   │   ├── user.repository.ts  # User repository
│   │   ├── task.repository.ts  # Task repository
│   │   └── index.ts            # Export all repositories
│   ├── routes/                 # API routes
│   │   ├── apiRoutes.ts        # API v1 routes
│   │   ├── healthRoutes.ts     # Health routes
│   │   └── index.ts            # Main router
│   ├── scripts/                # Utility scripts (Phase 2)
│   │   └── seed-data.ts        # Database seeding
│   ├── services/               # Business logic (Phase 2)
│   │   ├── cache.service.ts    # Caching service
│   │   ├── user.service.ts     # User business logic
│   │   └── task.service.ts     # Task business logic
│   ├── types/                  # TypeScript type definitions
│   │   └── express.d.ts        # Express type extensions
│   ├── utils/                  # Utility functions
│   ├── app.ts                  # Express app setup
│   └── server.ts               # Server entry point
├── docs/                       # Documentation
│   └── PHASE_2_COMPLETE.md     # Phase 2 documentation
├── dist/                       # Compiled JavaScript (generated)
├── node_modules/               # Dependencies (generated)
├── .env                        # Environment variables (create from .env.example)
├── .env.example                # Environment variables template
├── .eslintrc.json              # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── .editorconfig               # Editor configuration
├── .gitignore                  # Git ignore rules
├── .dockerignore               # Docker ignore rules
├── docker-compose.yml          # Docker Compose configuration (Phase 2)
├── tsconfig.json               # TypeScript configuration
├── package.json                # Project dependencies and scripts
├── LICENSE                     # MIT License
└── README.md                   # This file
```

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run type-check       # Run TypeScript type checking

# Building
npm run build            # Compile TypeScript to JavaScript
npm run clean            # Remove dist folder

# Production
npm start                # Start production server (builds first)

# Database (Phase 2)
npm run migration:run    # Run pending migrations
npm run migration:revert # Revert last migration
npm run migration:show   # Show migration status
npm run migration:generate # Generate migration from entities
npm run seed             # Seed development data
npm run db:setup         # Run migrations + seed (one command)

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors automatically
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Testing (Phase 5)
npm test                 # Run tests (not yet implemented)
```

## 🌐 API Endpoints

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint for monitoring |
| GET | `/ready` | Readiness probe with database/Redis status |

### API Information

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and available endpoints |
| GET | `/api/v1` | API v1 information |

### Users (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users` | Create new user |
| GET | `/api/v1/users` | List all users (paginated, filterable) |
| GET | `/api/v1/users/:id` | Get user by ID |
| PUT | `/api/v1/users/:id` | Update user |
| DELETE | `/api/v1/users/:id` | Delete user (soft delete) |
| GET | `/api/v1/users/:id/tasks` | Get user's assigned and created tasks |
| POST | `/api/v1/users/:id/change-password` | Change user password |

### Tasks (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tasks` | Create new task |
| GET | `/api/v1/tasks` | List all tasks (paginated, filterable) |
| GET | `/api/v1/tasks/:id` | Get task by ID |
| PUT | `/api/v1/tasks/:id` | Update task |
| DELETE | `/api/v1/tasks/:id` | Delete task (soft delete) |
| PATCH | `/api/v1/tasks/:id/assign` | Assign task to user |
| PATCH | `/api/v1/tasks/:id/status` | Update task status |

### Example Responses

**GET /health**
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "v1"
}
```

**GET /ready**
```json
{
  "success": true,
  "message": "API is ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "v1",
  "services": {
    "database": {
      "status": "healthy",
      "healthy": true,
      "details": {
        "database": "api_db",
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

**POST /api/v1/users** (Create User)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "User created successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**GET /api/v1/users** (List Users)
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "status": "ACTIVE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## ⚙️ Environment Variables

Create a `.env` file from `.env.example`:

```bash
# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1
APP_NAME=production-api-framework

# Server
HOST=localhost
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database (Phase 2)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=api_db
DB_USER=postgres
DB_PASSWORD=your_db_password_here
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis (Phase 2)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600

# JWT (Phase 2)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Security
HELMET_ENABLED=true
COMPRESSION_ENABLED=true
CORS_ENABLED=true
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined
ENABLE_REQUEST_LOGGING=true
```

See `.env.example` for complete configuration options.

## 🗓 Development Phases

### ✅ Phase 1: Complete Project Foundation
- Project initialization and structure
- TypeScript configuration
- Express server with middleware
- Health check endpoints
- Error handling
- Code quality tools

### ✅ Phase 2: Database & Caching (COMPLETE)
- PostgreSQL integration with TypeORM
- Redis for caching
- User and Task entities
- Repository pattern
- Service layer with business logic
- RESTful API endpoints
- Input validation
- Password hashing
- Database migrations and seeders
- Health checks with database/Redis status

**📚 [View Complete Phase 2 Documentation](docs/PHASE_2_COMPLETE.md)**

### 🔄 Phase 3: Containerization
- Docker multi-stage builds
- Docker Compose setup
- Kubernetes manifests
- Helm charts

### 🔄 Phase 4: CI/CD Pipeline
- GitHub Actions workflows
- Automated testing
- Docker image building
- Deployment automation

### 🔄 Phase 5: Monitoring & Testing
- Unit and integration tests
- Prometheus metrics
- Grafana dashboards
- Logging infrastructure

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Your Name**

- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- TypeScript team for making JavaScript safer
- The Node.js community for amazing tools and libraries

---

**Built with ❤️ for production-ready backend development**

## 🎉 Live Deployment
Application is automatically deployed to AWS EC2 on every push to main.
# Testing deployment - Sun Dec  7 04:29:27 EST 2025
# Ready for deployment
