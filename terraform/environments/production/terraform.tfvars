# Production Environment
environment = "production"
aws_region = "us-east-1"

# VPC Configuration
vpc_cidr = "10.2.0.0/16"
availability_zone_count = 3

# Application Configuration
domain_name = "lawfirmpro.com"
enable_monitoring = true
enable_backup = true

# Kubernetes Configuration
kubernetes_cluster_version = "1.28"
node_instance_type = "t3.large"
desired_node_count = 6
max_node_count = 12
min_node_count = 3

# Database Configuration
database_instance_class = "db.t3.large"
database_allocated_storage = 500
database_backup_retention = 30
redis_node_type = "cache.t3.large"

# Security Configuration
enable_ssh_access = true
ssh_allowed_ips = ["192.168.1.0/24", "10.0.0.0/16"]

# SSL Certificate (for production, use ACM)
ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/abc123"