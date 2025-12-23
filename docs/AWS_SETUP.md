# AWS Account Setup Guide

Complete guide for setting up your AWS account for use with the Platform Engineering Toolkit.

## Table of Contents

- [Create AWS Account](#create-aws-account)
- [Create IAM User](#create-iam-user)
- [Generate Access Keys](#generate-access-keys)
- [Configure CLI](#configure-cli)
- [Verify Setup](#verify-setup)
- [Security Best Practices](#security-best-practices)

## Create AWS Account

### 1. Sign Up

1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Enter email address and account name
4. Provide contact information
5. Add payment method (credit/debit card)
6. Verify identity (phone verification)
7. Select support plan (Free - Basic Support)

### 2. Free Tier

Your account includes 12 months of free tier:

- **EC2**: 750 hours/month of t2.micro
- **RDS**: 750 hours/month of db.t3.micro
- **Storage**: 30 GB (EBS + RDS combined)
- **Data Transfer**: 15 GB outbound

**Important:** Free tier starts on account creation date.

## Create IAM User

**Never use root account credentials!** Create an IAM user instead.

### 1. Access IAM Console

1. Sign in to AWS Console: https://console.aws.amazon.com
2. Search for "IAM" in services
3. Click "IAM" to open dashboard

### 2. Create User

1. Click "Users" in left sidebar
2. Click "Create user"
3. Enter username (e.g., "platform-toolkit-user")
4. Click "Next"

### 3. Set Permissions

**Option 1: Administrator Access (Recommended for Development)**

1. Select "Attach policies directly"
2. Search for "AdministratorAccess"
3. Check the box next to "AdministratorAccess"
4. Click "Next"

**Option 2: Minimal Permissions (Production)**

Create a custom policy with only required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "vpc:*",
        "cloudwatch:*",
        "logs:*",
        "iam:GetUser",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. Review and Create

1. Review user details
2. Click "Create user"
3. User is now created

## Generate Access Keys

### 1. Access User Settings

1. Click on the username you just created
2. Click "Security credentials" tab
3. Scroll to "Access keys" section

### 2. Create Access Key

1. Click "Create access key"
2. Select use case: "Command Line Interface (CLI)"
3. Check "I understand..." box
4. Click "Next"
5. Optional: Add description tag (e.g., "Platform Toolkit CLI")
6. Click "Create access key"

### 3. Save Credentials

**IMPORTANT:** This is your only chance to see the secret key!

1. **Access Key ID**: Starts with "AKIA..." (shown)
2. **Secret Access Key**: Long random string (shown once)

**Save these securely:**

- Download CSV file (recommended)
- Copy to password manager
- Never share or commit to git

Example:
```
Access Key ID:     AKIAIOSFODNN7EXAMPLE
Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### 4. Done

Click "Done" - you won't see the secret key again.

## Configure CLI

### 1. Install CLI

If not already installed:

```bash
npm install -g @platform-toolkit/cli
```

### 2. Configure AWS Credentials

```bash
platform aws configure
```

Enter when prompted:

```
? AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
? AWS Secret Access Key: ****************************************
? Default Region: us-east-1
? Confirm configuration? Yes
```

### 3. Region Selection

Choose a region close to your users:

**US Regions:**
- `us-east-1` - N. Virginia (cheapest, most services)
- `us-east-2` - Ohio
- `us-west-1` - N. California
- `us-west-2` - Oregon

**Europe Regions:**
- `eu-west-1` - Ireland
- `eu-central-1` - Frankfurt

**Asia Pacific:**
- `ap-southeast-1` - Singapore
- `ap-northeast-1` - Tokyo

**Recommendation:** Use `us-east-1` for lowest costs and most features.

## Verify Setup

### 1. Check Connection

```bash
platform aws status
```

Expected output:
```
✔ Connected to AWS

Account:  123456789012
Region:   us-east-1
User ARN: arn:aws:iam::123456789012:user/platform-toolkit-user
Config:   /Users/you/.config/platform-toolkit/config.json
```

### 2. Test Deployment

Create a test service:

```bash
# Create service
platform create api test-service
cd test-service

# Estimate costs (should show $0 with free tier)
platform deploy estimate test-service

# Deploy (optional - only if you want to test)
platform deploy aws test-service

# Clean up
platform deploy destroy test-service
```

## Security Best Practices

### 1. Never Use Root Account

- Root account has unlimited access
- Cannot be restricted with IAM policies
- If compromised, attacker has full control
- Always use IAM users instead

### 2. Enable MFA (Multi-Factor Authentication)

For root account:
1. Go to IAM Dashboard
2. Click "Add MFA" for root account
3. Use authenticator app (Google Authenticator, Authy)

For IAM user:
1. Go to IAM > Users > [your user]
2. Security credentials tab
3. Click "Assign MFA device"

### 3. Rotate Access Keys Regularly

Best practice: Rotate every 90 days

```bash
# Create new access key in AWS Console
# Update CLI
platform aws configure
# Delete old access key in AWS Console
```

### 4. Use Least Privilege

Only grant permissions actually needed:

- Development: AdministratorAccess is OK
- Production: Create minimal custom policy
- Never use AdministratorAccess in production

### 5. Monitor Usage

Set up billing alerts:

1. AWS Console > Billing Dashboard
2. Click "Billing preferences"
3. Enable "Receive Billing Alerts"
4. Create CloudWatch alarm:
   - Threshold: $10 (or your limit)
   - Email: your@email.com

### 6. Secure Your Credentials

**DO:**
- Store in password manager
- Use environment variables for CI/CD
- Keep CLI config file permissions at 600

**DON'T:**
- Commit to git
- Share via email/Slack
- Store in plain text files
- Use in frontend code

### 7. Review IAM Access Advisor

Periodically check:

1. IAM > Users > [user]
2. Access Advisor tab
3. See last time each service was accessed
4. Remove unused permissions

## Credential Storage Locations

Platform Toolkit stores credentials at:

**macOS/Linux:**
```
~/.config/platform-toolkit/config.json
```

**Windows:**
```
C:\Users\[username]\AppData\Roaming\platform-toolkit\config.json
```

File permissions: `600` (read/write owner only)

## Alternative: AWS CLI Credentials

Platform Toolkit can also use AWS CLI credentials:

```bash
# Install AWS CLI
brew install awscli  # macOS
# or download from aws.amazon.com/cli

# Configure
aws configure

# Platform Toolkit will use these if available
```

## Troubleshooting

### "Access Key ID should start with AKIA"

- You may have entered the wrong value
- Access Key ID format: `AKIAIOSFODNN7EXAMPLE`
- Secret Access Key is the long one

### "Credential verification failed"

Possible causes:

1. **Wrong credentials**
   - Double-check Access Key ID
   - Re-create access key if needed

2. **Insufficient permissions**
   - User needs at least `sts:GetCallerIdentity`
   - Add AdministratorAccess for simplicity

3. **Region issues**
   - Some regions require opt-in
   - Try `us-east-1` first

### "Token expired"

- Access keys don't expire (unlike session tokens)
- If using temporary credentials, they do expire
- Create permanent access keys for CLI use

## Next Steps

- [Deploy your first service](./AWS_DEPLOYMENT.md)
- [Optimize costs](./COST_OPTIMIZATION.md)
- [Troubleshooting guide](./TROUBLESHOOTING.md)

## Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Free Tier Details](https://aws.amazon.com/free/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
