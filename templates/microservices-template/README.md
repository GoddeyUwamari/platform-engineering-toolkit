# CloudBill - Multi-Tenant SaaS Billing Platform

![Tests](https://github.com/GoddeyUwamari/cloudbill/workflows/CI%2FCD%20-%20Tests/badge.svg)
![Docker Build](https://github.com/GoddeyUwamari/cloudbill/workflows/Docker%20Build%20%26%20Push/badge.svg)
[![codecov](https://codecov.io/gh/GoddeyUwamari/cloudbill/branch/main/graph/badge.svg)](https://codecov.io/gh/GoddeyUwamari/cloudbill)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18.x-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)

> Production-ready multi-tenant SaaS billing platform with microservices architecture, comprehensive testing, and enterprise observability.

**⚡ Quick Stats:**
- 📦 5 Microservices + API Gateway
- ✅ 213 Tests (100% passing)
- 📊 Prometheus + Grafana Monitoring
- 🐳 Docker + Kubernetes Ready
- 🔄 CI/CD with GitHub Actions

---

## 🚀 Features

### Multi-Tenant Architecture
- Row-Level Security (RLS) for data isolation
- Tenant-aware logging and metrics
- Scalable subscription management

### Microservices
- **Auth Service** - JWT authentication, session management (Redis)
- **Billing Service** - Subscriptions, invoices, usage-based metering
- **Payment Service** - Stripe integration, payment methods, refunds
- **Notification Service** - Email (SMTP), SMS (Twilio), webhooks
- **API Gateway** - Request routing, rate limiting, CORS

### Enterprise Observability
- **Prometheus** - Metrics collection from all services
- **Grafana** - 6 dashboards, 18 production alerts
- **Winston** - Structured logging with daily rotation
- Real-time monitoring of business and system metrics

### DevOps & Infrastructure
- **Docker** - Containerized services with multi-stage builds
- **Kubernetes** - Production-ready manifests with Kustomize
- **CI/CD** - Automated testing and Docker builds (GitHub Actions)
- **Terraform** - Infrastructure as Code

---

## 🛠 Tech Stack

**Backend:**
- Node.js 18+ with TypeScript 5.x
- Express.js for REST APIs
- PostgreSQL 14 with Row-Level Security
- Redis 7 for sessions and caching

**Testing:**
- Jest with 213 automated tests
- Supertest for integration testing
- Mock implementations for external services

**Monitoring:**
- Prometheus for metrics
- Grafana for visualization
- Winston for structured logging

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes with Kustomize
- GitHub Actions for CI/CD
- Terraform for cloud provisioning

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 7+

### Local Development
```bash
# Clone the repository
git clone https://github.com/GoddeyUwamari/cloudbill.git
cd cloudbill

# Install dependencies
npm install

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Start all services
docker-compose up -d

# Verify all services are healthy
docker-compose ps

# Run tests
npm test
```

### Access Services

- **API Gateway**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Demo Credentials
```
Email: admin@democompany.com
Password: Admin123!
Tenant ID: 00000000-0000-0000-0000-000000000001
```

---

## 📊 Monitoring

### Grafana Dashboards

Access Grafana at http://localhost:3000 (admin/admin)

**Available Dashboards:**
1. System Overview - Cross-service health and performance
2. API Gateway - Traffic, latency, error rates
3. Auth Service - Login metrics, token generation
4. Billing Service - Subscriptions, invoices, usage
5. Payment Service - Transaction volumes, success rates
6. Notification Service - Email/SMS/webhook delivery

### Prometheus Metrics

All services expose metrics at `/metrics` endpoint:
- HTTP request metrics (count, duration, active connections)
- Database query performance
- Redis operation latency
- Business metrics (subscriptions, payments, notifications)

### Generate Test Traffic
```bash
# Test authentication and generate metrics
for i in {1..50}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001" \
    -d '{"email":"admin@democompany.com","password":"Admin123!"}'
  sleep 0.5
done
```

Watch metrics populate in Grafana in real-time!

---

## 🔧 Architecture
```
CloudBill Platform
├─ API Gateway (Port 8080)
│  ├─ Request routing & proxying
│  ├─ Rate limiting (Redis-based)
│  ├─ CORS & security headers
│  └─ Health check aggregation
│
├─ Auth Service (Port 3001)
│  ├─ JWT authentication
│  ├─ Session management (Redis)
│  ├─ User registration & login
│  └─ Password reset flows
│
├─ Billing Service (Port 3002)
│  ├─ Subscription management
│  ├─ Invoice generation
│  ├─ Usage-based metering
│  └─ Multi-tier pricing plans
│
├─ Payment Service (Port 3003)
│  ├─ Stripe integration
│  ├─ Payment method management
│  ├─ Refund processing
│  └─ Webhook handling
│
├─ Notification Service (Port 3004)
│  ├─ Email (SMTP/Nodemailer)
│  ├─ SMS (Twilio)
│  ├─ Webhook delivery
│  └─ Template management
│
├─ PostgreSQL (Port 5433)
│  ├─ Multi-tenant with RLS
│  ├─ Production & test databases
│  └─ Automated migrations
│
├─ Redis (Port 6380)
│  ├─ Session storage
│  ├─ Rate limiting
│  └─ Caching layer
│
└─ Monitoring Stack
   ├─ Prometheus (Port 9090)
   ├─ Grafana (Port 3000)
   └─ 18 production alerts
```

---

## 🧪 Testing

### Run All Tests
```bash
# All 213 tests
npm test

# With coverage report
npm run test:coverage

# Specific service
cd services/auth-service && npm test
cd services/billing-service && npm test
cd services/payment-service && npm test
cd services/notification-service && npm test
```

### Test Coverage
```
┌────────────────────────┬───────┬─────────┬──────────┐
│ Service                │ Tests │ Passing │ Coverage │
├────────────────────────┼───────┼─────────┼──────────┤
│ Auth Service           │  34   │   34    │   100%   │
│ Billing Service        │  80   │   80    │   100%   │
│ Payment Service        │  69   │   69    │   100%   │
│ Notification Service   │  30   │   30    │   100%   │
├────────────────────────┼───────┼─────────┼──────────┤
│ TOTAL                  │ 213   │  213    │   100%   │
└────────────────────────┴───────┴─────────┴──────────┘
```

---

## 🚢 Deployment

### Docker Compose (Development)
```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f api-gateway

# Stop all services
docker-compose down
```

### Kubernetes (Production)
```bash
# Deploy to development environment
kubectl apply -k infrastructure/kubernetes/overlays/dev/

# Deploy to production
kubectl apply -k infrastructure/kubernetes/overlays/production/

# Verify deployment
kubectl get pods -n cloudbill
kubectl get services -n cloudbill

# Access services (port-forward)
kubectl port-forward svc/api-gateway 8080:8080 -n cloudbill
```

---

## 📡 API Documentation

### Authentication
```bash
# Login
POST http://localhost:8080/api/auth/login
Content-Type: application/json
X-Tenant-ID: 00000000-0000-0000-0000-000000000001

{
  "email": "admin@democompany.com",
  "password": "Admin123!"
}

# Response
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "role": "SUPER_ADMIN" },
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

### Subscriptions
```bash
# Create subscription
POST http://localhost:8080/api/billing/subscriptions
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>

{
  "planId": "professional",
  "paymentMethodId": "pm_..."
}
```

### Payments
```bash
# Create payment
POST http://localhost:8080/api/payments/create
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>

{
  "amount": 2999,
  "currency": "usd",
  "paymentMethodId": "pm_..."
}
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting
- 100% test coverage for new features
- Meaningful commit messages

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Goddey Uwamari**
- GitHub: [@GoddeyUwamari](https://github.com/GoddeyUwamari)
- LinkedIn: [Goddey Uwamari](https://linkedin.com/in/goddeyuwamari)

---

## 🙏 Acknowledgments

Built with:
- [Express.js](https://expressjs.com/) - Web framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Caching & sessions
- [Stripe](https://stripe.com/) - Payment processing
- [Prometheus](https://prometheus.io/) - Metrics
- [Grafana](https://grafana.com/) - Visualization
- [Docker](https://www.docker.com/) - Containerization
- [Kubernetes](https://kubernetes.io/) - Orchestration

---

**⭐ If you find this project useful, please consider giving it a star!**
