# Production API Infrastructure - Terraform

Complete Terraform infrastructure-as-code for deploying a Node.js/TypeScript API on AWS using free tier resources.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Infrastructure Components](#infrastructure-components)
- [Cost Breakdown](#cost-breakdown)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Post-Deployment](#post-deployment)
- [Management](#management)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Cleanup](#cleanup)

## Overview

This Terraform configuration creates a complete production-ready infrastructure on AWS, including:

- **VPC** with public and private subnets
- **EC2 instance** (t2.micro) for hosting the API
- **RDS PostgreSQL** (db.t3.micro) database
- **Security groups** with least-privilege access
- **IAM roles** for EC2 service access
- **CloudWatch** monitoring and logging

All resources are configured to stay within AWS free tier limits.

## Prerequisites

### Required Software

- ✅ **Terraform** >= 1.5.0 ([Install](https://www.terraform.io/downloads))
- ✅ **AWS CLI** v2 ([Install](https://aws.amazon.com/cli/))
- ✅ **SSH key pair** for EC2 access

### AWS Account Requirements

- ✅ Active AWS account
- ✅ IAM user with appropriate permissions
- ✅ AWS credentials configured locally

### Verify Prerequisites

```bash
# Check Terraform version
terraform version

# Check AWS CLI version
aws --version

# Verify AWS credentials
aws sts get-caller-identity

# Verify SSH key exists
ls -l ~/.ssh/production-api-key.pub
```

## Infrastructure Components

### Networking (vpc.tf)

- **VPC**: 10.0.0.0/16
- **Public Subnet**: 10.0.1.0/24 (EC2 instances)
- **Private Subnets**: 10.0.2.0/24, 10.0.3.0/24 (RDS database)
- **Internet Gateway**: For public internet access
- **Route Tables**: Separate for public and private subnets
- **VPC Endpoint**: S3 endpoint for private subnet access

### Compute (ec2.tf)

- **Instance Type**: t2.micro (free tier)
- **AMI**: Latest Ubuntu 24.04 LTS
- **Storage**: 20GB gp3 EBS volume (encrypted)
- **Pre-installed Software**:
  - Docker and Docker Compose
  - AWS CloudWatch Agent
  - AWS CLI v2
- **Monitoring**: CloudWatch detailed monitoring enabled

### Database (rds.tf)

- **Engine**: PostgreSQL 15.8
- **Instance Class**: db.t3.micro (free tier)
- **Storage**: 20GB gp3 (encrypted)
- **Backup Retention**: 7 days
- **Multi-AZ**: Disabled (free tier)
- **Enhanced Monitoring**: 60-second intervals
- **CloudWatch Alarms**: CPU, storage, and connections

### Security (security-groups.tf)

**EC2 Security Group**:
- Inbound: SSH (22), HTTP (80), HTTPS (443), App (3000)
- Outbound: All traffic

**RDS Security Group**:
- Inbound: PostgreSQL (5432) from EC2 only
- Outbound: None (database doesn't need outbound)

### IAM (iam.tf)

**EC2 Instance Role** with permissions for:
- CloudWatch Agent (metrics and logs)
- Systems Manager (SSM) for remote management
- ECR (pull Docker images)

## Cost Breakdown

### Free Tier Resources (12 months)

| Resource | Free Tier Limit | Configuration | Monthly Cost |
|----------|----------------|---------------|--------------|
| EC2 t2.micro | 750 hours/month | 1 instance | **$0.00** |
| EBS Storage | 30 GB | 20 GB gp3 | **$0.00** |
| RDS db.t3.micro | 750 hours/month | 1 instance | **$0.00** |
| RDS Storage | 20 GB | 20 GB gp3 | **$0.00** |
| VPC | Included | 1 VPC | **$0.00** |
| CloudWatch | 10 metrics, 5GB logs | Basic monitoring | **$0.00** |
| Data Transfer | 100 GB/month out | Varies | **$0.00** |

**Total Monthly Cost**: **$0.00** (within free tier)

### After Free Tier (Month 13+)

| Resource | Estimated Monthly Cost |
|----------|----------------------|
| EC2 t2.micro | ~$8.50 |
| EBS 20GB gp3 | ~$1.60 |
| RDS db.t3.micro | ~$15.00 |
| RDS Storage 20GB | ~$2.30 |
| Data Transfer | ~$9.00 (100GB) |
| **Total** | **~$36.40/month** |

## Project Structure

```
infrastructure/terraform/
├── main.tf              # Provider and backend configuration
├── variables.tf         # Input variable definitions
├── outputs.tf           # Output values
├── vpc.tf              # VPC and networking resources
├── security-groups.tf  # Security group definitions
├── ec2.tf              # EC2 instance configuration
├── rds.tf              # RDS PostgreSQL database
├── iam.tf              # IAM roles and policies
├── terraform.tfvars    # Variable values (DO NOT commit)
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Quick Start

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform

# 2. Update terraform.tfvars with your settings
# CRITICAL: Change the database password!
nano terraform.tfvars

# 3. Initialize Terraform
terraform init

# 4. Preview changes
terraform plan

# 5. Deploy infrastructure
terraform apply

# 6. Save outputs
terraform output > deployment-info.txt
```

## Detailed Setup

### Step 1: Configure Variables

Edit `terraform.tfvars` and update the following:

```hcl
# CRITICAL: Change this password!
db_password = "YourStrongPassword123!"

# SECURITY: Restrict SSH to your IP
allowed_ssh_cidr = "203.0.113.0/32"  # Replace with your IP

# Verify other settings
project_name = "production-api"
environment  = "production"
aws_region   = "us-east-1"
```

### Step 2: Initialize Terraform

```bash
terraform init
```

This downloads required provider plugins and initializes the working directory.

### Step 3: Validate Configuration

```bash
# Check for syntax errors
terraform validate

# Format files consistently
terraform fmt -recursive
```

### Step 4: Review Execution Plan

```bash
terraform plan -out=tfplan.out
```

Review the plan carefully. Terraform will create approximately 30 resources.

### Step 5: Deploy Infrastructure

```bash
# Apply the plan
terraform apply tfplan.out

# Or apply directly (will prompt for confirmation)
terraform apply
```

Deployment takes approximately 10-15 minutes (RDS creation is the longest step).

## Configuration

### Customizing Variables

All variables are defined in `variables.tf` with defaults and validation rules.

**Common Customizations**:

```hcl
# Use a different region
aws_region = "us-west-2"

# Change instance sizes (stay in free tier)
ec2_instance_type = "t2.micro"
rds_instance_class = "db.t3.micro"

# Adjust storage
ec2_root_volume_size = 25  # GB (max 30 for free tier)
db_allocated_storage = 20  # GB (max 20 for free tier)

# Enable/disable features
enable_deletion_protection = true
enable_cloudwatch_logs = true
enable_performance_insights = false
```

### Environment-Specific Configurations

Create separate `.tfvars` files for different environments:

```bash
# Development
terraform apply -var-file="dev.tfvars"

# Staging
terraform apply -var-file="staging.tfvars"

# Production (default)
terraform apply
```

## Deployment

### Output Information

After successful deployment, Terraform outputs critical information:

```bash
# View all outputs
terraform output

# View specific output
terraform output ec2_public_ip
terraform output rds_endpoint

# Save outputs to file
terraform output -json > outputs.json
```

**Key Outputs**:
- `ec2_public_ip`: EC2 instance public IP
- `ssh_command`: Ready-to-use SSH command
- `rds_endpoint`: Database connection endpoint
- `application_url`: Application URL
- `env_variables`: Environment variables for your app

## Post-Deployment

### 1. Connect to EC2 Instance

```bash
# Use the SSH command from outputs
ssh -i ~/.ssh/production-api-key ubuntu@<EC2_PUBLIC_IP>

# Or get it from terraform
$(terraform output -raw ssh_command)
```

### 2. Verify Installation

```bash
# Check Docker
docker --version
docker-compose --version

# Check AWS CLI
aws --version

# Check CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -m ec2 -a query -s
```

### 3. Configure Environment Variables

```bash
# On EC2 instance
cd /opt/production-api

# Copy template
cp .env.template .env

# Edit with actual values
nano .env
```

Set the following variables:

```bash
DB_HOST=<from terraform output: rds_address>
DB_PORT=5432
DB_NAME=api_db
DB_USER=dbadmin
DB_PASSWORD=<your-database-password>
NODE_ENV=production
APP_PORT=3000
```

### 4. Deploy Application

```bash
# Clone your application repository
cd /opt/production-api
git clone <your-repo-url> .

# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 5. Verify Database Connection

```bash
# Install PostgreSQL client (if needed)
sudo apt-get install -y postgresql-client

# Test connection
psql -h <RDS_ENDPOINT> -U dbadmin -d api_db

# Run migrations (from your app directory)
npm run migrate
```

### 6. Test Application

```bash
# From your local machine
curl http://<EC2_PUBLIC_IP>:3000/health

# Or visit in browser
open http://<EC2_PUBLIC_IP>:3000
```

## Management

### Viewing State

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show aws_instance.app_server

# Show current state
terraform show
```

### Updating Infrastructure

```bash
# After modifying .tf files
terraform plan
terraform apply

# Target specific resource
terraform apply -target=aws_instance.app_server
```

### Importing Existing Resources

```bash
# Import existing resource
terraform import aws_instance.app_server i-1234567890abcdef0
```

### Remote State (Recommended for Teams)

Uncomment the backend configuration in `main.tf` and create an S3 bucket:

```bash
# Create S3 bucket for state
aws s3 mb s3://production-api-terraform-state

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Migrate to remote state
terraform init -migrate-state
```

## Security Best Practices

### 1. Restrict SSH Access

```hcl
# In terraform.tfvars
allowed_ssh_cidr = "<YOUR_IP>/32"  # Your IP only
```

### 2. Use Secrets Manager

Store database credentials in AWS Secrets Manager instead of environment variables:

```bash
# Create secret
aws secretsmanager create-secret \
  --name production-api/db-credentials \
  --secret-string '{"username":"dbadmin","password":"YourPassword"}'

# Update EC2 IAM role to allow access (uncomment in iam.tf)
```

### 3. Enable SSL/TLS

```bash
# Install Let's Encrypt on EC2
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d yourdomain.com

# Configure your app to use certificates
```

### 4. Configure Security Groups

```bash
# After setting up SSL, disable HTTP (port 80)
# Update security-groups.tf and remove the HTTP rule
```

### 5. Enable MFA Delete (for S3 backend)

```bash
# Enable versioning and MFA delete on state bucket
aws s3api put-bucket-versioning \
  --bucket production-api-terraform-state \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::ACCOUNT:mfa/USER serial-code"
```

### 6. Regular Updates

```bash
# On EC2 instance
sudo apt-get update
sudo apt-get upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### 1. SSH Connection Refused

```bash
# Check security group allows your IP
aws ec2 describe-security-groups --group-ids <SG_ID>

# Verify key permissions
chmod 400 ~/.ssh/production-api-key

# Check instance is running
aws ec2 describe-instances --instance-ids <INSTANCE_ID>
```

#### 2. Database Connection Failed

```bash
# Verify security group allows EC2 to connect
# From EC2 instance:
telnet <RDS_ENDPOINT> 5432

# Check RDS status
aws rds describe-db-instances --db-instance-identifier production-api-production-postgres
```

#### 3. Terraform Plan Shows Unwanted Changes

```bash
# Refresh state
terraform refresh

# Check for drift
terraform plan -refresh-only
```

#### 4. Resource Creation Failed

```bash
# Check AWS service limits
aws service-quotas list-service-quotas --service-code ec2

# View detailed error logs
terraform apply -parallelism=1
```

#### 5. User Data Script Failed

```bash
# SSH to instance and check logs
ssh -i ~/.ssh/production-api-key ubuntu@<EC2_IP>
sudo cat /var/log/user-data.log
sudo cat /var/log/cloud-init-output.log
```

### Debug Mode

```bash
# Enable debug logging
export TF_LOG=DEBUG
terraform apply

# Save logs to file
export TF_LOG_PATH=./terraform-debug.log
terraform apply
```

### Getting Help

```bash
# Terraform documentation
terraform -help
terraform -help plan

# AWS CLI help
aws ec2 help
aws rds help
```

## Cleanup

### Destroy Infrastructure

**WARNING**: This will permanently delete all resources and data!

```bash
# Preview what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy

# Or destroy specific resources
terraform destroy -target=aws_instance.app_server
```

### Pre-Destruction Checklist

- [ ] Backup database (if needed)
- [ ] Export important data
- [ ] Disable deletion protection: `enable_deletion_protection = false`
- [ ] Take final snapshots
- [ ] Document any manual resources created

### Manual Cleanup

Some resources may require manual cleanup:

```bash
# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /aws/ec2/production-api/production/syslog

# Delete S3 buckets (if any)
aws s3 rb s3://bucket-name --force

# Delete Elastic IPs (if allocated)
aws ec2 release-address --allocation-id eipalloc-xxxxx
```

## Additional Resources

### Terraform Documentation

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)

### AWS Documentation

- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)
- [VPC User Guide](https://docs.aws.amazon.com/vpc/)

### Monitoring and Alerts

- [CloudWatch Dashboards](https://console.aws.amazon.com/cloudwatch/)
- [RDS Performance Insights](https://console.aws.amazon.com/rds/home#performance-insights)

## Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Terraform and AWS documentation
3. Check AWS service health dashboard
4. Review CloudWatch logs for detailed error messages

## License

This infrastructure configuration is part of the production-api-framework project.

---

**Last Updated**: 2025-12-04
**Terraform Version**: >= 1.5.0
**AWS Provider Version**: ~> 5.0
