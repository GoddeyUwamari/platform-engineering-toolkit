#==============================================================================
# VPC and Networking Resources
#==============================================================================
# This file creates the Virtual Private Cloud (VPC) and all networking
# components including subnets, internet gateway, and route tables.
#
# Architecture:
# - 1 VPC (10.0.0.0/16)
# - 1 Public Subnet (10.0.1.0/24) for EC2 instances
# - 2 Private Subnets (10.0.2.0/24, 10.0.3.0/24) for RDS (multi-AZ requirement)
# - Internet Gateway for public internet access
# - Route tables for public and private subnets
#==============================================================================

#------------------------------------------------------------------------------
# VPC
#------------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

#------------------------------------------------------------------------------
# Internet Gateway
#------------------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

#------------------------------------------------------------------------------
# Public Subnet (for EC2 instances)
#------------------------------------------------------------------------------

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-subnet"
    Type = "Public"
  }
}

#------------------------------------------------------------------------------
# Private Subnets (for RDS - requires at least 2 AZs)
#------------------------------------------------------------------------------

resource "aws_subnet" "private_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-subnet-1"
    Type = "Private"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_subnet_cidr_secondary
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-subnet-2"
    Type = "Private"
  }
}

#------------------------------------------------------------------------------
# Route Table for Public Subnet
#------------------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # Route to Internet Gateway for public internet access
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
    Type = "Public"
  }
}

# Associate public route table with public subnet
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

#------------------------------------------------------------------------------
# Route Table for Private Subnets
#------------------------------------------------------------------------------

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # No route to internet gateway - private subnets remain isolated
  # NAT Gateway intentionally omitted to stay within free tier

  tags = {
    Name = "${local.name_prefix}-private-rt"
    Type = "Private"
  }
}

# Associate private route table with private subnet 1
resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.private_1.id
  route_table_id = aws_route_table.private.id
}

# Associate private route table with private subnet 2
resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.private_2.id
  route_table_id = aws_route_table.private.id
}

#------------------------------------------------------------------------------
# VPC Endpoints (Optional - for private AWS service access)
#------------------------------------------------------------------------------

# VPC Endpoint for S3 (free tier eligible)
# Allows private subnet resources to access S3 without internet gateway
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "${local.name_prefix}-s3-endpoint"
  }
}

#------------------------------------------------------------------------------
# DB Subnet Group (Required for RDS)
#------------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for RDS instances"
  subnet_ids  = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}
