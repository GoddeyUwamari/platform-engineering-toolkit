# AWS Deployment Guide

Complete guide for deploying services to AWS using the Platform Engineering Toolkit CLI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Management](#management)
- [Best Practices](#best-practices)

## Prerequisites

### Required Software

1. **Terraform** (>= 1.5.0)
   ```bash
   # macOS
   brew install terraform

   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/

   # Windows
   choco install terraform

   # Verify installation
   terraform version
   ```

2. **Platform Toolkit CLI** (already installed)
   ```bash
   npm install -g @platform-toolkit/cli
   ```

### AWS Account Setup

1. Create an AWS account at https://aws.amazon.com
2. Note your 12-month free tier eligibility
3. Create IAM credentials (see [AWS_SETUP.md](./AWS_SETUP.md))

## Quick Start

### 1. Configure AWS Credentials

```bash
platform aws configure
```

You'll be prompted for:
- AWS Access Key ID (starts with AKIA...)
- AWS Secret Access Key
- Default Region (e.g., us-east-1)

The CLI will verify your credentials and save them securely.

### 2. Create a Service

```bash
platform create api my-service
cd my-service
```

### 3. Deploy to AWS

```bash
platform deploy aws my-service
```

The deployment will:
1. Validate Terraform configuration
2. Show cost estimate
3. Ask for database password
4. Deploy infrastructure (10-15 minutes)
5. Display application URL

### 4. Check Status

```bash
platform deploy status my-service
```

## Configuration

### AWS Credentials

Check your AWS connection:

```bash
platform aws status
```

Output:
```
✔ Connected to AWS

Account:  815931739526
Region:   us-east-1
User ARN: arn:aws:iam::815931739526:user/platform-user
Config:   /Users/you/.config/platform-toolkit/config.json
```

### Reconfigure AWS

To update credentials:

```bash
platform aws configure
```

## Deployment

### Environment Options

Deploy to different environments with different instance sizes:

```bash
# Development (smallest, free tier)
platform deploy aws my-service --env development

# Staging (medium size)
platform deploy aws my-service --env staging

# Production (larger instances)
platform deploy aws my-service --env production
```

Instance sizes by environment:

| Environment | EC2 Instance | RDS Instance | Free Tier |
|-------------|--------------|--------------|-----------|
| development | t2.micro     | db.t3.micro  | Yes       |
| staging     | t2.small     | db.t3.small  | No        |
| production  | t3.medium    | db.t3.small  | No        |

### Non-Interactive Deployment

Skip prompts with flags:

```bash
platform deploy aws my-service \
  --env development \
  --db-password "SecurePassword123" \
  --yes
```

### What Gets Deployed

Each deployment creates:

1. **VPC** - Isolated network (10.0.0.0/16)
2. **Subnets**
   - 2 public subnets (for EC2)
   - 2 private subnets (for RDS)
3. **EC2 Instance** - Application server
4. **RDS Database** - PostgreSQL
5. **Security Groups** - Firewall rules
6. **Internet Gateway** - External connectivity
7. **Route Tables** - Network routing
8. **CloudWatch** - Monitoring and logs

### Deployment Outputs

After deployment:

```
✅ Deployment Complete!

Application URL:
  http://54.123.45.67:3000

Next steps:
  platform deploy status my-service
  platform deploy logs my-service
  platform deploy destroy my-service (when done)
```

## Management

### Check Deployment Status

```bash
platform deploy status my-service
```

Shows:
- Deployment info (environment, region, timestamp)
- EC2 instance status
- RDS database status
- Application URL

### View Logs

```bash
# View last 50 lines
platform deploy logs my-service

# View last 100 lines
platform deploy logs my-service -n 100

# Follow logs (live streaming)
platform deploy logs my-service -f
```

### Cost Estimation

Before deploying:

```bash
platform deploy estimate my-service --env development
```

Output:
```
📊 Cost Estimate for my-service (development)

Monthly Costs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service         Type           Free Tier    After
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EC2             t2.micro       $0/mo        $8.50/mo
RDS             db.t3.micro    $0/mo        $15.33/mo
Storage         40GB EBS       $0/mo        $6.30/mo
CloudWatch      Basic          $0/mo        $3.00/mo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                          $0/mo        $33.13/mo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Check costs for all deployments:

```bash
platform aws costs
```

### Destroy Deployment

When done testing:

```bash
platform deploy destroy my-service
```

Safety features:
1. Must type service name to confirm
2. Final confirmation required
3. Shows what will be deleted
4. Calculates cost savings

**WARNING:** This permanently deletes:
- EC2 instances
- RDS database (all data lost)
- VPC and networking
- All resources

## Best Practices

### 1. Use Development for Testing

Always test with development environment first:

```bash
platform deploy aws my-service --env development
```

Benefits:
- Free tier eligible
- Smaller instances (faster deployment)
- Lower risk

### 2. Secure Database Passwords

Use strong passwords (minimum 8 characters):

```bash
# Good
--db-password "MyS3cur3P@ssw0rd!"

# Bad
--db-password "password"
```

### 3. Clean Up Unused Resources

Destroy deployments you're not using:

```bash
platform deploy destroy test-service
```

Saves money and reduces clutter.

### 4. Monitor Costs Regularly

Check costs weekly:

```bash
platform aws costs
```

### 5. Use Cost Estimates

Always check costs before deploying:

```bash
platform deploy estimate my-service --env production
```

### 6. Backup Before Destroying

If you have important data:

1. Create RDS snapshot in AWS Console
2. Export data before destroying
3. Never rely on local state only

### 7. Tag Resources Properly

The CLI automatically tags resources with:
- Project name
- Environment
- Managed by Terraform
- Creation timestamp

### 8. Use Environment Variables

For CI/CD, set environment variables:

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

platform deploy aws my-service --yes --db-password "$DB_PASSWORD"
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.

## Cost Optimization

See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for saving money.

## Next Steps

- [AWS Setup Guide](./AWS_SETUP.md) - Detailed AWS account configuration
- [Cost Optimization](./COST_OPTIMIZATION.md) - Save money on AWS
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
