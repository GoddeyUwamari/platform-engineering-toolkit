#==============================================================================
# IAM Roles and Policies
#==============================================================================
# This file defines IAM roles and policies for EC2 instances to securely
# access AWS services following the principle of least privilege.
#
# Permissions granted:
# - CloudWatch Logs and Metrics
# - Systems Manager (SSM) for remote management
# - Elastic Container Registry (ECR) for Docker images
#==============================================================================

#------------------------------------------------------------------------------
# EC2 IAM Role
#------------------------------------------------------------------------------

resource "aws_iam_role" "ec2_role" {
  name               = "${local.name_prefix}-ec2-role"
  description        = "IAM role for EC2 instances running ${var.project_name}"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "${local.name_prefix}-ec2-role"
  }
}

# Trust policy allowing EC2 service to assume this role
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

#------------------------------------------------------------------------------
# IAM Instance Profile
#------------------------------------------------------------------------------

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = {
    Name = "${local.name_prefix}-ec2-profile"
  }
}

#------------------------------------------------------------------------------
# Managed Policy Attachments
#------------------------------------------------------------------------------

# CloudWatch Agent Server Policy - for metrics and logs
resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# SSM Managed Instance Core - for Systems Manager access
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ECR Read-Only Access - for pulling Docker images
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

#------------------------------------------------------------------------------
# Custom Policy for Secrets Manager Access (Optional)
#------------------------------------------------------------------------------

# Uncomment to allow EC2 instances to read database credentials from Secrets Manager
# This is more secure than storing credentials in environment variables

# resource "aws_iam_policy" "secrets_manager_read" {
#   name        = "${local.name_prefix}-secrets-manager-read"
#   description = "Allow reading database credentials from Secrets Manager"
#   policy      = data.aws_iam_policy_document.secrets_manager_read.json
#
#   tags = {
#     Name = "${local.name_prefix}-secrets-manager-read"
#   }
# }
#
# data "aws_iam_policy_document" "secrets_manager_read" {
#   statement {
#     effect = "Allow"
#
#     actions = [
#       "secretsmanager:GetSecretValue",
#       "secretsmanager:DescribeSecret"
#     ]
#
#     resources = [
#       aws_secretsmanager_secret.db_credentials.arn
#     ]
#   }
# }
#
# resource "aws_iam_role_policy_attachment" "secrets_manager" {
#   role       = aws_iam_role.ec2_role.name
#   policy_arn = aws_iam_policy.secrets_manager_read.arn
# }

#------------------------------------------------------------------------------
# Custom Policy for S3 Access (Optional)
#------------------------------------------------------------------------------

# Uncomment to allow EC2 instances to access S3 buckets for file storage/backups

# resource "aws_iam_policy" "s3_access" {
#   name        = "${local.name_prefix}-s3-access"
#   description = "Allow access to application S3 buckets"
#   policy      = data.aws_iam_policy_document.s3_access.json
#
#   tags = {
#     Name = "${local.name_prefix}-s3-access"
#   }
# }
#
# data "aws_iam_policy_document" "s3_access" {
#   statement {
#     effect = "Allow"
#
#     actions = [
#       "s3:GetObject",
#       "s3:PutObject",
#       "s3:DeleteObject",
#       "s3:ListBucket"
#     ]
#
#     resources = [
#       "arn:aws:s3:::${var.project_name}-${var.environment}-*",
#       "arn:aws:s3:::${var.project_name}-${var.environment}-*/*"
#     ]
#   }
# }
#
# resource "aws_iam_role_policy_attachment" "s3_access" {
#   role       = aws_iam_role.ec2_role.name
#   policy_arn = aws_iam_policy.s3_access.arn
# }

#------------------------------------------------------------------------------
# Custom Policy for SES Access (Optional)
#------------------------------------------------------------------------------

# Uncomment to allow EC2 instances to send emails via Amazon SES

# resource "aws_iam_policy" "ses_send_email" {
#   name        = "${local.name_prefix}-ses-send-email"
#   description = "Allow sending emails via SES"
#   policy      = data.aws_iam_policy_document.ses_send_email.json
#
#   tags = {
#     Name = "${local.name_prefix}-ses-send-email"
#   }
# }
#
# data "aws_iam_policy_document" "ses_send_email" {
#   statement {
#     effect = "Allow"
#
#     actions = [
#       "ses:SendEmail",
#       "ses:SendRawEmail"
#     ]
#
#     resources = ["*"]
#
#     condition {
#       test     = "StringEquals"
#       variable = "ses:FromAddress"
#       values   = ["noreply@yourdomain.com"]
#     }
#   }
# }
#
# resource "aws_iam_role_policy_attachment" "ses_send_email" {
#   role       = aws_iam_role.ec2_role.name
#   policy_arn = aws_iam_policy.ses_send_email.arn
# }

#------------------------------------------------------------------------------
# Custom Policy for CloudWatch Logs (Additional Permissions)
#------------------------------------------------------------------------------

resource "aws_iam_policy" "cloudwatch_logs_extended" {
  name        = "${local.name_prefix}-cloudwatch-logs-extended"
  description = "Extended CloudWatch Logs permissions for application logging"
  policy      = data.aws_iam_policy_document.cloudwatch_logs_extended.json

  tags = {
    Name = "${local.name_prefix}-cloudwatch-logs-extended"
  }
}

data "aws_iam_policy_document" "cloudwatch_logs_extended" {
  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams"
    ]

    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ec2/${var.project_name}/*"
    ]
  }
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs_extended" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.cloudwatch_logs_extended.arn
}

#------------------------------------------------------------------------------
# Custom Policy for Parameter Store (Optional)
#------------------------------------------------------------------------------

# Uncomment to allow EC2 instances to read configuration from SSM Parameter Store

# resource "aws_iam_policy" "parameter_store_read" {
#   name        = "${local.name_prefix}-parameter-store-read"
#   description = "Allow reading configuration from SSM Parameter Store"
#   policy      = data.aws_iam_policy_document.parameter_store_read.json
#
#   tags = {
#     Name = "${local.name_prefix}-parameter-store-read"
#   }
# }
#
# data "aws_iam_policy_document" "parameter_store_read" {
#   statement {
#     effect = "Allow"
#
#     actions = [
#       "ssm:GetParameter",
#       "ssm:GetParameters",
#       "ssm:GetParametersByPath"
#     ]
#
#     resources = [
#       "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/${var.environment}/*"
#     ]
#   }
# }
#
# resource "aws_iam_role_policy_attachment" "parameter_store_read" {
#   role       = aws_iam_role.ec2_role.name
#   policy_arn = aws_iam_policy.parameter_store_read.arn
# }

#------------------------------------------------------------------------------
# Custom Policy for X-Ray (Optional)
#------------------------------------------------------------------------------

# Uncomment to enable AWS X-Ray tracing for application performance monitoring

# resource "aws_iam_role_policy_attachment" "xray" {
#   role       = aws_iam_role.ec2_role.name
#   policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
# }
