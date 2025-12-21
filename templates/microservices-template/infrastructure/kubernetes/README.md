# CloudBill Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the CloudBill multi-tenant SaaS billing platform.

## Architecture

The deployment includes:

### Microservices
- **API Gateway** (Port 8080) - Entry point, request routing, rate limiting
- **Auth Service** (Port 3001) - Authentication, OAuth2, session management
- **Billing Service** (Port 3002) - Subscription and invoice management
- **Payment Service** (Port 3003) - Stripe payment processing
- **Notification Service** (Port 3004) - Email, SMS, webhook notifications

### Infrastructure
- **PostgreSQL** - Primary database with Row-Level Security (RLS)
- **Redis** - Session storage and caching
- **NGINX Ingress** - External access with SSL/TLS termination
- **cert-manager** - Automatic TLS certificate management

## Prerequisites

1. **Kubernetes Cluster** (v1.24+)
   - Local: Minikube, Kind, or Docker Desktop
   - Cloud: GKE, EKS, AKS, or any managed Kubernetes

2. **kubectl** installed and configured

3. **NGINX Ingress Controller**
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
   ```

4. **cert-manager** (for TLS certificates)
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

5. **Metrics Server** (for HPA)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

## Quick Start

### 1. Build and Push Docker Images

Build images for all services:

```bash
# From project root
docker build -t cloudbill/api-gateway:latest -f services/api-gateway/Dockerfile .
docker build -t cloudbill/auth-service:latest -f services/auth-service/Dockerfile .
docker build -t cloudbill/billing-service:latest -f services/billing-service/Dockerfile .
docker build -t cloudbill/payment-service:latest -f services/payment-service/Dockerfile .
docker build -t cloudbill/notification-service:latest -f services/notification-service/Dockerfile .

# Push to registry (replace with your registry)
docker push cloudbill/api-gateway:latest
docker push cloudbill/auth-service:latest
docker push cloudbill/billing-service:latest
docker push cloudbill/payment-service:latest
docker push cloudbill/notification-service:latest
```

### 2. Update Secrets

**IMPORTANT:** Update `base/secrets.yaml` with actual base64-encoded credentials:

```bash
# Generate secrets
echo -n 'your-postgres-password' | base64
echo -n 'your-jwt-secret-key' | base64
echo -n 'your-stripe-secret-key' | base64
```

Required secrets to update:
- `postgres-password` - PostgreSQL database password
- `jwt-secret` - JWT signing key (256-bit random string)
- `jwt-refresh-secret` - JWT refresh token key
- `stripe-secret-key` - Stripe API secret key
- `stripe-webhook-secret` - Stripe webhook signing secret
- `google-client-id` / `google-client-secret` - OAuth2 Google credentials
- `github-client-id` / `github-client-secret` - OAuth2 GitHub credentials

### 3. Deploy to Kubernetes

#### Option A: Using kubectl (all at once)

```bash
# Deploy all resources
kubectl apply -f base/

# Verify deployment
kubectl get all -n cloudbill
```

#### Option B: Using kustomize (recommended)

```bash
# Deploy with kustomize
kubectl apply -k base/

# For specific environment
kubectl apply -k overlays/development/
# or
kubectl apply -k overlays/production/
```

#### Option C: Step-by-step deployment

```bash
# 1. Create namespace
kubectl apply -f base/namespace.yaml

# 2. Create secrets and configmaps
kubectl apply -f base/secrets.yaml
kubectl apply -f base/configmap.yaml

# 3. Deploy databases
kubectl apply -f base/postgres.yaml
kubectl apply -f base/redis.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n cloudbill --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n cloudbill --timeout=300s

# 4. Deploy services
kubectl apply -f base/auth-service.yaml
kubectl apply -f base/billing-service.yaml
kubectl apply -f base/payment-service.yaml
kubectl apply -f base/notification-service.yaml

# 5. Deploy API Gateway
kubectl apply -f base/api-gateway.yaml

# 6. Deploy Ingress (requires cert-manager and NGINX ingress)
kubectl apply -f base/ingress.yaml
```

### 4. Run Database Migrations

```bash
# Port-forward to PostgreSQL
kubectl port-forward -n cloudbill service/postgres-service 5432:5432

# In another terminal, run migrations
npm run db:migrate
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n cloudbill

# Check services
kubectl get svc -n cloudbill

# Check HPA status
kubectl get hpa -n cloudbill

# Check ingress
kubectl get ingress -n cloudbill

# View logs
kubectl logs -n cloudbill -l app=api-gateway --tail=50 -f
kubectl logs -n cloudbill -l app=auth-service --tail=50 -f
```

### 6. Access the Application

```bash
# Get ingress IP (for cloud deployments)
kubectl get ingress -n cloudbill

# For local testing with Minikube
minikube service api-gateway -n cloudbill

# Or port-forward
kubectl port-forward -n cloudbill service/api-gateway 8080:8080
```

Access at: `http://localhost:8080` or your configured domain

## Configuration

### Resource Limits

Each service has defined resource requests and limits:

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|------------|-----------|----------------|--------------|
| API Gateway | 100m | 500m | 128Mi | 256Mi |
| Auth Service | 200m | 1000m | 256Mi | 512Mi |
| Billing Service | 200m | 1000m | 256Mi | 512Mi |
| Payment Service | 200m | 1000m | 256Mi | 512Mi |
| Notification Service | 100m | 500m | 128Mi | 256Mi |
| PostgreSQL | 250m | 1000m | 256Mi | 1Gi |
| Redis | 100m | 500m | 128Mi | 512Mi |

Adjust in respective deployment YAML files based on your needs.

### Horizontal Pod Autoscaling (HPA)

All services have HPA configured:

- **API Gateway**: 2-10 replicas (CPU: 70%, Memory: 80%)
- **Auth Service**: 2-8 replicas (CPU: 70%, Memory: 80%)
- **Billing Service**: 2-8 replicas (CPU: 70%, Memory: 80%)
- **Payment Service**: 2-8 replicas (CPU: 70%, Memory: 80%)
- **Notification Service**: 2-6 replicas (CPU: 70%, Memory: 80%)

### Persistent Storage

PostgreSQL and Redis use PersistentVolumes:

- **PostgreSQL**: 10Gi storage at `/mnt/data/postgres`
- **Redis**: 5Gi storage at `/mnt/data/redis`

**Note**: For production, configure StorageClass for your cloud provider:
- GKE: `pd-ssd` or `pd-standard`
- EKS: `gp3` or `gp2`
- AKS: `managed-premium` or `managed`

Update `storageClassName` in PVC manifests accordingly.

## Health Checks

All services expose `/health` endpoint:

- **Liveness Probe**: Detects if pod needs restart
  - Initial delay: 30s
  - Period: 10s
  - Timeout: 5s

- **Readiness Probe**: Detects if pod can receive traffic
  - Initial delay: 10s
  - Period: 5s
  - Timeout: 3s

## Rolling Updates

Deployment strategy configured for zero-downtime updates:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Update images:

```bash
# Update specific service
kubectl set image deployment/auth-service auth-service=cloudbill/auth-service:v2.0 -n cloudbill

# Monitor rollout
kubectl rollout status deployment/auth-service -n cloudbill

# Rollback if needed
kubectl rollout undo deployment/auth-service -n cloudbill
```

## Monitoring

### View Logs

```bash
# Single pod
kubectl logs -n cloudbill <pod-name>

# All pods of a service
kubectl logs -n cloudbill -l app=auth-service --tail=100

# Follow logs
kubectl logs -n cloudbill -l app=api-gateway -f

# Previous crashed container
kubectl logs -n cloudbill <pod-name> --previous
```

### Execute Commands

```bash
# Shell into pod
kubectl exec -it -n cloudbill <pod-name> -- /bin/sh

# Run command
kubectl exec -n cloudbill <pod-name> -- env

# PostgreSQL shell
kubectl exec -it -n cloudbill <postgres-pod> -- psql -U postgres -d cloudbill

# Redis CLI
kubectl exec -it -n cloudbill <redis-pod> -- redis-cli -a <password>
```

### Port Forwarding

```bash
# PostgreSQL
kubectl port-forward -n cloudbill service/postgres-service 5432:5432

# Redis
kubectl port-forward -n cloudbill service/redis-service 6379:6379

# Any service
kubectl port-forward -n cloudbill service/auth-service 3001:3001
```

## Troubleshooting

### Pods not starting

```bash
# Describe pod for events
kubectl describe pod -n cloudbill <pod-name>

# Check if images are pulling
kubectl get events -n cloudbill --sort-by='.lastTimestamp'

# Check resource constraints
kubectl top nodes
kubectl top pods -n cloudbill
```

### Database connection issues

```bash
# Check PostgreSQL logs
kubectl logs -n cloudbill -l app=postgres

# Verify service DNS
kubectl run -it --rm debug --image=busybox --restart=Never -n cloudbill -- nslookup postgres-service

# Test connection
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -n cloudbill -- psql -h postgres-service -U postgres -d cloudbill
```

### HPA not scaling

```bash
# Check metrics server
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# Check HPA status
kubectl describe hpa -n cloudbill

# View metrics
kubectl top pods -n cloudbill
```

## Production Considerations

### Security

1. **Update all secrets** in `base/secrets.yaml`
2. **Enable Network Policies** for pod-to-pod communication
3. **Configure RBAC** for service accounts
4. **Use private container registry**
5. **Scan images** for vulnerabilities
6. **Enable Pod Security Standards**

### High Availability

1. **Multi-zone deployment**: Spread pods across availability zones
   ```yaml
   topologySpreadConstraints:
   - maxSkew: 1
     topologyKey: topology.kubernetes.io/zone
     whenUnsatisfiable: DoNotSchedule
   ```

2. **Database replication**: Use PostgreSQL with replication
3. **Redis Sentinel**: Configure Redis for high availability
4. **Ingress redundancy**: Multiple ingress controller replicas

### Backup & Disaster Recovery

1. **Database backups**:
   ```bash
   # Create CronJob for automated backups
   kubectl create cronjob postgres-backup --image=postgres:15-alpine \
     --schedule="0 2 * * *" -n cloudbill \
     -- pg_dump -h postgres-service -U postgres cloudbill > backup.sql
   ```

2. **PersistentVolume snapshots**: Configure volume snapshot class
3. **Configuration backups**: Version control all manifests

### Monitoring & Observability

Consider adding:
- **Prometheus** for metrics collection
- **Grafana** for visualization
- **ELK/EFK Stack** for log aggregation
- **Jaeger/Zipkin** for distributed tracing

## Cleanup

```bash
# Delete all resources
kubectl delete namespace cloudbill

# Or delete specific resources
kubectl delete -f base/

# Clean up PersistentVolumes (if needed)
kubectl delete pv postgres-pv redis-pv
```

## Directory Structure

```
infrastructure/kubernetes/
├── base/                      # Base manifests
│   ├── namespace.yaml         # Namespace definition
│   ├── secrets.yaml           # Sensitive credentials
│   ├── configmap.yaml         # Configuration data
│   ├── postgres.yaml          # PostgreSQL deployment
│   ├── redis.yaml             # Redis deployment
│   ├── api-gateway.yaml       # API Gateway
│   ├── auth-service.yaml      # Auth Service
│   ├── billing-service.yaml   # Billing Service
│   ├── payment-service.yaml   # Payment Service
│   ├── notification-service.yaml  # Notification Service
│   ├── ingress.yaml           # Ingress + cert-manager
│   └── kustomization.yaml     # Kustomize config
├── overlays/                  # Environment-specific overlays
│   ├── development/           # Dev environment
│   │   └── kustomization.yaml
│   └── production/            # Production environment
│       └── kustomization.yaml
└── README.md                  # This file
```

## Support

For issues or questions:
1. Check pod logs: `kubectl logs -n cloudbill <pod-name>`
2. Review events: `kubectl get events -n cloudbill`
3. Consult CloudBill documentation: `../docs/`
