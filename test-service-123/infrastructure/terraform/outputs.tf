#==============================================================================
# Output Values
#==============================================================================
# This file defines outputs that are displayed after successful deployment.
# These values are essential for connecting to and managing the infrastructure.
#==============================================================================

#------------------------------------------------------------------------------
# EC2 Instance Outputs
#------------------------------------------------------------------------------

output "ec2_instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app_server.id
}

output "ec2_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.app_server.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.app_server.public_dns
}

output "ec2_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = aws_instance.app_server.private_ip
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = "ssh -i ~/.ssh/production-api-key ubuntu@${aws_instance.app_server.public_ip}"
}

#------------------------------------------------------------------------------
# RDS Database Outputs
#------------------------------------------------------------------------------

output "rds_endpoint" {
  description = "Connection endpoint for the RDS instance (hostname:port)"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "Hostname of the RDS instance"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Port number of the RDS instance"
  value       = aws_db_instance.postgres.port
}

output "database_name" {
  description = "Name of the PostgreSQL database"
  value       = aws_db_instance.postgres.db_name
}

output "database_username" {
  description = "Master username for the RDS database"
  value       = aws_db_instance.postgres.username
  sensitive   = true
}

#------------------------------------------------------------------------------
# VPC & Networking Outputs
#------------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

#------------------------------------------------------------------------------
# Security Group Outputs
#------------------------------------------------------------------------------

output "ec2_security_group_id" {
  description = "ID of the EC2 security group"
  value       = aws_security_group.ec2.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

#------------------------------------------------------------------------------
# IAM Role Outputs
#------------------------------------------------------------------------------

output "ec2_iam_role_arn" {
  description = "ARN of the EC2 IAM role"
  value       = aws_iam_role.ec2_role.arn
}

output "ec2_instance_profile_name" {
  description = "Name of the EC2 instance profile"
  value       = aws_iam_instance_profile.ec2_profile.name
}

#------------------------------------------------------------------------------
# Connection Information
#------------------------------------------------------------------------------

output "application_url" {
  description = "URL to access the application (once deployed)"
  value       = "http://${aws_instance.app_server.public_ip}:${var.app_port}"
}

output "database_connection_string" {
  description = "Database connection string for the application (password not included)"
  value       = "postgresql://${aws_db_instance.postgres.username}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"
  sensitive   = true
}

#------------------------------------------------------------------------------
# Environment Variables for Application
#------------------------------------------------------------------------------

output "env_variables" {
  description = "Environment variables to configure on the EC2 instance"
  value = {
    DB_HOST    = aws_db_instance.postgres.address
    DB_PORT    = aws_db_instance.postgres.port
    DB_NAME    = aws_db_instance.postgres.db_name
    DB_USER    = aws_db_instance.postgres.username
    NODE_ENV   = var.environment
    APP_PORT   = var.app_port
    AWS_REGION = var.aws_region
  }
  sensitive = true
}

#------------------------------------------------------------------------------
# Deployment Summary
#------------------------------------------------------------------------------

output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    project            = var.project_name
    environment        = var.environment
    region             = var.aws_region
    ec2_instance_type  = var.ec2_instance_type
    ec2_public_ip      = aws_instance.app_server.public_ip
    rds_instance_class = var.rds_instance_class
    rds_endpoint       = aws_db_instance.postgres.endpoint
    vpc_cidr           = var.vpc_cidr
    deployment_date    = timestamp()
  }
}

#------------------------------------------------------------------------------
# Next Steps Instructions
#------------------------------------------------------------------------------

output "next_steps" {
  description = "Instructions for next steps after deployment"
  value       = <<-EOT

    ==========================================
    DEPLOYMENT COMPLETE!
    ==========================================

    Next Steps:

    1. Connect to your EC2 instance:
       ${format("ssh -i ~/.ssh/production-api-key ubuntu@%s", aws_instance.app_server.public_ip)}

    2. Verify Docker is installed:
       docker --version
       docker-compose --version

    3. Set up environment variables on EC2:
       - DB_HOST=${aws_db_instance.postgres.address}
       - DB_PORT=${aws_db_instance.postgres.port}
       - DB_NAME=${aws_db_instance.postgres.db_name}
       - DB_USER=${aws_db_instance.postgres.username}
       - DB_PASSWORD=<your-database-password>

    4. Deploy your application using Docker Compose

    5. Access your application at:
       http://${aws_instance.app_server.public_ip}:${var.app_port}

    Security Reminders:
    - Store DB_PASSWORD securely (use AWS Secrets Manager or SSM Parameter Store)
    - Consider restricting SSH access (current: ${var.allowed_ssh_cidr})
    - Set up SSL/TLS certificates for production traffic
    - Enable CloudWatch monitoring and set up alerts

    ==========================================
  EOT
}
