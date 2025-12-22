# Terraform Deployment Checklist

## Phase 1: Pre-Deployment

### Prerequisites
- [ ] AWS account active (Account: 815931739526)
- [ ] IAM user configured (terraform-deploy)
- [ ] AWS CLI credentials configured
- [ ] Terraform v1.14.1 installed
- [ ] SSH key pair exists: `~/.ssh/production-api-key` and `~/.ssh/production-api-key.pub`

### Configuration Review
- [ ] Open `terraform.tfvars`
- [ ] **CRITICAL**: Change `db_password` from default
- [ ] **SECURITY**: Update `allowed_ssh_cidr` to your IP (not 0.0.0.0/0)
- [ ] Verify `project_name` is correct
- [ ] Verify `aws_region` is correct (us-east-1)
- [ ] Confirm `environment` setting (production)

### Pre-Flight Validation
```bash
cd infrastructure/terraform
terraform validate
terraform fmt -check
```

## Phase 2: Deployment

### Initialize Terraform
- [ ] Run: `terraform init`
- [ ] Verify providers downloaded successfully
- [ ] Check for any initialization errors

### Review Execution Plan
- [ ] Run: `terraform plan -out=tfplan.out`
- [ ] Review all resources to be created (~30 resources)
- [ ] Verify no unexpected changes
- [ ] Check estimated costs (should be $0 for free tier)

### Apply Infrastructure
- [ ] Run: `terraform apply tfplan.out`
- [ ] Monitor deployment progress (10-15 minutes)
- [ ] Wait for RDS instance creation (longest step)
- [ ] Verify successful completion

### Save Outputs
- [ ] Run: `terraform output > deployment-info.txt`
- [ ] Save EC2 public IP
- [ ] Save RDS endpoint
- [ ] Save SSH command
- [ ] **SECURE**: Store database credentials safely

## Phase 3: Post-Deployment Verification

### EC2 Instance
- [ ] SSH to instance: `ssh -i ~/.ssh/production-api-key ubuntu@<IP>`
- [ ] Verify Docker installed: `docker --version`
- [ ] Verify Docker Compose installed: `docker-compose --version`
- [ ] Check CloudWatch agent: `sudo systemctl status amazon-cloudwatch-agent`
- [ ] Review user data logs: `sudo cat /var/log/user-data.log`

### Database
- [ ] Verify RDS instance is available in AWS Console
- [ ] Test connection from EC2: `telnet <RDS_ENDPOINT> 5432`
- [ ] Install psql client: `sudo apt-get install -y postgresql-client`
- [ ] Test database login: `psql -h <RDS_ENDPOINT> -U dbadmin -d api_db`

### Networking
- [ ] Verify VPC created
- [ ] Check subnets (1 public, 2 private)
- [ ] Verify Internet Gateway attached
- [ ] Check route tables configured correctly
- [ ] Verify security groups allow required traffic

### IAM & Permissions
- [ ] Verify EC2 instance profile attached
- [ ] Test CloudWatch permissions from EC2
- [ ] Verify SSM access (optional): `aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2`

## Phase 4: Application Deployment

### Environment Configuration
- [ ] Copy template: `cp /opt/production-api/.env.template /opt/production-api/.env`
- [ ] Edit `.env` with actual values
- [ ] Set `DB_PASSWORD` (same as terraform.tfvars)
- [ ] Verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`
- [ ] Set `NODE_ENV=production`

### Deploy Application
- [ ] Clone repository to `/opt/production-api`
- [ ] Build Docker images
- [ ] Run: `docker-compose up -d`
- [ ] Check logs: `docker-compose logs -f`
- [ ] Verify application starts successfully

### Database Setup
- [ ] Run database migrations
- [ ] Seed initial data (if applicable)
- [ ] Verify tables created correctly

### Testing
- [ ] Test health endpoint: `curl http://localhost:3000/health`
- [ ] Test from external: `curl http://<EC2_PUBLIC_IP>:3000/health`
- [ ] Test database connectivity from app
- [ ] Verify API endpoints working

## Phase 5: Security Hardening

### Network Security
- [ ] Restrict SSH to your IP only (update terraform.tfvars)
- [ ] Verify RDS not publicly accessible
- [ ] Review security group rules
- [ ] Consider VPN for SSH access

### Credentials Management
- [ ] Remove plaintext passwords from files
- [ ] Consider AWS Secrets Manager for DB credentials
- [ ] Rotate database password
- [ ] Set up AWS SSM Parameter Store

### SSL/TLS Setup
- [ ] Obtain domain name (if needed)
- [ ] Set up Route 53 (or other DNS)
- [ ] Install Let's Encrypt certificate
- [ ] Configure nginx/reverse proxy
- [ ] Update security groups (disable HTTP, keep HTTPS)

### Monitoring Setup
- [ ] Verify CloudWatch logs flowing
- [ ] Set up CloudWatch alarms
- [ ] Configure SNS notifications
- [ ] Set up CloudWatch dashboards

## Phase 6: Backup & Disaster Recovery

### Automated Backups
- [ ] Verify RDS automated backups enabled (7 days)
- [ ] Test backup restoration procedure
- [ ] Document RTO/RPO requirements

### Manual Snapshots
- [ ] Create initial RDS snapshot
- [ ] Create AMI of EC2 instance
- [ ] Document snapshot naming convention

### Disaster Recovery Plan
- [ ] Document recovery procedures
- [ ] Test restore from backup
- [ ] Set up cross-region replication (if needed)

## Phase 7: Monitoring & Alerts

### CloudWatch Alarms
- [ ] Verify CPU utilization alarm (>80%)
- [ ] Verify disk space alarm (<2GB free)
- [ ] Verify database connections alarm (>80)
- [ ] Set up custom application metrics

### Log Monitoring
- [ ] Check CloudWatch Log Groups created
- [ ] Verify logs flowing from EC2
- [ ] Set up log insights queries
- [ ] Configure log retention periods

### Cost Monitoring
- [ ] Enable AWS Cost Explorer
- [ ] Set up billing alerts
- [ ] Review current month costs
- [ ] Verify staying within free tier

## Phase 8: Documentation

### Infrastructure Documentation
- [ ] Document all deployed resources
- [ ] Save terraform outputs
- [ ] Update network diagrams
- [ ] Document security group rules

### Operational Procedures
- [ ] Document deployment process
- [ ] Create runbooks for common issues
- [ ] Document backup/restore procedures
- [ ] Create incident response plan

### Handoff Documentation
- [ ] Share access credentials (securely)
- [ ] Provide AWS console access
- [ ] Document monitoring dashboards
- [ ] Create knowledge transfer sessions

## Phase 9: Optimization (Optional)

### Performance
- [ ] Enable RDS Performance Insights (free: 7 days)
- [ ] Review slow query logs
- [ ] Optimize database queries
- [ ] Consider read replicas (additional cost)

### Cost Optimization
- [ ] Review resource utilization
- [ ] Right-size instances if needed
- [ ] Clean up unused resources
- [ ] Set up auto-shutdown for non-prod

### Scaling Preparation
- [ ] Document scaling strategy
- [ ] Consider Auto Scaling Groups
- [ ] Plan for load balancer
- [ ] Consider Multi-AZ deployment

## Phase 10: Maintenance Plan

### Regular Tasks
- [ ] Weekly: Review CloudWatch metrics
- [ ] Weekly: Check security group rules
- [ ] Monthly: Update EC2 packages
- [ ] Monthly: Review and rotate logs
- [ ] Quarterly: Test disaster recovery
- [ ] Quarterly: Review and update documentation

### Update Strategy
- [ ] Monitor for Terraform updates
- [ ] Monitor for AWS provider updates
- [ ] Keep application dependencies updated
- [ ] Test updates in staging first

## Emergency Contacts

- AWS Support: https://console.aws.amazon.com/support/
- Terraform Documentation: https://www.terraform.io/docs
- Project Repository: [Add your repo URL]
- Team Slack/Contact: [Add your contact info]

## Rollback Plan

If deployment fails:
```bash
# Destroy infrastructure
terraform destroy

# Fix issues in configuration files

# Re-deploy
terraform init
terraform plan
terraform apply
```

---

**Last Updated**: 2025-12-04
**Version**: 1.0
**Maintained By**: DevOps Team
