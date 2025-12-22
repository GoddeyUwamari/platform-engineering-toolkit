#==============================================================================
# Input Variables
#==============================================================================
# This file defines all input variables for the infrastructure deployment.
# Default values are provided for most variables, but can be overridden in
# terraform.tfvars or via command-line flags.
#==============================================================================

#------------------------------------------------------------------------------
# Project Configuration
#------------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project, used for resource naming and tagging"
  type        = string
  default     = "production-api"

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 32
    error_message = "Project name must be between 1 and 32 characters."
  }
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development."
  }
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be a valid region format (e.g., us-east-1)."
  }
}

#------------------------------------------------------------------------------
# Networking Configuration
#------------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet (EC2 instances)"
  type        = string
  default     = "10.0.1.0/24"

  validation {
    condition     = can(cidrhost(var.public_subnet_cidr, 0))
    error_message = "Public subnet CIDR must be a valid IPv4 CIDR block."
  }
}

variable "private_subnet_cidr" {
  description = "CIDR block for the private subnet (RDS database)"
  type        = string
  default     = "10.0.2.0/24"

  validation {
    condition     = can(cidrhost(var.private_subnet_cidr, 0))
    error_message = "Private subnet CIDR must be a valid IPv4 CIDR block."
  }
}

variable "private_subnet_cidr_secondary" {
  description = "CIDR block for the secondary private subnet (required for RDS subnet group)"
  type        = string
  default     = "10.0.3.0/24"

  validation {
    condition     = can(cidrhost(var.private_subnet_cidr_secondary, 0))
    error_message = "Secondary private subnet CIDR must be a valid IPv4 CIDR block."
  }
}

#------------------------------------------------------------------------------
# EC2 Configuration
#------------------------------------------------------------------------------

variable "ec2_instance_type" {
  description = "EC2 instance type (t2.micro is free tier eligible)"
  type        = string
  default     = "t2.micro"

  validation {
    condition     = contains(["t2.micro", "t2.small", "t2.medium", "t3.micro", "t3.small"], var.ec2_instance_type)
    error_message = "Instance type must be a valid T2 or T3 instance type."
  }
}

variable "ec2_root_volume_size" {
  description = "Size of the EC2 root volume in GB (free tier: up to 30GB)"
  type        = number
  default     = 20

  validation {
    condition     = var.ec2_root_volume_size >= 8 && var.ec2_root_volume_size <= 30
    error_message = "Root volume size must be between 8 and 30 GB for free tier."
  }
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key for EC2 access"
  type        = string
  default     = "~/.ssh/production-api-key.pub"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into EC2 instances (restrict to your IP for security)"
  type        = string
  default     = "0.0.0.0/0"

  validation {
    condition     = can(cidrhost(var.allowed_ssh_cidr, 0))
    error_message = "Allowed SSH CIDR must be a valid IPv4 CIDR block."
  }
}

#------------------------------------------------------------------------------
# RDS Configuration
#------------------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class (db.t3.micro is free tier eligible)"
  type        = string
  default     = "db.t3.micro"

  validation {
    condition     = contains(["db.t3.micro", "db.t3.small", "db.t4g.micro", "db.t4g.small"], var.rds_instance_class)
    error_message = "RDS instance class must be a valid T3 or T4g instance type."
  }
}

variable "db_name" {
  description = "Name of the PostgreSQL database to create"
  type        = string
  default     = "api_db"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  description = "Master username for the RDS database"
  type        = string
  default     = "dbadmin"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_username)) && length(var.db_username) >= 4
    error_message = "Database username must start with a letter, be at least 4 characters, and contain only alphanumeric characters and underscores."
  }
}

variable "db_password" {
  description = "Master password for the RDS database (minimum 8 characters)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8
    error_message = "Database password must be at least 8 characters long."
  }
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB (free tier: up to 20GB)"
  type        = number
  default     = 20

  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 100
    error_message = "Allocated storage must be between 20 and 100 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS autoscaling in GB"
  type        = number
  default     = 30

  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "Maximum allocated storage must be greater than or equal to allocated storage."
  }
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated backups (0-35 days)"
  type        = number
  default     = 1

  validation {
    condition     = var.db_backup_retention_period >= 0 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days."
  }
}

variable "db_backup_window" {
  description = "Preferred backup window (UTC) in format HH:MM-HH:MM"
  type        = string
  default     = "03:00-04:00"

  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.db_backup_window))
    error_message = "Backup window must be in format HH:MM-HH:MM (UTC)."
  }
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window in format ddd:HH:MM-ddd:HH:MM"
  type        = string
  default     = "sun:04:00-sun:05:00"

  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]$", var.db_maintenance_window))
    error_message = "Maintenance window must be in format ddd:HH:MM-ddd:HH:MM."
  }
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.8"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+$", var.db_engine_version))
    error_message = "Database engine version must be in format X.Y (e.g., 15.8)."
  }
}

#------------------------------------------------------------------------------
# Application Configuration
#------------------------------------------------------------------------------

variable "app_port" {
  description = "Port number for the application"
  type        = number
  default     = 3000

  validation {
    condition     = var.app_port > 0 && var.app_port < 65536
    error_message = "Application port must be between 1 and 65535."
  }
}

#------------------------------------------------------------------------------
# Monitoring & Logging
#------------------------------------------------------------------------------

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs for RDS"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights for RDS (free tier: 7 days retention)"
  type        = bool
  default     = false
}

#------------------------------------------------------------------------------
# Feature Flags
#------------------------------------------------------------------------------

variable "enable_deletion_protection" {
  description = "Enable deletion protection for RDS (recommended for production)"
  type        = bool
  default     = true
}

variable "enable_backup_retention" {
  description = "Enable automated backups for RDS"
  type        = bool
  default     = true
}

#------------------------------------------------------------------------------
# Monitoring Configuration
#------------------------------------------------------------------------------

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = "your-email@example.com"
}
