# Troubleshooting Guide

Common issues and solutions when using Platform Engineering Toolkit with AWS deployments.

## Table of Contents

- [AWS Credentials](#aws-credentials)
- [Terraform Issues](#terraform-issues)
- [Deployment Failures](#deployment-failures)
- [Networking Problems](#networking-problems)
- [Database Issues](#database-issues)
- [Cost and Billing](#cost-and-billing)
- [General Issues](#general-issues)

## AWS Credentials

### Issue: "AWS credentials not configured"

**Symptom:**
```
❌ AWS credentials not configured
Run: platform aws configure
```

**Solution:**
```bash
platform aws configure
```

Enter your AWS Access Key ID and Secret Access Key.

---

### Issue: "Access Key ID should start with AKIA"

**Symptom:**
```
? AWS Access Key ID: xxx
✖ Access Key ID should start with AKIA
```

**Cause:** You entered the wrong value (possibly the secret key)

**Solution:**
- Access Key ID format: `AKIAIOSFODNN7EXAMPLE`
- Secret Access Key is the longer one
- Check your downloaded CSV file

---

### Issue: "Credential verification failed"

**Symptom:**
```
✖ Credential verification failed
Error: The security token included in the request is invalid
```

**Possible Causes:**

1. **Wrong credentials**
   ```bash
   # Re-download from AWS Console
   # IAM > Users > [your user] > Security credentials
   # Create new access key
   platform aws configure
   ```

2. **Insufficient permissions**
   ```bash
   # User needs at least sts:GetCallerIdentity permission
   # Add AdministratorAccess policy in IAM Console
   ```

3. **Expired temporary credentials**
   ```bash
   # Don't use temporary credentials for CLI
   # Create permanent access keys instead
   ```

---

### Issue: "Connection failed"

**Symptom:**
```
✖ Connection failed
Error: getaddrinfo ENOTFOUND sts.us-east-1.amazonaws.com
```

**Cause:** Network/Internet connection issue

**Solution:**
1. Check internet connection
2. Verify firewall not blocking AWS
3. Try different network
4. Check VPN settings

---

## Terraform Issues

### Issue: "Terraform not found"

**Symptom:**
```
❌ Terraform not found

Install Terraform:
  macOS:  brew install terraform
  Linux:  https://terraform.io/downloads
```

**Solution:**

**macOS:**
```bash
brew install terraform
terraform version
```

**Linux:**
```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform version
```

**Windows:**
```bash
choco install terraform
terraform version
```

---

### Issue: "Terraform configuration not found"

**Symptom:**
```
❌ Terraform configuration not found
Expected: /path/to/my-service/infrastructure/terraform
```

**Cause:** Service not created with Platform Toolkit template

**Solution:**

1. **Check directory structure:**
   ```bash
   ls my-service/infrastructure/terraform/
   ```

2. **If missing, you're not in a Platform Toolkit service:**
   ```bash
   # Create new service with template
   platform create api my-new-service
   cd my-new-service
   platform deploy aws my-new-service
   ```

3. **If you have custom Terraform:**
   - Ensure files are in `infrastructure/terraform/`
   - Must include: main.tf, variables.tf, outputs.tf

---

### Issue: "Terraform command failed"

**Symptom:**
```
✖ Terraform apply failed
Error: Error creating VPC: VpcLimitExceeded
```

**Common Terraform Errors:**

#### VPC Limit Exceeded
```
Error: VpcLimitExceeded: The maximum number of VPCs has been reached
```

**Solution:**
1. Delete unused VPCs in AWS Console
2. Request limit increase
3. Use different region

#### Instance Limit Exceeded
```
Error: InstanceLimitExceeded: You have reached the limit
```

**Solution:**
1. Stop/terminate unused EC2 instances
2. Request limit increase
3. Wait a few minutes and retry

#### Insufficient Capacity
```
Error: InsufficientInstanceCapacity
```

**Solution:**
1. Try different availability zone
2. Try different instance type
3. Wait and retry later

---

## Deployment Failures

### Issue: "Deployment failed"

**Symptom:**
```
❌ Deployment failed: [error message]
```

**General Debugging Steps:**

1. **Check Terraform state:**
   ```bash
   cd my-service/infrastructure/terraform
   terraform state list
   ```

2. **View detailed error:**
   ```bash
   cd my-service/infrastructure/terraform
   terraform plan
   ```

3. **Fix and retry:**
   ```bash
   terraform apply
   ```

---

### Issue: "Database password validation failed"

**Symptom:**
```
✖ Password must be at least 8 characters
```

**Solution:**
```bash
# Use strong password (min 8 characters)
platform deploy aws my-service --db-password "MySecurePass123"
```

---

### Issue: "Service already exists"

**Symptom:**
```
Error: ResourceAlreadyExistsException: DB Instance already exists
```

**Cause:** Previous deployment wasn't fully destroyed

**Solution:**

1. **Check deployment state:**
   ```bash
   platform deploy status my-service
   ```

2. **Destroy completely:**
   ```bash
   platform deploy destroy my-service
   ```

3. **Manual cleanup if needed:**
   ```bash
   cd my-service/infrastructure/terraform
   terraform destroy
   ```

4. **Remove state:**
   ```bash
   rm -rf .terraform
   rm terraform.tfstate*
   ```

5. **Deploy again:**
   ```bash
   platform deploy aws my-service
   ```

---

### Issue: "Deployment stuck/hanging"

**Symptom:**
- Spinner runs for > 20 minutes
- No progress shown

**Cause:** Usually RDS taking long to create

**Solution:**

1. **Be patient** - RDS can take 10-15 minutes
2. **Check AWS Console** - verify resources are being created
3. **If truly stuck (>30 min):**
   ```bash
   # Ctrl+C to cancel
   cd my-service/infrastructure/terraform
   terraform apply  # Resume manually
   ```

---

## Networking Problems

### Issue: "Can't access application URL"

**Symptom:**
```
http://54.123.45.67:3000 - Connection refused
```

**Possible Causes:**

1. **Application not started on EC2**

   **Check:**
   ```bash
   # SSH into EC2 (if you have key)
   ssh -i ~/.ssh/key.pem ec2-user@54.123.45.67

   # Check if app is running
   ps aux | grep node
   ```

2. **Security group blocking port 3000**

   **Fix in AWS Console:**
   - EC2 > Security Groups
   - Find security group for your service
   - Inbound rules > Edit
   - Add rule: Custom TCP, Port 3000, Source 0.0.0.0/0

3. **Wrong port**

   **Check Terraform outputs:**
   ```bash
   cd my-service/infrastructure/terraform
   terraform output
   ```

---

### Issue: "Database connection failed"

**Symptom:**
```
Error: ECONNREFUSED - Connection to RDS failed
```

**Possible Causes:**

1. **RDS not ready**
   - Wait 5-10 minutes after deployment
   - Check status: `platform deploy status my-service`

2. **Security group blocking 5432**
   - EC2 and RDS must be in same security group
   - Or allow traffic from EC2 to RDS

3. **Wrong connection string**
   - Check RDS endpoint in AWS Console
   - Verify database name, username

---

### Issue: "Public IP not assigned"

**Symptom:**
```
✅ Deployment Complete!
(no URL shown)
```

**Cause:** EC2 instance in private subnet or no public IP

**Solution:**

1. **Check Terraform config:**
   ```hcl
   # In ec2.tf, ensure:
   associate_public_ip_address = true
   subnet_id = aws_subnet.public.id  # Not private!
   ```

2. **Redeploy:**
   ```bash
   platform deploy destroy my-service
   platform deploy aws my-service
   ```

---

## Database Issues

### Issue: "RDS creation failed"

**Symptom:**
```
Error: Error creating DB Instance: DBSubnetGroupDoesNotCoverEnoughAZs
```

**Cause:** Need subnets in at least 2 availability zones

**Solution:**
- Platform Toolkit templates already handle this
- If custom Terraform, ensure 2+ AZs in subnet group

---

### Issue: "Can't connect to database"

**Symptom:**
```
FATAL: password authentication failed for user "dbadmin"
```

**Cause:** Wrong password

**Solution:**

1. **Check password you used during deployment**
2. **Reset password in AWS Console:**
   - RDS > Databases > [your db]
   - Modify > New master password
   - Apply immediately

3. **Update application config with new password**

---

### Issue: "Database deleted accidentally"

**Symptom:**
```
Error: DBInstanceNotFound
```

**Cause:** Someone deleted RDS instance or ran `terraform destroy`

**Solution:**

1. **Check if snapshot exists:**
   - RDS > Snapshots
   - Find automatic snapshot

2. **Restore from snapshot:**
   - Actions > Restore snapshot
   - Use same identifier

3. **If no snapshot:**
   - Data is lost
   - Redeploy: `platform deploy aws my-service`

---

## Cost and Billing

### Issue: "Unexpected charges"

**Symptom:**
```
AWS Bill: $50
Expected: $0 (free tier)
```

**Possible Causes:**

1. **Exceeded free tier hours**
   - 750 hours = 1 instance/month
   - 2 instances = not free
   - Check: AWS Console > Billing > Free Tier

2. **Wrong instance type**
   - Free tier: t2.micro, db.t3.micro
   - Not free: t2.small, t3.medium
   - Fix: Use `--env development`

3. **Data transfer charges**
   - 15 GB/month free
   - After that: $0.09/GB
   - Reduce unnecessary downloads

4. **Forgot to destroy**
   - Check: `platform aws costs`
   - Destroy: `platform deploy destroy my-service`

---

### Issue: "Can't see costs in CLI"

**Symptom:**
```
platform aws costs
No active deployments found.
```

**Cause:** CLI only shows Platform Toolkit deployments

**Solution:**

1. **View actual costs in AWS Console:**
   - Billing Dashboard > Cost Explorer
   - View all services and charges

2. **Check deployment state:**
   ```bash
   # See all platform deployments
   cat ~/.config/platform-toolkit-deployments/config.json
   ```

---

## General Issues

### Issue: "Permission denied"

**Symptom:**
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Cause:** Installing without proper permissions

**Solution:**
```bash
# Use sudo for global install
sudo npm install -g @platform-toolkit/cli
```

---

### Issue: "Command not found: platform"

**Symptom:**
```bash
platform aws configure
bash: platform: command not found
```

**Solution:**

1. **Reinstall CLI:**
   ```bash
   npm install -g @platform-toolkit/cli
   ```

2. **Check installation:**
   ```bash
   which platform
   npm list -g @platform-toolkit/cli
   ```

3. **Add to PATH (if needed):**
   ```bash
   export PATH="$PATH:$(npm bin -g)"
   ```

---

### Issue: "Config file corrupted"

**Symptom:**
```
Error: Config file is invalid JSON
```

**Solution:**

1. **Reset config:**
   ```bash
   rm -rf ~/.config/platform-toolkit
   rm -rf ~/.config/platform-toolkit-deployments
   ```

2. **Reconfigure:**
   ```bash
   platform aws configure
   platform github login
   ```

---

### Issue: "Module not found"

**Symptom:**
```
Error: Cannot find module '@aws-sdk/client-ec2'
```

**Cause:** Dependencies not installed

**Solution:**
```bash
cd /path/to/platform-engineering-toolkit/cli
npm install
```

---

## Getting Help

### Check Logs

**Terraform logs:**
```bash
cd my-service/infrastructure/terraform
terraform plan  # See what would happen
terraform apply  # See detailed errors
```

**AWS Console:**
- CloudWatch > Logs
- EC2 > Instances > System Log
- RDS > Events

### Debug Mode

**Run Terraform manually:**
```bash
cd my-service/infrastructure/terraform

# See environment variables
export TF_LOG=DEBUG

# Run commands
terraform init
terraform plan
terraform apply
```

### Community Support

1. **GitHub Issues**
   - https://github.com/your-org/platform-toolkit/issues
   - Search existing issues
   - Create new issue with details

2. **AWS Support**
   - Basic support included free
   - Service limit increases
   - Billing questions

3. **Stack Overflow**
   - Tag: `terraform` `aws` `aws-cli`
   - Include error messages
   - Sanitize credentials!

### Information to Include

When asking for help, provide:

1. **Error message** (full text)
2. **Command you ran**
3. **Environment** (development/staging/production)
4. **OS and version**
5. **Terraform version:** `terraform version`
6. **CLI version:** `npm list -g @platform-toolkit/cli`

**Example:**
```
Issue: Deployment fails with VPC limit error

Command: platform deploy aws my-service --env development
Error: VpcLimitExceeded: The maximum number of VPCs has been reached
OS: macOS 13.0
Terraform: v1.6.0
CLI: v1.0.0
```

## Prevention

### Best Practices to Avoid Issues

1. **Always estimate first:**
   ```bash
   platform deploy estimate my-service
   ```

2. **Use version control:**
   ```bash
   git commit -m "Before deploying"
   ```

3. **Test in development:**
   ```bash
   platform deploy aws my-service --env development
   ```

4. **Monitor deployments:**
   ```bash
   platform deploy status my-service
   ```

5. **Clean up regularly:**
   ```bash
   platform deploy destroy old-service
   ```

6. **Keep credentials secure:**
   - Never commit to git
   - Use password manager
   - Rotate regularly

7. **Set billing alerts:**
   - AWS Console > Billing > Budgets
   - Threshold: $5-10
   - Email notifications

## Next Steps

- [Deployment Guide](./AWS_DEPLOYMENT.md)
- [Cost Optimization](./COST_OPTIMIZATION.md)
- [AWS Setup](./AWS_SETUP.md)
