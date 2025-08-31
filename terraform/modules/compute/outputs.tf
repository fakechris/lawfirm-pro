output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.app.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.app.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.app.zone_id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.app.arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node role"
  value       = aws_iam_role.eks_node_role.arn
}

output "eks_node_instance_profile_arn" {
  description = "ARN of the EKS node instance profile"
  value       = aws_iam_instance_profile.eks_node.arn
}

output "bastion_public_ip" {
  description = "Public IP of the bastion host"
  value       = var.enable_bastion ? aws_instance.bastion[0].public_ip : ""
}

output "bastion_id" {
  description = "ID of the bastion host"
  value       = var.enable_bastion ? aws_instance.bastion[0].id : ""
}