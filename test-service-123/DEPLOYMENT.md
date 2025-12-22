# Complete Deployment Guide

## 🚀 From Zero to Production in 30 Minutes

This guide walks you through deploying the entire stack from scratch.

---

## Prerequisites Checklist

- [ ] Docker installed
- [ ] kubectl installed
- [ ] GitHub account configured
- [ ] Kubernetes cluster access (or Minikube)
- [ ] Domain name (optional for local testing)

---

## Step 1: Local Development (5 minutes)

```bash
# Clone repository
git clone https://github.com/GoddeyUwamari/production-api-framework.git
cd production-api-framework

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start with Docker Compose
docker-compose up -d postgres redis

# Run migrations
npm run migration:run

# Seed database
npm run seed

# Start development server
npm run dev

# Test locally
curl http://localhost:3000/health
```

**Result:** Application running locally on http://localhost:3000

---

## Step 2: Docker Production Build (5 minutes)

```bash
# Build production image
docker build -f infrastructure/docker/Dockerfile -t production-api:latest .

# Verify image size (should be ~150-200MB)
docker images production-api:latest

# Start full production stack
docker-compose -f docker-compose.prod.yml up -d --build

# Scale to 5 replicas
docker-compose -f docker-compose.prod.yml up -d --scale api=5

# Test load-balanced setup
for i in {1..10}; do curl http://localhost/health; done

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

**Result:** Production-like environment running with load balancer

---

## Step 3: Setup GitHub Actions (5 minutes)

```bash
# Push to GitHub (if not already)
git remote add origin https://github.com/YOUR_USERNAME/production-api-framework.git
git push -u origin main

# Go to GitHub Actions tab
# https://github.com/YOUR_USERNAME/production-api-framework/actions

# Watch CI pipeline run:
# ✅ Code Quality
# ✅ Build
# ✅ Tests
# ✅ Security Scan
# ✅ Docker Build

# Push to main triggers:
git push origin main
# - CI Pipeline
# - Docker Build & Push to ghcr.io
```

**Result:** Automated CI/CD pipeline running

---

## Step 4: Kubernetes Staging Deployment (10 minutes)

### Option A: Minikube (Local)

```bash
# Start Minikube
minikube start --cpus=4 --memory=8192

# Enable ingress
minikube addons enable ingress
minikube addons enable metrics-server

# Create namespace
kubectl create namespace production-api-staging

# Create secrets
kubectl create secret generic production-api-secrets \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=staging_password \
  --from-literal=REDIS_PASSWORD=redis_staging \
  --from-literal=JWT_SECRET=jwt_staging_secret \
  --from-literal=JWT_REFRESH_SECRET=refresh_staging_secret \
  -n production-api-staging

# Deploy application
kubectl apply -k infrastructure/kubernetes/staging/

# Wait for deployment
kubectl rollout status deployment/staging-production-api -n production-api-staging

# Get services
kubectl get all -n production-api-staging

# Port forward to test
kubectl port-forward -n production-api-staging svc/staging-production-api-service 8080:80

# Test
curl http://localhost:8080/health
```

### Option B: Cloud Kubernetes (AWS EKS/GCP GKE)

```bash
# Configure kubectl for your cluster
aws eks update-kubeconfig --name your-cluster-name
# or
gcloud container clusters get-credentials your-cluster-name --zone your-zone

# Follow same steps as Minikube option
```

**Result:** Application running in Kubernetes

---

## Step 5: Production Deployment (5 minutes)

```bash
# Setup GitHub Secrets first:
# Go to: https://github.com/YOUR_USERNAME/production-api-framework/settings/secrets/actions
# Add all production secrets (see docs/PHASE_2.5_COMPLETE.md)

# Create production namespace
kubectl create namespace production-api-production

# Create secrets
kubectl create secret generic production-api-secrets \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=production_password \
  --from-literal=REDIS_PASSWORD=redis_production \
  --from-literal=JWT_SECRET=jwt_production_secret \
  --from-literal=JWT_REFRESH_SECRET=refresh_production_secret \
  -n production-api-production

# Deploy to production
kubectl apply -k infrastructure/kubernetes/production/

# Watch rollout
kubectl rollout status deployment/prod-production-api -n production-api-production

# Verify
kubectl get all -n production-api-production
```

**Or use GitHub Actions:**

```bash
# Create release tag
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Go to GitHub Actions
# Approve production deployment
# Watch automated deployment
```

**Result:** Application running in production

---

## Step 6: Verify Deployment (2 minutes)

```bash
# Run smoke tests
./scripts/smoke-test.sh https://your-domain.com

# Run health check
./scripts/health-check.sh production

# Run load test
./scripts/load-test.sh https://your-domain.com 1000 10
```

**Result:** All tests passing

---

## Step 7: Monitoring (Optional, 3 minutes)

```bash
# Watch pods
kubectl get pods -n production-api-production -w

# View logs
kubectl logs -f -n production-api-production -l app=production-api

# Check HPA
kubectl get hpa -n production-api-production

# Describe deployment
kubectl describe deployment prod-production-api -n production-api-production
```

---

## Common Commands Quick Reference

### Docker
```bash
# Build
docker build -f infrastructure/docker/Dockerfile -t production-api:latest .

# Run locally
docker run -p 3000:3000 production-api:latest

# Docker Compose
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml logs -f
```

### Kubernetes
```bash
# Deploy
kubectl apply -k infrastructure/kubernetes/staging/
kubectl apply -k infrastructure/kubernetes/production/

# Status
kubectl get all -n production-api-staging
kubectl rollout status deployment/staging-production-api -n production-api-staging

# Logs
kubectl logs -f -n production-api-staging -l app=production-api

# Execute commands
kubectl exec -it -n production-api-staging <pod-name> -- npm run migration:run

# Rollback
kubectl rollout undo deployment/staging-production-api -n production-api-staging
```

### Scripts
```bash
# Health check
./scripts/health-check.sh staging

# Smoke tests
./scripts/smoke-test.sh https://staging-api.yourdomain.com

# Load test
./scripts/load-test.sh https://staging-api.yourdomain.com 1000 10

# Rollback
./scripts/rollback.sh staging
```

---

## Troubleshooting

### Issue: Pods not starting

**Solution:**
```bash
kubectl describe pod <pod-name> -n production-api-staging
kubectl logs <pod-name> -n production-api-staging
```

Common causes:
- Missing secrets
- Image pull errors
- Resource constraints

### Issue: Can't access application

**Solution:**
```bash
# Check service
kubectl get svc -n production-api-staging

# Check ingress
kubectl get ingress -n production-api-staging
kubectl describe ingress -n production-api-staging

# Port forward for testing
kubectl port-forward -n production-api-staging svc/staging-production-api-service 8080:80
curl http://localhost:8080/health
```

### Issue: Database connection fails

**Solution:**
```bash
# Check database service
kubectl get svc postgres-service -n production-api-staging

# Test connection from pod
kubectl exec -it -n production-api-staging <pod-name> -- sh
nc -zv postgres-service 5432
```

---

## Production Checklist

Before going to production, ensure:

- [ ] All secrets configured in GitHub
- [ ] Database backups configured
- [ ] Monitoring set up
- [ ] DNS configured correctly
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting configured
- [ ] HPA tested
- [ ] Rollback procedure tested
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment process

---

## Next Steps

1. **Monitoring:** Set up Prometheus + Grafana
2. **Logging:** Configure ELK stack
3. **Alerting:** Set up PagerDuty/Opsgenie
4. **Backups:** Automate database backups
5. **CDN:** Configure CloudFlare/CloudFront
6. **Performance:** Tune database queries
7. **Security:** Regular security audits

---

## Support

**Documentation:**
- [Phase 2.5 Complete Guide](docs/PHASE_2.5_COMPLETE.md)
- [Phase 2 Database Setup](docs/PHASE_2_COMPLETE.md)

**Issues:**
- GitHub Issues: https://github.com/GoddeyUwamari/production-api-framework/issues

---

**Total Deployment Time:** ~30 minutes (excluding DNS propagation)

**Success!** 🎉 Your application is now running in production with full CI/CD automation.
