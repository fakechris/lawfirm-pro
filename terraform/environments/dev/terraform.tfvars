# Development Environment
environment = "dev"
aws_region = "us-east-1"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zone_count = 2

# Application Configuration
domain_name = "dev.lawfirmpro.com"
enable_monitoring = true
enable_backup = true

# Kubernetes Configuration
kubernetes_cluster_version = "1.28"
node_instance_type = "t3.medium"
desired_node_count = 2
max_node_count = 4
min_node_count = 1

# Database Configuration
database_instance_class = "db.t3.medium"
database_allocated_storage = 50
database_backup_retention = 7
redis_node_type = "cache.t3.medium"

# Security Configuration
enable_ssh_access = false
ssh_allowed_ips = []

# SSL Certificate (for production, use ACM)
ssl_certificate_arn = ""