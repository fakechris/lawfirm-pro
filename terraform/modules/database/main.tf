resource "aws_db_subnet_group" "main" {
  name       = "${var.environment}-db-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.environment}-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "main" {
  name        = "${var.environment}-db-parameter-group"
  family      = "postgres15"
  description = "Parameter group for PostgreSQL database"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-db-parameter-group"
  })
}

resource "aws_db_instance" "main" {
  identifier              = "${var.environment}-lawfirmpro-db"
  instance_class          = var.database_instance_class
  allocated_storage       = var.database_allocated_storage
  storage_type            = "gp3"
  engine                  = "postgres"
  engine_version          = "15.7"
  db_name                 = var.database_name
  username                = var.database_username
  password                = var.database_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [var.database_security_group_id]
  parameter_group_name    = aws_db_parameter_group.main.name
  backup_retention_period = var.database_backup_retention
  multi_az                = var.enable_multi_az
  storage_encrypted       = true
  skip_final_snapshot     = var.environment != "production"

  tags = merge(var.tags, {
    Name = "${var.environment}-lawfirmpro-db"
  })

  lifecycle {
    ignore_changes = [password]
  }
}

resource "aws_db_instance" "read_replica" {
  count                  = var.enable_read_replica ? 1 : 0
  identifier             = "${var.environment}-lawfirmpro-db-replica"
  instance_class         = var.database_instance_class
  replicate_source_db    = aws_db_instance.main.identifier
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.database_security_group_id]
  parameter_group_name   = aws_db_parameter_group.main.name
  storage_encrypted      = true
  skip_final_snapshot    = true

  tags = merge(var.tags, {
    Name = "${var.environment}-lawfirmpro-db-replica"
  })
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.environment}-redis-subnet-group"
  })
}

resource "aws_elasticache_parameter_group" "redis" {
  name        = "${var.environment}-redis-parameter-group"
  family      = var.redis_parameter_group_name
  description = "Parameter group for Redis"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-redis-parameter-group"
  })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.environment}-redis"
  replication_group_description = "Redis cluster for Law Firm Pro"
  node_type                    = var.redis_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [var.database_security_group_id]
  automatic_failover_enabled   = true
  multi_az_enabled             = true
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  num_cache_clusters           = 2

  tags = merge(var.tags, {
    Name = "${var.environment}-redis"
  })
}

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.environment}-lawfirmpro-uploads"

  tags = merge(var.tags, {
    Name = "${var.environment}-lawfirmpro-uploads"
  })
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}