# Staging Environment
environment = "staging"
aws_region = "us-east-1"

# VPC Configuration
vpc_cidr = "10.1.0.0/16"
availability_zone_count = 3

# Application Configuration
domain_name = "staging.lawfirmpro.com"
enable_monitoring = true
enable_backup = true

# Kubernetes Configuration
kubernetes_cluster_version = "1.28"
node_instance_type = "t3.medium"
desired_node_count = 3
max_node_count = 6
min_node_count = 2

# Database Configuration
database_instance_class = "db.t3.medium"
database_allocated_storage = 100
database_backup_retention = 14
redis_node_type = "cache.t3.medium"

# Security Configuration
enable_ssh_access = true
ssh_allowed_ips = ["192.168.1.0/24"]

# SSL Certificate (for production, use ACM)
ssl_certificate_arn = ""