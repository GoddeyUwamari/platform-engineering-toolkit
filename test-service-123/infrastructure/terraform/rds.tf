#==============================================================================
# RDS PostgreSQL Database
#==============================================================================
# This file creates an RDS PostgreSQL database instance for the application.
#
# Features:
# - PostgreSQL 15.8
# - Free tier eligible (db.t3.micro)
# - Encrypted storage
# - Automated backups
# - Private subnet deployment
# - Enhanced monitoring and logging
#==============================================================================

#------------------------------------------------------------------------------
# Parameter Group
#------------------------------------------------------------------------------
resource "aws_db_parameter_group" "postgres" {
  name        = "${local.name_prefix}-postgres-params"
  family      = "postgres15"
  description = "Custom parameter group for PostgreSQL 15"

  # Performance and connection parameters
  parameter {
    apply_method = "pending-reboot"  # Static parameter - requires reboot
    name         = "max_connections"
    value        = "100"
  }

  parameter {
    apply_method = "pending-reboot"  # Static parameter - requires reboot
    name         = "shared_buffers"
    value        = "{DBInstanceClassMemory/32768}"
  }

  # Logging parameters for better debugging (all dynamic - can apply immediately)
  parameter {
    apply_method = "immediate"
    name         = "log_connections"
    value        = "1"
  }

  parameter {
    apply_method = "immediate"
    name         = "log_disconnections"
    value        = "1"
  }

  parameter {
    apply_method = "immediate"
    name         = "log_duration"
    value        = "1"
  }

  parameter {
    apply_method = "immediate"
    name         = "log_min_duration_statement"
    value        = "1000"
  }

  tags = {
    Name = "${local.name_prefix}-postgres-params"
  }
}
   
#------------------------------------------------------------------------------
# RDS Instance
#------------------------------------------------------------------------------

resource "aws_db_instance" "postgres" {
  # Instance identification
  identifier = "${local.name_prefix}-postgres"

  # Engine configuration
  engine               = "postgres"
  engine_version       = var.db_engine_version
  instance_class       = var.rds_instance_class
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  # Use default AWS managed KMS key for free tier
  # For custom KMS key: kms_key_id = aws_kms_key.rds.arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Availability and maintenance
  multi_az                = false # Set to true for production high availability (additional cost)
  availability_zone       = data.aws_availability_zones.available.names[0]
  backup_retention_period = var.enable_backup_retention ? var.db_backup_retention_period : 0
  backup_window           = var.db_backup_window
  maintenance_window      = var.db_maintenance_window

  # Backup configuration
  skip_final_snapshot       = var.environment != "production" # Create final snapshot in production
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  copy_tags_to_snapshot     = true

  # Deletion protection
  deletion_protection = var.enable_deletion_protection

  # Monitoring and logging
  enabled_cloudwatch_logs_exports = var.enable_cloudwatch_logs ? ["postgresql", "upgrade"] : []
  monitoring_interval             = 60 # Enhanced monitoring every 60 seconds (free tier: 60 seconds)
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  # Performance Insights (optional - free tier: 7 days retention)
  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.enable_performance_insights ? 7 : null

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Apply changes immediately (set to false for production to use maintenance window)
  apply_immediately = var.environment != "production"

  tags = {
    Name = "${local.name_prefix}-postgres"
  }

  # Ensure subnet group and security group are created first
  depends_on = [
    aws_db_subnet_group.main,
    aws_security_group.rds
  ]

  lifecycle {
    # Prevent accidental deletion of database
    prevent_destroy = false # Set to true for production after initial creation

    # Ignore changes to password (manage separately via AWS Secrets Manager)
    ignore_changes = [
      password
    ]
  }
}

#------------------------------------------------------------------------------
# IAM Role for Enhanced Monitoring
#------------------------------------------------------------------------------

resource "aws_iam_role" "rds_monitoring" {
  name               = "${local.name_prefix}-rds-monitoring-role"
  description        = "IAM role for RDS enhanced monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume.json

  tags = {
    Name = "${local.name_prefix}-rds-monitoring-role"
  }
}

data "aws_iam_policy_document" "rds_monitoring_assume" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

#------------------------------------------------------------------------------
# CloudWatch Alarms (Optional - for monitoring)
#------------------------------------------------------------------------------

# CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.name_prefix}-rds-cpu-utilization"
  alarm_description   = "Alert when database CPU exceeds 80%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = {
    Name = "${local.name_prefix}-rds-cpu-alarm"
  }
}

# Storage Space Alarm
resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${local.name_prefix}-rds-storage-space"
  alarm_description   = "Alert when database free storage is low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2000000000 # 2 GB in bytes
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = {
    Name = "${local.name_prefix}-rds-storage-alarm"
  }
}

# Database Connections Alarm
resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${local.name_prefix}-rds-connections"
  alarm_description   = "Alert when database connections exceed 80"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = {
    Name = "${local.name_prefix}-rds-connections-alarm"
  }
}

#------------------------------------------------------------------------------
# Secrets Manager Integration (Optional - for password rotation)
#------------------------------------------------------------------------------

# Uncomment to store database credentials in AWS Secrets Manager
# This enables automatic password rotation and better security

# resource "aws_secretsmanager_secret" "db_credentials" {
#   name        = "${local.name_prefix}-db-credentials"
#   description = "Database credentials for ${var.project_name} ${var.environment}"
#
#   tags = {
#     Name = "${local.name_prefix}-db-credentials"
#   }
# }
#
# resource "aws_secretsmanager_secret_version" "db_credentials" {
#   secret_id = aws_secretsmanager_secret.db_credentials.id
#   secret_string = jsonencode({
#     username = aws_db_instance.postgres.username
#     password = var.db_password
#     engine   = "postgres"
#     host     = aws_db_instance.postgres.address
#     port     = aws_db_instance.postgres.port
#     dbname   = aws_db_instance.postgres.db_name
#   })
# }
