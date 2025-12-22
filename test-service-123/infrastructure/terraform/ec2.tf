#==============================================================================
# EC2 Instance Configuration
#==============================================================================
# This file creates EC2 instances for hosting the Node.js/TypeScript API.
#
# Features:
# - Uses latest Ubuntu 24.04 LTS AMI
# - Free tier eligible (t2.micro)
# - Automated setup via user data script
# - IAM instance profile for AWS service access
# - Public IP for internet access
#==============================================================================

#------------------------------------------------------------------------------
# Data Source: Latest Ubuntu 24.04 LTS AMI
#------------------------------------------------------------------------------

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu official)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}

#------------------------------------------------------------------------------
# SSH Key Pair
#------------------------------------------------------------------------------

resource "aws_key_pair" "deployer" {
  key_name   = "${local.name_prefix}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))

  tags = {
    Name = "${local.name_prefix}-key"
  }
}

#------------------------------------------------------------------------------
# EC2 Instance
#------------------------------------------------------------------------------

resource "aws_instance" "app_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  key_name                    = aws_key_pair.deployer.key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true
  user_data                   = local.user_data_script

  # Root volume configuration
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ec2_root_volume_size
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${local.name_prefix}-root-volume"
    }
  }

  # Enable detailed monitoring (free tier eligible)
  monitoring = true

  # Metadata options for enhanced security (IMDSv2)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = {
    Name = "${local.name_prefix}-app-server"
  }

  # Ensure IAM role is created first
  depends_on = [
    aws_iam_role_policy_attachment.cloudwatch,
    aws_iam_role_policy_attachment.ssm,
    aws_iam_role_policy_attachment.ecr
  ]
}

#------------------------------------------------------------------------------
# User Data Script
#------------------------------------------------------------------------------

locals {
  user_data_script = <<-EOF
    #!/bin/bash
    set -e

    # Log all output to a file for debugging
    exec > >(tee /var/log/user-data.log)
    exec 2>&1

    echo "=========================================="
    echo "Starting EC2 User Data Script"
    echo "Timestamp: $(date)"
    echo "=========================================="

    # Update system packages
    echo "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y

    # Install required packages
    echo "Installing required packages..."
    apt-get install -y \
      curl \
      wget \
      git \
      unzip \
      jq \
      ca-certificates \
      gnupg \
      lsb-release

    # Install Docker
    echo "Installing Docker..."

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker service
    systemctl start docker
    systemctl enable docker

    # Install Docker Compose standalone (v2.24.0)
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Create docker-compose symlink for compatibility
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    # Setup ubuntu user for Docker
    echo "Configuring ubuntu user for Docker..."
    usermod -aG docker ubuntu

    # Create application directory
    echo "Creating application directory..."
    mkdir -p /opt/production-api
    chown ubuntu:ubuntu /opt/production-api

    # Install AWS CloudWatch Agent
    echo "Installing AWS CloudWatch Agent..."
    wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb
    dpkg -i /tmp/amazon-cloudwatch-agent.deb
    rm /tmp/amazon-cloudwatch-agent.deb

    # Install AWS CLI v2
    echo "Installing AWS CLI v2..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip

    # Create CloudWatch agent configuration
    echo "Creating CloudWatch agent configuration..."
    cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'EOC'
    {
      "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "cwagent"
      },
      "logs": {
        "logs_collected": {
          "files": {
            "collect_list": [
              {
                "file_path": "/var/log/syslog",
                "log_group_name": "/aws/ec2/${var.project_name}/${var.environment}/syslog",
                "log_stream_name": "{instance_id}",
                "retention_in_days": 7
              },
              {
                "file_path": "/var/log/user-data.log",
                "log_group_name": "/aws/ec2/${var.project_name}/${var.environment}/user-data",
                "log_stream_name": "{instance_id}",
                "retention_in_days": 7
              },
              {
                "file_path": "/opt/production-api/logs/app.log",
                "log_group_name": "/aws/ec2/${var.project_name}/${var.environment}/application",
                "log_stream_name": "{instance_id}",
                "retention_in_days": 30
              }
            ]
          }
        }
      },
      "metrics": {
        "namespace": "${var.project_name}/${var.environment}",
        "metrics_collected": {
          "disk": {
            "measurement": [
              {
                "name": "used_percent",
                "rename": "DiskUsedPercent",
                "unit": "Percent"
              }
            ],
            "metrics_collection_interval": 300,
            "resources": [
              "*"
            ]
          },
          "mem": {
            "measurement": [
              {
                "name": "mem_used_percent",
                "rename": "MemoryUsedPercent",
                "unit": "Percent"
              }
            ],
            "metrics_collection_interval": 300
          }
        }
      }
    }
    EOC

    # Start CloudWatch agent
    echo "Starting CloudWatch agent..."
    /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
      -a fetch-config \
      -m ec2 \
      -s \
      -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json

    # Create environment file template
    echo "Creating environment file template..."
    cat > /opt/production-api/.env.template << 'EOE'
    # Database Configuration
    DB_HOST=${aws_db_instance.postgres.address}
    DB_PORT=${aws_db_instance.postgres.port}
    DB_NAME=${aws_db_instance.postgres.db_name}
    DB_USER=${aws_db_instance.postgres.username}
    DB_PASSWORD=CHANGE_THIS

    # Application Configuration
    NODE_ENV=${var.environment}
    APP_PORT=${var.app_port}

    # AWS Configuration
    AWS_REGION=${var.aws_region}
    AWS_ACCOUNT_ID=${data.aws_caller_identity.current.account_id}
    EOE

    chown ubuntu:ubuntu /opt/production-api/.env.template

    # Create a README for the ubuntu user
    cat > /home/ubuntu/README.txt << 'EOR'
    ==========================================
    Production API Server - Setup Complete
    ==========================================

    Docker and Docker Compose have been installed successfully.

    Application Directory: /opt/production-api

    Next Steps:
    1. Configure environment variables:
       cp /opt/production-api/.env.template /opt/production-api/.env
       nano /opt/production-api/.env

    2. Deploy your application using Docker Compose

    3. Check logs:
       - User Data: /var/log/user-data.log
       - Docker: docker logs <container-name>
       - CloudWatch: AWS Console

    Useful Commands:
    - docker --version
    - docker-compose --version
    - docker ps
    - systemctl status docker

    ==========================================
    EOR

    chown ubuntu:ubuntu /home/ubuntu/README.txt

    # Verify installations
    echo "=========================================="
    echo "Verifying installations..."
    docker --version
    docker-compose --version
    aws --version
    echo "=========================================="

    # Signal completion
    echo "User data script completed successfully at $(date)" > /var/log/user-data-complete.log

    echo "=========================================="
    echo "EC2 User Data Script Complete"
    echo "Timestamp: $(date)"
    echo "=========================================="
  EOF
}

#------------------------------------------------------------------------------
# Elastic IP (Optional - for static IP address)
#------------------------------------------------------------------------------

# Uncomment to assign a static Elastic IP to the EC2 instance
# This is useful if you need a consistent IP address across reboots
# Note: Elastic IPs are free when associated with a running instance

# resource "aws_eip" "app_server" {
#   domain   = "vpc"
#   instance = aws_instance.app_server.id
#
#   tags = {
#     Name = "${local.name_prefix}-eip"
#   }
#
#   depends_on = [aws_internet_gateway.main]
# }
