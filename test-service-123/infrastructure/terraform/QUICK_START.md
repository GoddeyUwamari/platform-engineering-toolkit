# Terraform Quick Start Guide

## Pre-Flight Checklist

Before running Terraform, verify these items:

- [ ] AWS CLI configured with credentials
- [ ] Terraform v1.14.1 installed
- [ ] SSH key exists at `~/.ssh/production-api-key.pub`
- [ ] Database password changed in `terraform.tfvars`
- [ ] SSH CIDR restricted to your IP in `terraform.tfvars`

## Quick Deployment (5 commands)

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform

# 2. CRITICAL: Update database password
nano terraform.tfvars
# Change: db_password = "CHANGE_THIS_TO_STRONG_PASSWORD_123!"

# 3. Initialize Terraform
terraform init

# 4. Preview infrastructure
terraform plan

# 5. Deploy (type 'yes' when prompted)
terraform apply
```

## After Deployment

```bash
# Get SSH command
terraform output ssh_command

# Connect to EC2
ssh -i ~/.ssh/production-api-key ubuntu@<IP_FROM_OUTPUT>

# On EC2: Configure environment
cd /opt/production-api
cp .env.template .env
nano .env  # Add DB_PASSWORD and verify other values

# Deploy your application
git clone <your-repo> .
docker-compose up -d
```

## Important Outputs

```bash
# EC2 Public IP
terraform output ec2_public_ip

# Database Endpoint
terraform output rds_endpoint

# All environment variables
terraform output env_variables

# Complete summary
terraform output deployment_summary
```

## Cost Tracking

**Free Tier (First 12 months)**: $0.00/month

**After Free Tier**: ~$36.40/month
- EC2 t2.micro: $8.50
- RDS db.t3.micro: $15.00
- Storage: $3.90
- Data transfer: $9.00

## Security Checklist

- [ ] Changed default database password
- [ ] Restricted SSH to your IP only
- [ ] Reviewed security group rules
- [ ] Enabled deletion protection
- [ ] Configured CloudWatch alarms
- [ ] Set up SSL/TLS (after deployment)

## Common Commands

```bash
# View state
terraform show

# List resources
terraform state list

# Update infrastructure
terraform apply

# Destroy infrastructure
terraform destroy

# Format files
terraform fmt -recursive

# Validate configuration
terraform validate
```

## Troubleshooting

### Can't connect via SSH
```bash
# Check security group allows your IP
terraform output ec2_security_group_id

# Verify key permissions
chmod 400 ~/.ssh/production-api-key
```

### Database connection failed
```bash
# Get database endpoint
terraform output rds_endpoint

# Verify from EC2 instance
telnet <RDS_ENDPOINT> 5432
```

### User data script issues
```bash
# SSH to EC2 and check logs
sudo cat /var/log/user-data.log
sudo cat /var/log/cloud-init-output.log
```

## Next Steps

1. Review the complete [README.md](README.md) for detailed documentation
2. Configure your application with the database credentials
3. Set up CI/CD for automated deployments
4. Configure SSL/TLS certificates
5. Set up CloudWatch alarms and notifications
6. Implement backup and disaster recovery procedures

## Support Resources

- **Full Documentation**: [README.md](README.md)
- **AWS Console**: https://console.aws.amazon.com/
- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **CloudWatch Logs**: Check `/aws/ec2/production-api/production/*` log groups

---

**Created**: 2025-12-04
**Project**: production-api-framework
**Terraform Version**: 1.14.1
