output "rds_instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "rds_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "rds_read_replica_endpoint" {
  description = "Endpoint of the RDS read replica"
  value       = var.enable_read_replica ? aws_db_instance.read_replica[0].endpoint : ""
}

output "redis_endpoint" {
  description = "Endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_configuration_endpoint" {
  description = "Configuration endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for uploads"
  value       = aws_s3_bucket.uploads.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for uploads"
  value       = aws_s3_bucket.uploads.arn
}