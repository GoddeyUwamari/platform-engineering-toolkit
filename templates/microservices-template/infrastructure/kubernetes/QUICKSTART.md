# CloudBill Kubernetes - Quick Start Guide

## Prerequisites Checklist

- [ ] Kubernetes cluster running (v1.24+)
- [ ] kubectl installed and configured
- [ ] Docker images built and pushed to registry
- [ ] Secrets updated in `base/secrets.yaml`
- [ ] NGINX Ingress Controller installed
- [ ] cert-manager installed (optional, for TLS)
- [ ] Metrics Server installed (optional, for HPA)

## Quick Deploy

### Using the deployment script (Recommended)

```bash
cd infrastructure/kubernetes

# Deploy to development
./deploy.sh development apply

# Deploy to production
./deploy.sh production apply

# Check status
./deploy.sh base status

# Delete all resources
./deploy.sh base delete
```

### Using kubectl directly

```bash
# Deploy everything at once
kubectl apply -f base/

# Or step by step
kubectl apply -f base/namespace.yaml
kubectl apply -f base/secrets.yaml
kubectl apply -f base/configmap.yaml
kubectl apply -f base/postgres.yaml
kubectl apply -f base/redis.yaml
kubectl apply -f base/auth-service.yaml
kubectl apply -f base/billing-service.yaml
kubectl apply -f base/payment-service.yaml
kubectl apply -f base/notification-service.yaml
kubectl apply -f base/api-gateway.yaml
kubectl apply -f base/ingress.yaml
```

### Using Kustomize

```bash
# Development
kubectl apply -k overlays/development/

# Production
kubectl apply -k overlays/production/
```

## Common Commands

### View Resources

```bash
# All resources
kubectl get all -n cloudbill

# Pods only
kubectl get pods -n cloudbill

# Watch pods
kubectl get pods -n cloudbill -w

# Services
kubectl get svc -n cloudbill

# Ingress
kubectl get ingress -n cloudbill

# HPA status
kubectl get hpa -n cloudbill
```

### View Logs

```bash
# API Gateway
kubectl logs -n cloudbill -l app=api-gateway -f

# Auth Service
kubectl logs -n cloudbill -l app=auth-service -f

# Specific pod
kubectl logs -n cloudbill <pod-name> -f

# Previous crashed container
kubectl logs -n cloudbill <pod-name> --previous
```

### Port Forwarding

```bash
# API Gateway
kubectl port-forward -n cloudbill service/api-gateway 8080:8080

# PostgreSQL
kubectl port-forward -n cloudbill service/postgres-service 5432:5432

# Redis
kubectl port-forward -n cloudbill service/redis-service 6379:6379

# Auth Service
kubectl port-forward -n cloudbill service/auth-service 3001:3001
```

### Exec into Pods

```bash
# Shell into any service
kubectl exec -it -n cloudbill <pod-name> -- /bin/sh

# PostgreSQL shell
kubectl exec -it -n cloudbill <postgres-pod> -- psql -U postgres -d cloudbill

# Redis CLI
kubectl exec -it -n cloudbill <redis-pod> -- redis-cli -a <password>
```

### Debugging

```bash
# Describe pod (shows events)
kubectl describe pod -n cloudbill <pod-name>

# Get events
kubectl get events -n cloudbill --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n cloudbill
kubectl top nodes

# Get pod YAML
kubectl get pod -n cloudbill <pod-name> -o yaml
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment api-gateway -n cloudbill --replicas=5

# Check HPA
kubectl get hpa -n cloudbill
kubectl describe hpa api-gateway-hpa -n cloudbill
```

### Updates & Rollbacks

```bash
# Update image
kubectl set image deployment/auth-service auth-service=cloudbill/auth-service:v2.0 -n cloudbill

# Check rollout status
kubectl rollout status deployment/auth-service -n cloudbill

# Rollout history
kubectl rollout history deployment/auth-service -n cloudbill

# Rollback to previous version
kubectl rollout undo deployment/auth-service -n cloudbill

# Rollback to specific revision
kubectl rollout undo deployment/auth-service --to-revision=2 -n cloudbill

# Restart deployment (rolling restart)
kubectl rollout restart deployment/auth-service -n cloudbill
```

### Secrets Management

```bash
# View secrets (base64 encoded)
kubectl get secret cloudbill-secrets -n cloudbill -o yaml

# Decode specific secret
kubectl get secret cloudbill-secrets -n cloudbill -o jsonpath='{.data.jwt-secret}' | base64 -d

# Update secret
kubectl create secret generic cloudbill-secrets \
  --from-literal=jwt-secret='new-secret-value' \
  --dry-run=client -o yaml | kubectl apply -f -

# Delete and recreate (for multiple updates)
kubectl delete secret cloudbill-secrets -n cloudbill
kubectl apply -f base/secrets.yaml
```

## Database Operations

### Run Migrations

```bash
# Port-forward to PostgreSQL
kubectl port-forward -n cloudbill service/postgres-service 5432:5432 &

# Run migrations from local machine
npm run db:migrate

# Or exec into a service pod and run migrations
kubectl exec -it -n cloudbill <auth-service-pod> -- npm run db:migrate
```

### Backup Database

```bash
# Create backup
kubectl exec -n cloudbill <postgres-pod> -- pg_dump -U postgres cloudbill > backup.sql

# Restore backup
cat backup.sql | kubectl exec -i -n cloudbill <postgres-pod> -- psql -U postgres cloudbill
```

### Access Database

```bash
# Port-forward
kubectl port-forward -n cloudbill service/postgres-service 5432:5432

# Connect using psql from local machine
psql -h localhost -U postgres -d cloudbill

# Or exec into pod
kubectl exec -it -n cloudbill <postgres-pod> -- psql -U postgres -d cloudbill
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status and events
kubectl describe pod -n cloudbill <pod-name>

# Check logs
kubectl logs -n cloudbill <pod-name>

# Check if image exists
kubectl get pod -n cloudbill <pod-name> -o jsonpath='{.spec.containers[0].image}'
```

### Service not accessible

```bash
# Check service endpoints
kubectl get endpoints -n cloudbill

# Check service
kubectl describe service <service-name> -n cloudbill

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -n cloudbill -- nslookup api-gateway
```

### Database connection issues

```bash
# Check PostgreSQL logs
kubectl logs -n cloudbill -l app=postgres

# Check Redis logs
kubectl logs -n cloudbill -l app=redis

# Test connection
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -n cloudbill \
  -- psql -h postgres-service -U postgres -d cloudbill
```

### HPA not working

```bash
# Check metrics server
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# Check HPA
kubectl describe hpa -n cloudbill

# Check metrics
kubectl top pods -n cloudbill
```

## Cleanup

### Delete specific resources

```bash
# Delete deployments
kubectl delete deployment -n cloudbill --all

# Delete services
kubectl delete service -n cloudbill --all

# Delete configmaps
kubectl delete configmap -n cloudbill --all
```

### Delete everything

```bash
# Delete entire namespace (removes all resources)
kubectl delete namespace cloudbill

# Or using script
./deploy.sh base delete
```

## Production Checklist

Before deploying to production:

- [ ] Update all secrets with production values
- [ ] Configure proper domain in ingress.yaml
- [ ] Update email address in ClusterIssuer (cert-manager)
- [ ] Set appropriate resource limits
- [ ] Configure persistent storage class for your cloud provider
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Set up log aggregation (ELK/EFK)
- [ ] Configure backup strategy for databases
- [ ] Enable Network Policies
- [ ] Review and update security settings
- [ ] Test disaster recovery procedures

## Monitoring

### Resource Usage

```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n cloudbill

# Specific pod
kubectl top pod -n cloudbill <pod-name>
```

### Watch Resources

```bash
# Watch all pods
watch kubectl get pods -n cloudbill

# Watch HPA
watch kubectl get hpa -n cloudbill

# Watch events
kubectl get events -n cloudbill -w
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias k='kubectl'
alias kn='kubectl config set-context --current --namespace'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deployments'
alias kl='kubectl logs -f'
alias kx='kubectl exec -it'
alias kcb='kubectl -n cloudbill'
```

## Support

For detailed documentation, see [README.md](./README.md)

For troubleshooting, check the main project documentation in `/docs`
