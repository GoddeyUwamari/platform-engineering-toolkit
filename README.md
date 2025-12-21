# 🚀 Platform Engineering Toolkit

> Self-service platform for creating production-ready services in minutes

## 🎯 What is This?

A CLI tool and template library that enables developers to create new services using battle-tested, production-ready templates. Think "create-react-app" but for backend services and microservices.

## ✨ Features

- 🎨 **Multiple Templates** - API services, microservices architectures
- ��️ **Production-Ready** - Docker, Kubernetes, CI/CD included
- 📦 **Zero Config** - Works out of the box
- 🚀 **Fast** - Create new service in 30 seconds
- 🔧 **Customizable** - Modify templates to fit your needs

## 📦 Installation
```bash
cd cli
npm install
npm link
```

## 🚀 Quick Start

### List Available Templates
```bash
platform list
```

### Create New Service
```bash
# Create a Node.js/TypeScript API
platform create api my-awesome-api

# Create microservices architecture
platform create microservices my-saas-platform
```

### Next Steps
```bash
cd my-awesome-api
npm install
npm run dev
```

## 📋 Available Templates

### 1. Node.js/TypeScript API (`api`)

Production-ready REST API with:
- ✅ TypeScript + Express
- ✅ PostgreSQL + TypeORM
- ✅ Redis caching
- ✅ Docker + Docker Compose
- ✅ Kubernetes manifests
- ✅ Complete CI/CD pipeline
- ✅ Health checks & monitoring
- ✅ Terraform AWS deployment

**Perfect for:** REST APIs, backend services, monolithic applications

### 2. Microservices Architecture (`microservices`)

Enterprise SaaS platform with:
- ✅ 5 microservices (Auth, Billing, Payment, Notification, API Gateway)
- ✅ Multi-tenant architecture
- ✅ Prometheus + Grafana monitoring
- ✅ 213 automated tests
- ✅ Kubernetes deployment (Kustomize)
- ✅ Event-driven architecture
- ✅ Shared utilities library

**Perfect for:** SaaS platforms, complex systems, scalable architectures

## 🏗️ Project Structure
```
platform-engineering-toolkit/
├── cli/                    # CLI tool
│   ├── index.js           # Main CLI logic
│   └── package.json
├── templates/             # Service templates
│   ├── node-api-template/
│   └── microservices-template/
├── portal/                # Web UI (coming soon)
├── api/                   # Backend API (coming soon)
└── docs/                  # Documentation
```

## 🎯 Use Cases

### For Developers

- Quickly prototype new services
- Start new projects with best practices
- Learn production-grade architectures

### For Teams

- Standardize service creation
- Enforce architectural patterns
- Reduce time-to-production

### For Learning

- Study production code
- Understand microservices
- See DevOps in action

## 🛠️ Technology Stack

### Templates Include:
- **Languages:** TypeScript, Node.js
- **Frameworks:** Express.js
- **Databases:** PostgreSQL, Redis
- **Containerization:** Docker, Docker Compose
- **Orchestration:** Kubernetes, Kustomize
- **CI/CD:** GitHub Actions
- **Infrastructure:** Terraform (AWS)
- **Monitoring:** Prometheus, Grafana, CloudWatch
- **Testing:** Jest

## 📚 Template Details

### API Template Features
```
✅ RESTful API architecture
✅ TypeScript strict mode
✅ Database migrations
✅ Repository pattern
✅ Caching layer
✅ Error handling
✅ Request validation
✅ Security middleware
✅ Health checks
✅ Production Docker build
✅ K8s deployment manifests
✅ CI/CD workflows
✅ AWS Terraform configs
```

### Microservices Template Features
```
✅ 5 production microservices
✅ API Gateway with routing
✅ Authentication & sessions
✅ Billing & subscriptions
✅ Payment processing (Stripe)
✅ Notifications (Email, SMS, Webhooks)
✅ Multi-tenant data isolation
✅ Prometheus metrics
✅ Grafana dashboards
✅ 213 automated tests
✅ Kubernetes deployment
✅ Event-driven architecture
```

## 🚀 Roadmap

### Phase 1: CLI Tool ✅ (Complete)
- [x] Template copying
- [x] Basic CLI commands
- [x] Two production templates

### Phase 2: Web Portal (In Progress)
- [ ] Service catalog browser
- [ ] One-click service creation
- [ ] Deployment status tracking
- [ ] Resource usage metrics

### Phase 3: Platform API
- [ ] REST API for automation
- [ ] GitHub integration
- [ ] CI/CD orchestration
- [ ] Service registry

### Phase 4: Advanced Features
- [ ] Custom template creation
- [ ] Template marketplace
- [ ] Cost estimation
- [ ] Policy enforcement

## 🤝 Contributing

This is a portfolio/learning project, but suggestions welcome!

## 📝 License

MIT

## 👤 Author

**Goddey Uwamari**
- GitHub: [@GoddeyUwamari](https://github.com/GoddeyUwamari)

## 🎓 Learning Resources

This toolkit is built using patterns from:
- Production-grade microservices architecture
- Enterprise DevOps practices
- Cloud-native development
- Platform engineering principles

Perfect for learning:
- Microservices architecture
- Kubernetes deployment
- CI/CD automation
- Infrastructure as Code
- Platform engineering

---

**Built with 💙 to accelerate developer productivity**
