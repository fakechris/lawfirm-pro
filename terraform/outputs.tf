output "vpc_id" {
  description = "ID of the VPC"
  value       = module.network.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.network.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.network.public_subnet_ids
}

output "database_subnet_ids" {
  description = "IDs of database subnets"
  value       = module.network.database_subnet_ids
}

output "kubernetes_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.kubernetes.cluster_name
}

output "kubernetes_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = module.kubernetes.cluster_endpoint
}

output "kubernetes_cluster_ca_certificate" {
  description = "CA certificate of the EKS cluster"
  value       = module.kubernetes.cluster_ca_certificate
}

output "load_balancer_dns" {
  description = "DNS name of the application load balancer"
  value       = module.compute.alb_dns_name
}

output "database_endpoint" {
  description = "Endpoint of the RDS database"
  value       = module.database.rds_endpoint
}

output "redis_endpoint" {
  description = "Endpoint of the Redis cluster"
  value       = module.database.redis_endpoint
}

output "security_group_ids" {
  description = "Security group IDs"
  value = {
    alb        = module.security.alb_security_group_id
    app        = module.security.app_security_group_id
    database   = module.security.database_security_group_id
    monitoring = module.security.monitoring_security_group_id
  }
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node role"
  value       = module.compute.eks_node_role_arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = var.enable_monitoring ? aws_cloudwatch_log_group.main[0].name : ""
}