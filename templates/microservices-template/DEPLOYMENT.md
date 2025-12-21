# CloudBill Production Deployment Guide

This guide covers deploying CloudBill to AWS EKS (Elastic Kubernetes Service) for production workloads.

## Prerequisites

### Required Tools
- AWS CLI v2+ configured with appropriate credentials
- `kubectl` v1.28+
- `eksctl` v0.165+
- Docker v24+
- `helm` v3.12+ (for cert-manager and ingress-nginx)

### Required AWS Resources
- AWS Account with appropriate IAM permissions
- Stripe account with production API keys
- Domain name with DNS management access
- SSL/TLS certificates (or use cert-manager for Let's Encrypt)

### Required Third-Party Services
- **Stripe**: Payment processing (production keys required)
- **OAuth Providers** (optional):
  - Google OAuth Client ID/Secret
  - GitHub OAuth Client ID/Secret

---

## Infrastructure Setup

### 1. Create EKS Cluster

```bash
# Create EKS cluster with managed node group
eksctl create cluster \
  --name cloudbill-prod \
  --region us-east-1 \
  --version 1.28 \
  --nodegroup-name cloudbill-nodes \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# Configure kubectl context
aws eks update-kubeconfig --region us-east-1 --name cloudbill-prod
```

### 2. Provision RDS PostgreSQL

```bash
# Create RDS PostgreSQL instance (Multi-AZ for production)
aws rds create-db-instance \
  --db-instance-identifier cloudbill-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password <SECURE_PASSWORD> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --vpc-security-group-ids <SECURITY_GROUP_ID> \
  --db-subnet-group-name <DB_SUBNET_GROUP> \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00"

# Enable automated backups and point-in-time recovery
aws rds modify-db-instance \
  --db-instance-identifier cloudbill-db \
  --backup-retention-period 30 \
  --apply-immediately
```

**Important:** Note the RDS endpoint - you'll need it for `DB_HOST` environment variable.

### 3. Provision ElastiCache Redis

```bash
# Create Redis replication group (cluster mode disabled)
aws elasticache create-replication-group \
  --replication-group-id cloudbill-redis \
  --replication-group-description "CloudBill Redis Cache" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t3.medium \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token <SECURE_REDIS_PASSWORD> \
  --security-group-ids <SECURITY_GROUP_ID> \
  --cache-subnet-group-name <CACHE_SUBNET_GROUP>
```

**Important:** Note the Redis primary endpoint - you'll need it for `REDIS_HOST` environment variable.

### 4. Network Configuration

Ensure EKS cluster can communicate with RDS and ElastiCache:

1. **Security Groups**: Allow inbound traffic from EKS node security group
   - RDS: Port 5432 (PostgreSQL)
   - ElastiCache: Port 6379 (Redis)

2. **VPC Peering**: If using separate VPCs, configure VPC peering/transit gateway

3. **NAT Gateway**: Required for EKS nodes in private subnets to access internet

---

## Environment Variables

### Critical Secrets (Store in AWS Secrets Manager)

Create secrets in AWS Secrets Manager or Kubernetes secrets:

```bash
# Create AWS Secrets Manager secrets
aws secretsmanager create-secret \
  --name cloudbill/jwt-secret \
  --secret-string "$(openssl rand -base64 64)"

aws secretsmanager create-secret \
  --name cloudbill/jwt-refresh-secret \
  --secret-string "$(openssl rand -base64 64)"

aws secretsmanager create-secret \
  --name cloudbill/db-password \
  --secret-string "<YOUR_RDS_PASSWORD>"

aws secretsmanager create-secret \
  --name cloudbill/redis-password \
  --secret-string "<YOUR_REDIS_PASSWORD>"

aws secretsmanager create-secret \
  --name cloudbill/stripe-secret-key \
  --secret-string "<YOUR_STRIPE_SECRET_KEY>"
```

### Environment Variables by Service

#### All Services (Common)
```bash
NODE_ENV=production
LOG_LEVEL=info

# Database
DB_HOST=<RDS_ENDPOINT>  # e.g., cloudbill-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=cloudbill
DB_USER=postgres
DB_PASSWORD=<FROM_SECRETS_MANAGER>
DB_SSL=true

# Redis
REDIS_HOST=<ELASTICACHE_ENDPOINT>  # e.g., cloudbill-redis.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<FROM_SECRETS_MANAGER>
REDIS_TLS=true
```

#### Auth Service (Port 3001)
```bash
PORT=3001
JWT_SECRET=<FROM_SECRETS_MANAGER>
JWT_REFRESH_SECRET=<FROM_SECRETS_MANAGER>
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
SESSION_SECRET=<GENERATED_SECRET>

# OAuth (Optional)
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback

GITHUB_CLIENT_ID=<YOUR_GITHUB_CLIENT_ID>
GITHUB_CLIENT_SECRET=<YOUR_GITHUB_CLIENT_SECRET>
GITHUB_CALLBACK_URL=https://api.yourdomain.com/auth/github/callback
```

#### Billing Service (Port 3002)
```bash
PORT=3002
JWT_SECRET=<MUST_MATCH_AUTH_SERVICE>
```

#### Payment Service (Port 3003)
```bash
PORT=3003
JWT_SECRET=<MUST_MATCH_AUTH_SERVICE>
STRIPE_SECRET_KEY=<FROM_SECRETS_MANAGER>
STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>
STRIPE_WEBHOOK_SECRET=<FROM_STRIPE_DASHBOARD>
```

#### Notification Service (Port 3004)
```bash
PORT=3004
JWT_SECRET=<MUST_MATCH_AUTH_SERVICE>

# Email (Example: AWS SES)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1

# SMS (Example: Twilio)
TWILIO_ACCOUNT_SID=<YOUR_TWILIO_SID>
TWILIO_AUTH_TOKEN=<YOUR_TWILIO_TOKEN>
TWILIO_PHONE_NUMBER=<YOUR_TWILIO_PHONE>
```

#### API Gateway (Port 8080)
```bash
PORT=8080
AUTH_SERVICE_URL=http://auth-service:3001
BILLING_SERVICE_URL=http://billing-service:3002
PAYMENT_SERVICE_URL=http://payment-service:3003
NOTIFICATION_SERVICE_URL=http://notification-service:3004

CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Database Migration

### 1. Connect to RDS Instance

```bash
# Port-forward or use bastion host
# Option A: Use bastion EC2 instance in same VPC
ssh -i key.pem ec2-user@<BASTION_IP> -L 5432:<RDS_ENDPOINT>:5432

# Option B: Run migration from EKS pod
kubectl run -it --rm postgres-client --image=postgres:15 --restart=Never -- bash
```

### 2. Run Migrations

```bash
# Clone repository in bastion/pod
git clone https://github.com/yourusername/cloudbill.git
cd cloudbill

# Install dependencies
npm install

# Set environment variables
export DB_HOST=<RDS_ENDPOINT>
export DB_PORT=5432
export DB_NAME=cloudbill
export DB_USER=postgres
export DB_PASSWORD=<YOUR_PASSWORD>

# Run migrations
npm run db:migrate

# Verify migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"

# Seed initial data (optional)
npm run db:seed
```

### 3. Verify Row-Level Security

```sql
-- Connect to database
psql -h <RDS_ENDPOINT> -U postgres -d cloudbill

-- Check RLS is enabled on tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Verify policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

---

## Kubernetes Deployment

### 1. Install Required Controllers

```bash
# Install ingress-nginx controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Install cert-manager for automatic SSL certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
```

### 2. Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace cloudbill

# Create secrets from AWS Secrets Manager (recommended)
# Install AWS Secrets Manager CSI driver first

# Or create secrets manually
kubectl create secret generic cloudbill-secrets \
  --from-literal=jwt-secret="<JWT_SECRET>" \
  --from-literal=jwt-refresh-secret="<JWT_REFRESH_SECRET>" \
  --from-literal=db-password="<DB_PASSWORD>" \
  --from-literal=redis-password="<REDIS_PASSWORD>" \
  --from-literal=stripe-secret-key="<STRIPE_SECRET_KEY>" \
  --namespace cloudbill

# Create OAuth secrets
kubectl create secret generic oauth-secrets \
  --from-literal=google-client-id="<GOOGLE_CLIENT_ID>" \
  --from-literal=google-client-secret="<GOOGLE_CLIENT_SECRET>" \
  --from-literal=github-client-id="<GITHUB_CLIENT_ID>" \
  --from-literal=github-client-secret="<GITHUB_CLIENT_SECRET>" \
  --namespace cloudbill
```

### 3. Deploy Services

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/configmaps.yml
kubectl apply -f k8s/auth-deployment.yml
kubectl apply -f k8s/billing-deployment.yml
kubectl apply -f k8s/payment-deployment.yml
kubectl apply -f k8s/notification-deployment.yml
kubectl apply -f k8s/api-gateway-deployment.yml
kubectl apply -f k8s/ingress.yml

# Verify deployments
kubectl get deployments -n cloudbill
kubectl get pods -n cloudbill
kubectl get services -n cloudbill
```

### 4. Verify Service Health

```bash
# Check pod status
kubectl get pods -n cloudbill -w

# Check logs
kubectl logs -f deployment/auth-service -n cloudbill
kubectl logs -f deployment/api-gateway -n cloudbill

# Check service endpoints
kubectl get endpoints -n cloudbill
```

---

## SSL/TLS Certificate Setup

### Option A: Let's Encrypt with cert-manager (Recommended)

```bash
# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Certificate is automatically provisioned via ingress annotations
# See k8s/ingress.yml
```

### Option B: AWS Certificate Manager (ACM)

```bash
# Request certificate in ACM
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Add DNS validation records
# Update ingress to use ACM certificate ARN
```

### Verify SSL Certificate

```bash
# Get ingress IP/hostname
kubectl get ingress -n cloudbill

# Test HTTPS
curl -I https://api.yourdomain.com/health
```

---

## DNS Configuration

```bash
# Get LoadBalancer hostname
kubectl get service ingress-nginx-controller -n ingress-nginx

# Create CNAME record in Route 53 or your DNS provider
# api.yourdomain.com -> <LOADBALANCER_HOSTNAME>
```

---

## Monitoring & Logging

### CloudWatch Logs

```bash
# Install AWS CloudWatch agent
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cwagent/cloudwatch-agent-daemonset.yaml

# View logs in CloudWatch console
# Log group: /aws/eks/cloudbill-prod/containers
```

### Prometheus & Grafana (Recommended)

```bash
# Install kube-prometheus-stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana dashboard
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Default credentials: admin/prom-operator

# Import CloudBill dashboards
# - HTTP metrics (request rate, latency, errors)
# - Database connection pool metrics
# - Redis cache hit rate
# - Payment processing metrics
```

### Application Metrics

Add health check endpoints to all services:

```typescript
// Already implemented in services
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service' });
});

app.get('/metrics', (req, res) => {
  // Prometheus metrics format
});
```

---

## Backup & Disaster Recovery

### RDS Automated Backups

```bash
# Verify automated backups
aws rds describe-db-instances \
  --db-instance-identifier cloudbill-db \
  --query 'DBInstances[0].[BackupRetentionPeriod,PreferredBackupWindow]'

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier cloudbill-db \
  --db-snapshot-identifier cloudbill-db-$(date +%Y%m%d)
```

### Database Restore Procedure

```bash
# Restore from automated backup (point-in-time)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier cloudbill-db \
  --target-db-instance-identifier cloudbill-db-restored \
  --restore-time 2024-01-15T10:00:00Z

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier cloudbill-db-restored \
  --db-snapshot-identifier cloudbill-db-20240115
```

### Application Backup

```bash
# Backup Kubernetes manifests and secrets
kubectl get all -n cloudbill -o yaml > backup/cloudbill-k8s-backup.yaml

# Backup secrets (encrypted)
kubectl get secrets -n cloudbill -o yaml | \
  gpg --encrypt --recipient admin@yourdomain.com > backup/secrets-backup.yaml.gpg
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 2 hours
2. **RPO (Recovery Point Objective)**: 5 minutes (RDS PITR)

**Recovery Steps:**
1. Restore RDS from automated backup/snapshot
2. Update Kubernetes ConfigMap with new RDS endpoint
3. Restart affected pods: `kubectl rollout restart deployment -n cloudbill`
4. Verify data integrity and service health
5. Update DNS if primary region is unavailable

---

## Scaling Configuration

### Horizontal Pod Autoscaling (HPA)

```bash
# Enable metrics server (required for HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# HPA already configured in deployment manifests
# Verify HPA status
kubectl get hpa -n cloudbill

# Expected output:
# NAME                  REFERENCE                        TARGETS   MINPODS   MAXPODS
# api-gateway           Deployment/api-gateway           45%/80%   2         10
# auth-service          Deployment/auth-service          30%/80%   2         5
# billing-service       Deployment/billing-service       25%/80%   2         5
# payment-service       Deployment/payment-service       20%/80%   2         5
```

### Cluster Autoscaling

```bash
# Enable cluster autoscaler
eksctl create iamserviceaccount \
  --cluster=cloudbill-prod \
  --namespace=kube-system \
  --name=cluster-autoscaler \
  --attach-policy-arn=arn:aws:iam::aws:policy/AutoScalingFullAccess \
  --override-existing-serviceaccounts \
  --approve

# Deploy cluster autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Configure autoscaler
kubectl -n kube-system \
  annotate deployment.apps/cluster-autoscaler \
  cluster-autoscaler.kubernetes.io/safe-to-evict="false"

kubectl -n kube-system \
  set image deployment.apps/cluster-autoscaler \
  cluster-autoscaler=registry.k8s.io/autoscaling/cluster-autoscaler:v1.28.0
```

### Database Scaling

```bash
# Vertical scaling: Modify instance class
aws rds modify-db-instance \
  --db-instance-identifier cloudbill-db \
  --db-instance-class db.t3.large \
  --apply-immediately

# Read replicas for read-heavy workloads
aws rds create-db-instance-read-replica \
  --db-instance-identifier cloudbill-db-read-1 \
  --source-db-instance-identifier cloudbill-db \
  --db-instance-class db.t3.medium \
  --publicly-accessible false
```

---

## Security Checklist

### Pre-Deployment Security

- [ ] All secrets stored in AWS Secrets Manager or encrypted Kubernetes secrets
- [ ] JWT secrets are cryptographically secure (64+ bytes random)
- [ ] Database credentials rotated and complex
- [ ] Redis requires authentication (`requirepass` enabled)
- [ ] RDS encryption at rest enabled
- [ ] RDS SSL/TLS connections enforced
- [ ] ElastiCache encryption at rest and in transit enabled
- [ ] Security groups follow principle of least privilege
- [ ] IAM roles use minimum required permissions

### Application Security

- [ ] Row-Level Security (RLS) enabled and tested on all tables
- [ ] SQL injection protection via parameterized queries
- [ ] CORS configured with specific allowed origins (no wildcards)
- [ ] Rate limiting enabled on API Gateway
- [ ] JWT tokens expire within 15 minutes
- [ ] Refresh tokens expire within 7 days
- [ ] Password hashing uses bcrypt with salt rounds ≥ 12
- [ ] OAuth redirect URLs validated against whitelist
- [ ] Stripe webhook signatures verified

### Network Security

- [ ] EKS cluster API endpoint access restricted (private or IP whitelist)
- [ ] Network policies configured to restrict pod-to-pod communication
- [ ] Ingress controller configured with proper security headers
- [ ] TLS 1.2+ enforced (no SSLv3, TLS 1.0, TLS 1.1)
- [ ] WAF (Web Application Firewall) enabled on ALB/CloudFront
- [ ] DDoS protection enabled (AWS Shield Standard minimum)

### Kubernetes Security

- [ ] Pod Security Standards enforced (restricted profile)
- [ ] Service accounts follow least privilege
- [ ] RBAC roles configured with minimal permissions
- [ ] Container images scanned for vulnerabilities
- [ ] No privileged containers in production
- [ ] Resource limits defined for all pods (CPU/memory)
- [ ] Secrets not exposed in environment variables or logs
- [ ] Image pull secrets configured for private registries

### Monitoring & Incident Response

- [ ] CloudWatch alarms configured for critical metrics
- [ ] Error rate alerts configured (> 5% error rate)
- [ ] Latency alerts configured (p99 > 1000ms)
- [ ] Database connection pool alerts configured
- [ ] Failed authentication attempts monitored
- [ ] Stripe webhook failures monitored
- [ ] On-call rotation and escalation policy defined
- [ ] Incident response playbook documented

### Compliance

- [ ] GDPR compliance: User data deletion capability implemented
- [ ] PCI DSS compliance: No card data stored (Stripe handles)
- [ ] Audit logs enabled for sensitive operations
- [ ] Data retention policies configured
- [ ] Privacy policy and terms of service published

---

## Rollout Strategy

### Blue-Green Deployment

```bash
# Deploy new version alongside existing (green deployment)
kubectl apply -f k8s/auth-deployment-v2.yml

# Test new version via separate service
kubectl port-forward svc/auth-service-v2 3001:3001 -n cloudbill

# Switch traffic to new version
kubectl patch service auth-service -n cloudbill \
  -p '{"spec":{"selector":{"version":"v2"}}}'

# Monitor for errors, rollback if needed
kubectl patch service auth-service -n cloudbill \
  -p '{"spec":{"selector":{"version":"v1"}}}'

# Remove old version after successful rollout
kubectl delete deployment auth-service-v1 -n cloudbill
```

### Rolling Update (Default)

```bash
# Update image version
kubectl set image deployment/auth-service \
  auth-service=youracr.azurecr.io/auth-service:v1.2.0 \
  -n cloudbill

# Monitor rollout
kubectl rollout status deployment/auth-service -n cloudbill

# Rollback if issues detected
kubectl rollout undo deployment/auth-service -n cloudbill
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Test all service endpoints
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/auth/health
curl https://api.yourdomain.com/billing/health
curl https://api.yourdomain.com/payment/health
curl https://api.yourdomain.com/notification/health
```

### 2. End-to-End Testing

```bash
# Register new user
curl -X POST https://api.yourdomain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","tenantId":"test-tenant"}'

# Login
curl -X POST https://api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Create subscription (use JWT from login)
curl -X POST https://api.yourdomain.com/billing/subscriptions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"planId":"plan-id","tenantId":"test-tenant"}'
```

### 3. Performance Testing

```bash
# Load test with k6 or Apache Bench
k6 run --vus 100 --duration 30s load-test.js

# Monitor response times and error rates in Grafana
```

### 4. Database Connection Verification

```bash
# Check active connections
kubectl exec -it deployment/auth-service -n cloudbill -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Verify RLS is active
kubectl exec -it deployment/auth-service -n cloudbill -- \
  psql $DATABASE_URL -c "SHOW row_security;"
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor CloudWatch alarms and error rates
- Review application logs for anomalies
- Check Stripe webhook delivery status

**Weekly:**
- Review database performance metrics
- Analyze slow query logs
- Update container images for security patches
- Review autoscaling metrics and adjust if needed

**Monthly:**
- Rotate database credentials
- Review and prune old RDS snapshots
- Audit IAM permissions
- Review and update firewall rules
- Capacity planning based on growth trends

**Quarterly:**
- Disaster recovery drill
- Update Kubernetes cluster version
- Review and update dependencies (npm audit)
- Security assessment and penetration testing

### Upgrade Procedure

```bash
# 1. Backup current state
kubectl get all -n cloudbill -o yaml > backup/pre-upgrade-backup.yaml

# 2. Update dependencies in service
cd services/auth-service
npm update
npm audit fix

# 3. Build and push new image
docker build -t youracr.azurecr.io/auth-service:v1.3.0 .
docker push youracr.azurecr.io/auth-service:v1.3.0

# 4. Update Kubernetes deployment
kubectl set image deployment/auth-service \
  auth-service=youracr.azurecr.io/auth-service:v1.3.0 \
  -n cloudbill

# 5. Monitor rollout
kubectl rollout status deployment/auth-service -n cloudbill

# 6. Verify functionality
./scripts/smoke-test.sh
```

---

## Troubleshooting

### Common Issues

**Pods CrashLooping:**
```bash
# Check logs
kubectl logs -f pod/<POD_NAME> -n cloudbill --previous

# Common causes:
# - Database connection failure (check DB_HOST, credentials)
# - Redis connection failure (check REDIS_HOST, TLS settings)
# - Missing environment variables
# - Port conflicts
```

**Database Connection Timeout:**
```bash
# Verify security group allows traffic from EKS nodes
# Check RDS endpoint is correct
# Test connection from pod
kubectl exec -it deployment/auth-service -n cloudbill -- \
  nc -zv <RDS_ENDPOINT> 5432
```

**Redis Connection Refused:**
```bash
# Verify ElastiCache endpoint
# Check TLS is enabled if required
# Test connection from pod
kubectl exec -it deployment/auth-service -n cloudbill -- \
  redis-cli -h <REDIS_ENDPOINT> -p 6379 --tls -a <PASSWORD> PING
```

**Ingress Not Routing Traffic:**
```bash
# Check ingress status
kubectl describe ingress cloudbill-ingress -n cloudbill

# Verify ingress controller is running
kubectl get pods -n ingress-nginx

# Check service endpoints exist
kubectl get endpoints -n cloudbill
```

**SSL Certificate Not Provisioning:**
```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate status
kubectl describe certificate cloudbill-tls -n cloudbill

# Common issues:
# - DNS not pointing to ingress LoadBalancer
# - Firewall blocking HTTP-01 challenge (port 80)
# - Rate limiting from Let's Encrypt
```

---

## Cost Optimization

### Resource Right-Sizing

```bash
# Analyze actual resource usage
kubectl top pods -n cloudbill

# Adjust resource requests/limits based on actual usage
# Update deployments with optimized values

# Use spot instances for non-critical workloads
eksctl create nodegroup \
  --cluster cloudbill-prod \
  --name spot-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 5 \
  --spot
```

### Database Cost Optimization

```bash
# Use reserved instances for predictable workloads (up to 60% savings)
aws rds purchase-reserved-db-instances-offering \
  --reserved-db-instances-offering-id <OFFERING_ID> \
  --reserved-db-instance-id cloudbill-db-ri

# Enable Performance Insights only if needed
# Use Aurora Serverless v2 for variable workloads (future consideration)
```

### Monitoring Costs

- Set up AWS Budgets to alert on unexpected spend
- Use AWS Cost Explorer to analyze spending trends
- Review CloudWatch Logs retention (reduce to 7-14 days for non-critical logs)

---

## Support & Documentation

- **Architecture Diagram:** See `docs/architecture.md`
- **API Documentation:** See `docs/API.md`
- **Runbook:** See `docs/RUNBOOK.md` (create this)
- **Incident Response:** See `docs/INCIDENT_RESPONSE.md` (create this)

For production incidents, contact:
- **On-Call Engineer:** [PagerDuty/Opsgenie rotation]
- **Escalation:** [Engineering Manager contact]
- **Stripe Support:** https://support.stripe.com/ (for payment issues)
