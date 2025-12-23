# AWS Deployment Testing Guide

Complete testing checklist for AWS deployment functionality in Platform Engineering Toolkit.

## Pre-Testing Setup

### 1. Install Dependencies

```bash
cd /Users/user/Desktop/platform-engineering-toolkit/cli
npm install
```

Expected dependencies:
- @aws-sdk/client-ec2
- @aws-sdk/client-rds
- @aws-sdk/client-sts
- @aws-sdk/client-cloudwatch
- @aws-sdk/client-cloudwatch-logs
- @aws-sdk/client-pricing

### 2. Install Terraform

```bash
# macOS
brew install terraform

# Verify
terraform version
# Expected: Terraform v1.5.0 or higher
```

### 3. Prepare AWS Account

- Sign up at https://aws.amazon.com
- Create IAM user with AdministratorAccess
- Generate access keys
- Note down:
  - Access Key ID
  - Secret Access Key
  - Account ID

## Testing Checklist

### Phase 1: AWS Configuration

#### Test 1.1: Configure AWS Credentials

```bash
platform aws configure
```

**Test Cases:**

1. **Valid credentials**
   - Input: Valid Access Key ID (starts with AKIA)
   - Input: Valid Secret Access Key
   - Input: Valid region (us-east-1)
   - Confirm: Yes
   - Expected: ✅ Credentials saved, connection verified

2. **Invalid Access Key format**
   - Input: Wrong format (doesn't start with AKIA)
   - Expected: ❌ Validation error

3. **Invalid credentials**
   - Input: Fake credentials
   - Expected: ❌ Verification failed

4. **Cancel configuration**
   - Confirm: No
   - Expected: Configuration cancelled

**Verification:**
```bash
# Check config file
cat ~/.config/platform-toolkit/config.json
# Should contain: aws.accessKeyId, aws.secretAccessKey, aws.region, aws.accountId
```

---

#### Test 1.2: AWS Status Check

```bash
platform aws status
```

**Test Cases:**

1. **With credentials configured**
   - Expected: ✅ Shows account ID, region, ARN

2. **Without credentials**
   - Delete config first: `rm -rf ~/.config/platform-toolkit`
   - Expected: ⚠️ Not configured message

**Expected Output:**
```
✔ Connected to AWS

Account:  815931739526
Region:   us-east-1
User ARN: arn:aws:iam::815931739526:user/platform-user
Config:   /Users/you/.config/platform-toolkit/config.json
```

---

#### Test 1.3: AWS Costs (Before Deployment)

```bash
platform aws costs
```

**Expected:**
```
💰 AWS Cost Estimation

No active deployments found.

Deploy a service first:
  platform deploy aws my-service
```

---

### Phase 2: Deployment Estimation

#### Test 2.1: Cost Estimation

```bash
# Create service first
platform create api test-service
cd test-service

# Estimate development
platform deploy estimate test-service --env development
```

**Expected Output:**
```
📊 Cost Estimate for test-service (development)

Monthly Costs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service         Type           Free Tier    After
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EC2             t2.micro       $0/mo        $8.50/mo
RDS             db.t3.micro    $0/mo        $15.33/mo
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                          $0/mo        $33.13/mo
```

**Test Different Environments:**
```bash
platform deploy estimate test-service --env staging
# Expected: Higher costs (t2.small, db.t3.small)

platform deploy estimate test-service --env production
# Expected: Highest costs (t3.medium, db.t3.small)
```

---

### Phase 3: Actual Deployment

#### Test 3.1: Development Deployment

```bash
cd test-service
platform deploy aws test-service
```

**Interactive Prompts:**
1. Database password: Enter at least 8 characters
2. Confirm deployment: Yes

**Expected Stages:**
```
✔ Initializing Terraform...
✔ Planning infrastructure...
✔ Deploying infrastructure (10-15 minutes)...
✔ Retrieving deployment information...
✔ Deployment complete!

✅ Deployment Complete!

Application URL:
  http://54.123.45.67:3000

Next steps:
  platform deploy status test-service
  platform deploy logs test-service
  platform deploy destroy test-service
```

**Verification Steps:**

1. **Check AWS Console:**
   - EC2 > Instances - Should see instance with tag Project=test-service
   - RDS > Databases - Should see database
   - VPC > VPCs - Should see new VPC

2. **Check deployment state:**
   ```bash
   cat ~/.config/platform-toolkit-deployments/config.json
   # Should contain test-service deployment info
   ```

3. **Test application URL:**
   ```bash
   curl http://[EC2_IP]:3000/health
   # Note: May not work if app not started
   ```

---

#### Test 3.2: Non-Interactive Deployment

```bash
platform create api auto-service
cd auto-service

platform deploy aws auto-service \
  --env development \
  --db-password "SecurePass123" \
  --yes
```

**Expected:**
- No prompts
- Straight to deployment
- Same success message

---

### Phase 4: Deployment Management

#### Test 4.1: Deployment Status

```bash
platform deploy status test-service
```

**Expected Output:**
```
📊 Deployment Status: test-service

Deployment Info:
  Environment: development
  Region: us-east-1
  Deployed: 12/23/2025, 10:30:00 AM
  Deployed By: GoddeyUwamari

Infrastructure:
  ✅ EC2: i-0x1234 (t2.micro, running)
     URL: http://54.123.45.67:3000
  ✅ RDS: test-service-db (db.t3.micro, available)
```

**Test Edge Cases:**
```bash
# Non-existent service
platform deploy status fake-service
# Expected: ⚠️ No deployment found for "fake-service"
```

---

#### Test 4.2: CloudWatch Logs

```bash
platform deploy logs test-service
```

**Expected:**
- If logs exist: Display log entries
- If no logs: Message about waiting for logs

**Test Options:**
```bash
# Show 100 lines
platform deploy logs test-service -n 100

# Follow logs (note: basic implementation)
platform deploy logs test-service -f
```

---

#### Test 4.3: Cost Tracking

```bash
platform aws costs
```

**Expected Output:**
```
💰 AWS Cost Estimation

Active Deployments:

test-service (development)
  EC2: t2.micro - $8.50/mo
  RDS: db.t3.micro - $12.41/mo
  Storage: $4.30/mo

Total Monthly Cost:
  With Free Tier:    $0/mo
  Without Free Tier: $25.21/mo
```

---

### Phase 5: Cleanup

#### Test 5.1: Destroy Deployment

```bash
platform deploy destroy test-service
```

**Interactive Prompts:**
1. Type service name to confirm: test-service
2. Are you absolutely sure?: Yes

**Expected:**
```
⚠️  WARNING: Resource Destruction

This will permanently delete all AWS resources for "test-service":
  • EC2 instances
  • RDS database (DATA WILL BE LOST)
  • VPC and networking
  • Security groups

? Type service name to confirm: test-service
? Are you absolutely sure? Yes

✔ All resources destroyed

✅ Cleanup Complete

Estimated monthly savings:
  $33.13/mo
```

**Verification:**

1. **Check AWS Console:**
   - EC2 instances terminated
   - RDS database deleted
   - VPC removed

2. **Check deployment state:**
   ```bash
   cat ~/.config/platform-toolkit-deployments/config.json
   # test-service should be removed
   ```

3. **Verify costs:**
   ```bash
   platform aws costs
   # Should not show test-service
   ```

---

## Error Handling Tests

### Test 6.1: Missing Terraform

```bash
# Temporarily rename terraform
sudo mv /usr/local/bin/terraform /usr/local/bin/terraform.bak

# Try to deploy
platform deploy aws test-service
```

**Expected:**
```
❌ Terraform not found

Install Terraform:
  macOS:  brew install terraform
  Linux:  https://terraform.io/downloads
```

**Restore:**
```bash
sudo mv /usr/local/bin/terraform.bak /usr/local/bin/terraform
```

---

### Test 6.2: Missing AWS Credentials

```bash
# Remove AWS config
rm -rf ~/.config/platform-toolkit

# Try to deploy
platform deploy aws test-service
```

**Expected:**
```
❌ AWS credentials not configured
Run: platform aws configure
```

---

### Test 6.3: Invalid Service Path

```bash
cd /tmp
platform deploy aws nonexistent-service
```

**Expected:**
```
❌ Terraform configuration not found
Expected: /tmp/nonexistent-service/infrastructure/terraform
```

---

### Test 6.4: Weak Database Password

```bash
platform deploy aws test-service
# When prompted, enter: "weak"
```

**Expected:**
```
✖ Password must be at least 8 characters
```

---

### Test 6.5: Deployment Already Exists

```bash
# Deploy once
platform deploy aws test-service

# Try to deploy again without destroying
platform deploy aws test-service
```

**Expected:**
- Terraform may show resource already exists errors
- Or successfully update existing resources (depends on Terraform state)

---

## Integration Tests

### Test 7.1: Full Workflow

```bash
# 1. Configure AWS
platform aws configure

# 2. Check status
platform aws status

# 3. Create service
platform create api integration-test --github

# 4. Estimate costs
platform deploy estimate integration-test

# 5. Deploy
cd integration-test
platform deploy aws integration-test --db-password "TestPass123" --yes

# 6. Check status
platform deploy status integration-test

# 7. View costs
platform aws costs

# 8. Destroy
platform deploy destroy integration-test
```

**Expected:** All steps complete successfully

---

### Test 7.2: Multiple Deployments

```bash
# Deploy multiple services
platform create api service1
platform deploy aws service1 --db-password "Pass1234" --yes

platform create api service2
platform deploy aws service2 --db-password "Pass5678" --yes

# Check costs (should show both)
platform aws costs

# Clean up
platform deploy destroy service1
platform deploy destroy service2
```

**Expected:**
- Both deployments tracked
- Costs calculated for both
- Both destroyed successfully

---

## Performance Tests

### Test 8.1: Deployment Time

```bash
time platform deploy aws perf-test --db-password "PerfTest123" --yes
```

**Expected Time:**
- Terraform init: 30-60 seconds
- Terraform plan: 10-20 seconds
- Terraform apply: 10-15 minutes (RDS creation is slowest)
- Total: ~15-20 minutes

---

### Test 8.2: Status Check Performance

```bash
time platform deploy status perf-test
```

**Expected Time:**
- < 5 seconds (AWS API calls)

---

## Security Tests

### Test 9.1: Credential Storage

```bash
# Check file permissions
ls -la ~/.config/platform-toolkit/config.json
```

**Expected:**
- File should exist
- Permissions should be restrictive (readable only by owner)

**Check Content:**
```bash
cat ~/.config/platform-toolkit/config.json
```

**Expected:**
- Credentials stored in plain text (secured by file permissions)
- Contains: accessKeyId, secretAccessKey, region, accountId

---

### Test 9.2: Sensitive Data Handling

```bash
# Deploy with password
platform deploy aws sec-test --db-password "MySecret123" --yes

# Check if password visible in logs/config
cat ~/.config/platform-toolkit-deployments/config.json
```

**Expected:**
- Password NOT stored in deployment state
- Password only in terraform.tfvars

---

## Regression Tests

Run these tests after any changes to ensure nothing broke:

```bash
# Test suite
npm test  # If you add automated tests

# Manual regression suite
./test-aws-deployment.sh  # Create this script with above tests
```

---

## Cleanup After Testing

```bash
# Destroy all test deployments
platform deploy destroy test-service
platform deploy destroy auto-service
platform deploy destroy integration-test
platform deploy destroy perf-test
platform deploy destroy sec-test

# Verify no active deployments
platform aws costs

# Check AWS Console
# - No EC2 instances
# - No RDS databases
# - No VPCs (or only default VPC)
```

---

## Success Criteria

All tests pass if:

- ✅ AWS credentials can be configured
- ✅ AWS status shows connection
- ✅ Cost estimation works
- ✅ Deployment succeeds (all environments)
- ✅ Status check shows resources
- ✅ Logs can be viewed
- ✅ Cost tracking shows deployments
- ✅ Destroy removes all resources
- ✅ Error messages are helpful
- ✅ No credentials leaked
- ✅ Terraform state managed correctly

---

## Known Issues / Limitations

1. **CloudWatch logs** - May not be available immediately after deployment
2. **Log streaming** - `--follow` flag shows note about additional implementation needed
3. **Cost accuracy** - Estimates are approximate, actual costs may vary
4. **RDS deletion** - Takes 5-10 minutes to fully delete
5. **Multi-region** - Currently single region per config

---

## Reporting Issues

When reporting bugs, include:

1. Command you ran
2. Full error message
3. Output of `platform aws status`
4. Output of `terraform version`
5. OS and version
6. CLI version

**Example:**
```
Issue: Deployment fails with VPC limit error

Command: platform deploy aws test --env development
Error: VpcLimitExceeded: The maximum number of VPCs has been reached
AWS Status: Connected, Account 123456789012
Terraform: v1.6.0
OS: macOS 13.0
CLI: v1.0.0
```

---

## Next Steps

- Automate testing with Jest/Mocha
- Add CI/CD pipeline for tests
- Create test fixtures
- Mock AWS API calls for unit tests
