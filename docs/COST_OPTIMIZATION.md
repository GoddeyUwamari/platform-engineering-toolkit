# AWS Cost Optimization Guide

Complete guide for minimizing AWS costs while using the Platform Engineering Toolkit.

## Table of Contents

- [Free Tier Overview](#free-tier-overview)
- [Development Best Practices](#development-best-practices)
- [Cost Monitoring](#cost-monitoring)
- [Resource Optimization](#resource-optimization)
- [Common Cost Mistakes](#common-cost-mistakes)
- [Cost Comparison](#cost-comparison)

## Free Tier Overview

### What's Included (First 12 Months)

AWS Free Tier includes:

| Service | Free Tier Limit | Equivalent Value |
|---------|-----------------|------------------|
| EC2 t2.micro | 750 hours/month | ~$8.50/month |
| RDS db.t3.micro | 750 hours/month | ~$15/month |
| EBS Storage | 30 GB | ~$3/month |
| Data Transfer | 15 GB outbound | ~$1.35/month |
| CloudWatch | Basic monitoring | ~$3/month |
| **Total** | **All included** | **~$31/month** |

### Key Facts

1. **12-month limit**: Free tier expires 12 months after account creation
2. **One instance**: 750 hours = 1 instance running 24/7 for 31 days
3. **Multiple instances**: 2 instances = 375 hours each (not free tier)
4. **Combined limit**: EBS + RDS storage combined = 30 GB total

### How to Check Free Tier Status

```bash
platform aws status
```

Or check AWS Console:
1. Billing Dashboard
2. Free Tier tab
3. View usage and limits

## Development Best Practices

### 1. Always Use Development Environment

```bash
# ✅ Good - Free tier eligible
platform deploy aws my-service --env development

# ❌ Bad - Costs money
platform deploy aws my-service --env production
```

**Development environment uses:**
- EC2: t2.micro (free tier)
- RDS: db.t3.micro (free tier)

**Production environment uses:**
- EC2: t3.medium ($30/month)
- RDS: db.t3.small ($25/month)

**Savings: ~$55/month**

### 2. Destroy When Not in Use

**Don't leave services running overnight!**

```bash
# At end of workday
platform deploy destroy my-service

# Next morning
platform deploy aws my-service
```

**Savings:**
- 16 hours/day not running = ~$10-15/month
- Weekend shutdown = additional $5-10/month

### 3. Use One Deployment at a Time

**Bad:**
```bash
platform deploy aws service-1
platform deploy aws service-2
platform deploy aws service-3  # 3 EC2 + 3 RDS = $$
```

**Good:**
```bash
platform deploy aws service-1
# Work on it
platform deploy destroy service-1

platform deploy aws service-2
# Work on it
platform deploy destroy service-2
```

**Savings: 66% cost reduction**

### 4. Estimate Before Deploying

Always check costs first:

```bash
platform deploy estimate my-service --env development
```

### 5. Monitor Active Deployments

Weekly check:

```bash
platform aws costs
```

Shows all active deployments and their costs.

## Cost Monitoring

### Track Your Spending

#### CLI Command

```bash
platform aws costs
```

Output:
```
💰 AWS Cost Estimation

Active Deployments:

my-api (development)
  EC2: t2.micro - $8.50/mo
  RDS: db.t3.micro - $12.41/mo
  Storage: $4.30/mo

test-service (development)
  EC2: t2.micro - $8.50/mo
  RDS: db.t3.micro - $12.41/mo
  Storage: $4.30/mo

Total Monthly Cost:
  With Free Tier:    $0/mo
  Without Free Tier: $50.42/mo
```

### AWS Billing Dashboard

Set up billing alerts:

1. Go to AWS Console > Billing
2. Click "Billing preferences"
3. Enable "Receive Billing Alerts"
4. Save preferences
5. Go to CloudWatch > Alarms
6. Create alarm:
   - Metric: EstimatedCharges
   - Threshold: $5 (or your limit)
   - Email: your@email.com

### Free Tier Alerts

Enable in AWS Console:

1. Billing Dashboard
2. Preferences
3. Enable "Receive Free Tier Usage Alerts"
4. Enter email

You'll get notified when:
- Approaching 85% of free tier limit
- Exceeded free tier limit

## Resource Optimization

### 1. Right-Size Instances

Use smallest instance that meets needs:

```bash
# Development/testing
--env development    # t2.micro (free)

# Demo/staging
--env staging        # t2.small ($17/mo)

# Production
--env production     # t3.medium ($30/mo)
```

### 2. Reduce Storage

Default: 20 GB per service

If you need less:

1. Edit `terraform.tfvars` before deploying
2. Set `db_allocated_storage = 10`
3. Set `ec2_root_volume_size = 10`

**Savings: ~$2-3/month per service**

### 3. Use Spot Instances (Advanced)

For non-critical workloads:

Edit Terraform config:
```hcl
resource "aws_instance" "app" {
  instance_market_options {
    market_type = "spot"
  }
}
```

**Savings: 50-70% on EC2 costs**

### 4. Schedule Shutdown (Advanced)

Use AWS Lambda to stop instances overnight:

```python
# Lambda function (runs daily at 6 PM)
import boto3

def lambda_handler(event, context):
    ec2 = boto3.client('ec2')
    rds = boto3.client('rds')

    # Stop EC2
    ec2.stop_instances(InstanceIds=['i-xxxxx'])

    # Stop RDS
    rds.stop_db_instance(DBInstanceIdentifier='my-db')
```

**Savings: ~50% on compute costs**

## Common Cost Mistakes

### Mistake 1: Forgetting to Destroy

**Problem:** Left test deployment running for a month

**Cost:** $30-50/month

**Solution:**
```bash
# Check active deployments
platform aws costs

# Destroy unused ones
platform deploy destroy old-service
```

### Mistake 2: Multiple Deployments

**Problem:** Running 3 services simultaneously

**Cost:** 3x the cost (~$90-150/month)

**Solution:** Deploy one at a time

### Mistake 3: Using Production Environment

**Problem:** Testing with `--env production`

**Cost:** $55/month vs $0/month

**Solution:** Always use `--env development`

### Mistake 4: Data Transfer

**Problem:** Downloading large files from EC2

**Cost:** $0.09/GB after 1 GB

**Solution:**
- Use S3 for large files (cheaper)
- Compress before downloading
- Avoid unnecessary downloads

### Mistake 5: RDS Backups

**Problem:** Long backup retention

**Cost:** $0.095/GB-month for backup storage

**Solution:**
```hcl
# In terraform.tfvars
db_backup_retention_period = 1  # 1 day instead of 7
```

### Mistake 6: Not Using Free Tier

**Problem:** Using t3.small instead of t2.micro

**Cost:** $17/month vs free

**Solution:** Stick with development environment

## Cost Comparison

### Monthly Costs by Environment

#### Development (Free Tier Eligible)
- EC2 t2.micro: **$0** (free tier)
- RDS db.t3.micro: **$0** (free tier)
- Storage (40 GB): **$0** (free tier)
- Data Transfer: **$0** (under limit)
- **Total: $0/month** ✅

#### Staging
- EC2 t2.small: **$17/month**
- RDS db.t3.small: **$25/month**
- Storage (40 GB): **$6/month**
- Data Transfer: **$1/month**
- **Total: $49/month**

#### Production
- EC2 t3.medium: **$30/month**
- RDS db.t3.small: **$25/month**
- Storage (40 GB): **$6/month**
- Data Transfer: **$2/month**
- Multi-AZ: **+50%**
- **Total: $94/month**

### Annual Costs

| Scenario | First Year | After Free Tier |
|----------|-----------|-----------------|
| 1 dev service | $0 | $360 |
| 2 dev services | $360 | $720 |
| 1 staging | $588 | $588 |
| 1 production | $1,128 | $1,128 |

### Cost-Saving Strategies

| Strategy | Annual Savings |
|----------|----------------|
| Use dev environment | $360 |
| Destroy after hours | $180 |
| One service at a time | $360 |
| Reduce storage | $24 |
| Short backup retention | $12 |
| **Total** | **$936/year** |

## Real-World Examples

### Example 1: Student Developer

**Goal:** Learn AWS, build portfolio projects

**Strategy:**
- Use development environment only
- Deploy one project at a time
- Destroy when not actively working
- Keep free tier for 12 months

**Cost:** $0/year ✅

### Example 2: Startup MVP

**Goal:** Build and test MVP for 3 months

**Strategy:**
- Development for testing
- Staging for demos
- Destroy between demo sessions
- Switch to production when ready

**Cost:**
- First 12 months: $150 ($50/month × 3 months staging)
- After free tier: $450

### Example 3: Enterprise Testing

**Goal:** Test infrastructure templates

**Strategy:**
- Development for daily testing
- Destroy nightly via automation
- Production for final validation only

**Cost:**
- First 12 months: $0 (all dev)
- After: $360/year

## Monitoring Tools

### 1. Platform CLI

```bash
# Check current costs
platform aws costs

# Estimate before deploying
platform deploy estimate my-service
```

### 2. AWS Cost Explorer

- View actual spending
- Filter by service
- Download reports

Access: AWS Console > Cost Management > Cost Explorer

### 3. AWS Budgets

Set up budget:
1. AWS Console > Budgets
2. Create budget
3. Set threshold: $10/month
4. Email alerts at 80%, 100%

### 4. Third-Party Tools

- **CloudHealth**: Advanced cost analytics
- **CloudCheckr**: Optimization recommendations
- **Kubecost**: Kubernetes-specific

## Quick Tips

1. **Always estimate first**
   ```bash
   platform deploy estimate my-service
   ```

2. **Check costs weekly**
   ```bash
   platform aws costs
   ```

3. **Destroy when done**
   ```bash
   platform deploy destroy my-service
   ```

4. **Use dev environment**
   ```bash
   platform deploy aws my-service --env development
   ```

5. **One service at a time**
   - Deploy → Test → Destroy → Next

6. **Set billing alerts**
   - Threshold: $5-10/month
   - Email notifications

7. **Review monthly**
   - Check AWS billing dashboard
   - Analyze spending patterns
   - Adjust strategy

## Next Steps

- [Deployment Guide](./AWS_DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [AWS Setup](./AWS_SETUP.md)
