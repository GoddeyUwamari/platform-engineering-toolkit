#==============================================================================
# Security Groups
#==============================================================================
# This file defines security groups that control inbound and outbound traffic
# for EC2 instances and RDS databases following the principle of least privilege.
#
# Security Architecture:
# - EC2 Security Group: Allows SSH, HTTP, HTTPS, and application traffic
# - RDS Security Group: Only allows PostgreSQL traffic from EC2 instances
#==============================================================================

#------------------------------------------------------------------------------
# EC2 Security Group
#------------------------------------------------------------------------------

resource "aws_security_group" "ec2" {
  name        = "${local.name_prefix}-ec2-sg"
  description = "Security group for EC2 application servers"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ec2-sg"
  }
}

#------------------------------------------------------------------------------
# EC2 Ingress Rules
#------------------------------------------------------------------------------

# SSH access (port 22)
resource "aws_vpc_security_group_ingress_rule" "ec2_ssh" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow SSH access from specified CIDR"

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 22
  to_port     = 22
  ip_protocol = "tcp"

  tags = {
    Name = "${local.name_prefix}-ec2-ssh"
  }
}

# HTTP access (port 80)
resource "aws_vpc_security_group_ingress_rule" "ec2_http" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow HTTP access from anywhere"

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"

  tags = {
    Name = "${local.name_prefix}-ec2-http"
  }
}

# HTTPS access (port 443)
resource "aws_vpc_security_group_ingress_rule" "ec2_https" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow HTTPS access from anywhere"

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"

  tags = {
    Name = "${local.name_prefix}-ec2-https"
  }
}

# Application port access (default: 3000)
resource "aws_vpc_security_group_ingress_rule" "ec2_app" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow application access from anywhere"

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = var.app_port
  to_port     = var.app_port
  ip_protocol = "tcp"

  tags = {
    Name = "${local.name_prefix}-ec2-app"
  }
}

#------------------------------------------------------------------------------
# EC2 Egress Rules
#------------------------------------------------------------------------------

# Allow all outbound traffic
resource "aws_vpc_security_group_egress_rule" "ec2_all_outbound" {
  security_group_id = aws_security_group.ec2.id
  description       = "Allow all outbound traffic"

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  tags = {
    Name = "${local.name_prefix}-ec2-egress"
  }
}

#------------------------------------------------------------------------------
# RDS Security Group
#------------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

#------------------------------------------------------------------------------
# RDS Ingress Rules
#------------------------------------------------------------------------------

# PostgreSQL access from EC2 instances only
resource "aws_vpc_security_group_ingress_rule" "rds_postgres" {
  security_group_id = aws_security_group.rds.id
  description       = "Allow PostgreSQL access from EC2 instances only"

  # Reference the EC2 security group instead of CIDR for better security
  referenced_security_group_id = aws_security_group.ec2.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"

  tags = {
    Name = "${local.name_prefix}-rds-postgres"
  }
}

#------------------------------------------------------------------------------
# RDS Egress Rules
#------------------------------------------------------------------------------

# RDS typically doesn't need egress rules, but we allow none for security
# If you need RDS to make outbound connections (e.g., for extensions),
# uncomment the following rule:

# resource "aws_vpc_security_group_egress_rule" "rds_all_outbound" {
#   security_group_id = aws_security_group.rds.id
#   description       = "Allow all outbound traffic"
#
#   cidr_ipv4   = "0.0.0.0/0"
#   ip_protocol = "-1"
#
#   tags = {
#     Name = "${local.name_prefix}-rds-egress"
#   }
# }

#------------------------------------------------------------------------------
# Security Group Outputs (for reference)
#------------------------------------------------------------------------------

# These are also defined in outputs.tf, but included here for clarity
# when reviewing security configurations

# EC2 Security Group ID: aws_security_group.ec2.id
# RDS Security Group ID: aws_security_group.rds.id
