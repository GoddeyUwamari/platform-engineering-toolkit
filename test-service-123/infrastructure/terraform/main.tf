#==============================================================================
# Main Terraform Configuration
#==============================================================================
# This file defines the provider configuration and backend setup for the
# production API infrastructure deployment on AWS.
#
# Version Requirements:
# - Terraform >= 1.5.0
# - AWS Provider ~> 5.0
#==============================================================================

terraform {
  # Minimum Terraform version required
  required_version = ">= 1.5.0"

  # Required provider configurations
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure after initial deployment
  # backend "s3" {
  #   bucket         = "production-api-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

#==============================================================================
# Provider Configuration
#==============================================================================

provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
}

#==============================================================================
# Local Values
#==============================================================================

locals {
  # Common tags applied to all resources for better organization and cost tracking
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "production-api-framework"
    CreatedDate = timestamp()
  }

  # Naming convention for resources
  name_prefix = "${var.project_name}-${var.environment}"
}

#==============================================================================
# Data Sources
#==============================================================================

# Get current AWS account details
data "aws_caller_identity" "current" {}

# Get current AWS region
data "aws_region" "current" {}

# Get available availability zones in the region
data "aws_availability_zones" "available" {
  state = "available"
}
