# AWS Deployment Quick Start

Get your first service deployed to AWS in under 20 minutes.

## Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] Platform CLI installed (`npm link` in cli directory)
- [ ] Terraform installed (`brew install terraform`)
- [ ] AWS account created (https://aws.amazon.com)
- [ ] AWS IAM user created with access keys

## Step-by-Step Walkthrough

### Step 1: Configure AWS (5 minutes)

**1.1. Get your AWS credentials:**

1. Log in to AWS Console
2. Go to IAM > Users > Create user
3. Username: `platform-toolkit-user`
4. Attach policy: `AdministratorAccess`
5. Create user
6. Security credentials > Create access key
7. Use case: CLI
8. Save credentials:
   - Access Key ID: `AKIA...`
   - Secret Access Key: `xxx...`

**1.2. Configure CLI:**

```bash
platform aws configure
```

Enter:
```
? AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
? AWS Secret Access Key: ****************************************
? Default Region: us-east-1
? Confirm configuration? Yes
```

**1.3. Verify connection:**

```bash
platform aws status
```

Expected output:
```
✔ Connected to AWS

Account:  123456789012
Region:   us-east-1
User ARN: arn:aws:iam::123456789012:user/platform-toolkit-user
```

✅ **Checkpoint:** AWS credentials configured and verified

---

### Step 2: Create Your Service (30 seconds)

```bash
platform create api my-first-api
cd my-first-api
```

Output:
```
✔ Service files created

✅ Success!

📦 Local: /path/to/my-first-api

Next steps:
  cd my-first-api
  npm install
  npm run dev
```

✅ **Checkpoint:** Service created locally

---

### Step 3: Estimate Costs (30 seconds)

```bash
platform deploy estimate my-first-api
```

Output:
```
📊 Cost Estimate for my-first-api (development)

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

Free Tier Notes:
  • 750 hours/month EC2 t2.micro (first 12 months)
  • 750 hours/month RDS db.t3.micro (first 12 months)
  • 30 GB storage (combined EBS + RDS)
```

**Great news!** This will cost $0/month if you're within the free tier.

✅ **Checkpoint:** Cost estimated at $0 (free tier)

---

### Step 4: Deploy to AWS (15 minutes)

```bash
platform deploy aws my-first-api
```

**Interactive prompts:**

```
☁️  Deploying my-first-api to AWS

? Database password (min 8 characters): ••••••••••••

Configuration:
  Environment: development
  EC2: t2.micro
  RDS: db.t3.micro
  Region: us-east-1

Estimated Monthly Cost:
  With Free Tier:    $0/mo
  Without Free Tier: $33.13/mo

? Proceed with deployment? Yes
```

**Deployment process:**

```
✔ Initializing Terraform...
✔ Planning infrastructure...
✔ Deploying infrastructure (this may take 10-15 minutes)...

  [Progress updates from Terraform]
  Creating VPC...
  Creating subnets...
  Launching EC2 instance...
  Creating RDS database... (this is the slow part)
  Configuring security groups...

✔ Retrieving deployment information...
✔ Deployment complete!

✅ Deployment Complete!

Application URL:
  http://54.123.45.67:3000

Next steps:
  platform deploy status my-first-api
  platform deploy logs my-first-api
  platform deploy destroy my-first-api (when done)
```

✅ **Checkpoint:** Service deployed to AWS!

---

### Step 5: Verify Deployment (2 minutes)

**5.1. Check deployment status:**

```bash
platform deploy status my-first-api
```

Output:
```
📊 Deployment Status: my-first-api

Deployment Info:
  Environment: development
  Region: us-east-1
  Deployed: 12/23/2025, 2:30:00 PM
  Deployed By: YourGitHubUsername

Infrastructure:
  ✅ EC2: i-0abc123def456 (t2.micro, running)
     URL: http://54.123.45.67:3000
  ✅ RDS: my-first-api-db (db.t3.micro, available)
```

**5.2. Check AWS Console:**

1. Go to AWS Console
2. EC2 > Instances - See your instance running
3. RDS > Databases - See your database available
4. VPC > Your VPCs - See new VPC created

**5.3. Test the URL (optional):**

```bash
curl http://54.123.45.67:3000/health
```

Note: The application may not respond yet (needs to be deployed/started on EC2)

✅ **Checkpoint:** Infrastructure verified in AWS

---

### Step 6: View Costs (30 seconds)

```bash
platform aws costs
```

Output:
```
💰 AWS Cost Estimation

Active Deployments:

my-first-api (development)
  EC2: t2.micro - $8.50/mo
  RDS: db.t3.micro - $12.41/mo
  Storage: $4.30/mo

Total Monthly Cost:
  With Free Tier:    $0/mo
  Without Free Tier: $25.21/mo

Note: Costs are estimates. Check AWS Console for actual usage.
Free tier expires 12 months after AWS account creation.
```

✅ **Checkpoint:** Current costs: $0 (free tier)

---

### Step 7: Clean Up (5 minutes)

**Important:** Always destroy resources you're not using to avoid charges!

```bash
platform deploy destroy my-first-api
```

**Interactive prompts:**

```
⚠️  WARNING: Resource Destruction

This will permanently delete all AWS resources for "my-first-api":
  • EC2 instances
  • RDS database (DATA WILL BE LOST)
  • VPC and networking
  • Security groups

? Type service name to confirm: my-first-api
? Are you absolutely sure? Yes

✔ Destroying resources...

  [Terraform destroying resources]
  Destroying EC2 instance...
  Destroying RDS database...
  Destroying VPC...
  Destroying security groups...

✔ All resources destroyed

✅ Cleanup Complete

Estimated monthly savings:
  $33.13/mo
```

**Verify cleanup:**

```bash
# Check CLI
platform aws costs
# Should show: No active deployments

# Check AWS Console
# - No EC2 instances (except any you had before)
# - No RDS databases (except any you had before)
# - Only default VPC remains
```

✅ **Checkpoint:** Resources cleaned up, no ongoing costs

---

## Congratulations! 🎉

You've successfully:

- ✅ Configured AWS credentials
- ✅ Created a service from template
- ✅ Estimated deployment costs
- ✅ Deployed to AWS ($0 with free tier)
- ✅ Verified the deployment
- ✅ Cleaned up resources

## Next Steps

### Deploy with GitHub Integration

```bash
# Create service with GitHub repo
platform create api my-api --github
cd my-api

# Deploy to AWS
platform deploy aws my-api

# Now you have:
# ✅ Code on GitHub
# ✅ Infrastructure on AWS
```

### Deploy Different Environments

```bash
# Development (free tier)
platform deploy aws my-api --env development

# Staging (small instances)
platform deploy aws my-api --env staging

# Production (larger instances)
platform deploy aws my-api --env production
```

### Work with Multiple Services

```bash
# Create services
platform create api user-service
platform create api billing-service

# Deploy them
platform deploy aws user-service
platform deploy aws billing-service

# View all costs
platform aws costs

# Destroy when done
platform deploy destroy user-service
platform deploy destroy billing-service
```

## Common Commands Reference

```bash
# AWS Management
platform aws configure         # Configure credentials
platform aws status           # Check connection
platform aws costs            # View all costs

# Service Creation
platform create api <name>    # Create API service
platform create microservices <name>  # Create microservices

# Deployment
platform deploy aws <service>              # Deploy to AWS
platform deploy estimate <service>         # Estimate costs
platform deploy status <service>           # Check status
platform deploy logs <service>             # View logs
platform deploy destroy <service>          # Clean up

# GitHub
platform github login         # Authenticate
platform create api <name> --github  # Create + push to GitHub
```

## Troubleshooting

### Issue: "AWS credentials not configured"

```bash
platform aws configure
```

### Issue: "Terraform not found"

```bash
# macOS
brew install terraform

# Verify
terraform version
```

### Issue: "Deployment failed"

1. Check error message in terminal
2. Check AWS Console for resource limits
3. See [Troubleshooting Guide](./TROUBLESHOOTING.md)

### Issue: "Unexpected costs"

1. Check all deployments: `platform aws costs`
2. Destroy unused services
3. Verify in AWS Console > Billing

## Learning Resources

- [Full Deployment Guide](./AWS_DEPLOYMENT.md)
- [AWS Setup Details](./AWS_SETUP.md)
- [Cost Optimization Tips](./COST_OPTIMIZATION.md)
- [Complete Troubleshooting](./TROUBLESHOOTING.md)
- [Testing Guide](./TESTING_GUIDE_AWS.md)

## Support

- GitHub Issues: Report bugs
- Documentation: Check guides above
- AWS Support: For AWS-specific issues

---

**Happy deploying! 🚀**

Remember:
- Always estimate costs first
- Use development environment for testing
- Destroy resources when done
- Monitor your AWS bill
