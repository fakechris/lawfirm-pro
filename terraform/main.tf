terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "lawfirmpro"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  project_name     = "lawfirmpro"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
  
  # CIDR blocks for networking
  vpc_cidr = var.vpc_cidr
  private_subnets = slice(cidrsubnets(local.vpc_cidr, 3, 3, 3), 0, var.availability_zone_count)
  public_subnets  = slice(cidrsubnets(local.vpc_cidr, 3, 3, 3), var.availability_zone_count, var.availability_zone_count * 2)
  database_subnets = slice(cidrsubnets(local.vpc_cidr, 3, 3, 3), var.availability_zone_count * 2, var.availability_zone_count * 3)
}

# Network Module
module "network" {
  source = "./modules/network"

  vpc_cidr              = local.vpc_cidr
  environment           = var.environment
  availability_zones    = data.aws_availability_zones.available.names
  private_subnets       = local.private_subnets
  public_subnets        = local.public_subnets
  database_subnets      = local.database_subnets
  enable_nat_gateway    = true
  single_nat_gateway    = true
  enable_vpn_gateway    = false
  tags                  = local.common_tags
}

# Security Module
module "security" {
  source = "./modules/security"

  vpc_id                = module.network.vpc_id
  environment           = var.environment
  tags                  = local.common_tags
  enable_ssh_access     = var.enable_ssh_access
  ssh_allowed_ips       = var.ssh_allowed_ips
}

# Compute Module
module "compute" {
  source = "./modules/compute"

  vpc_id                = module.network.vpc_id
  environment           = var.environment
  private_subnet_ids    = module.network.private_subnet_ids
  public_subnet_ids     = module.network.public_subnet_ids
  alb_security_group_id = module.security.alb_security_group_id
  app_security_group_id = module.security.app_security_group_id
  tags                  = local.common_tags
  ssl_certificate_arn   = var.ssl_certificate_arn
  domain_name           = var.domain_name
  enable_bastion        = var.enable_ssh_access
  bastion_instance_type = "t3.micro"
  ssh_key_name          = var.ssh_key_name != "" ? var.ssh_key_name : null
}

# Database Module
module "database" {
  source = "./modules/database"

  vpc_id                     = module.network.vpc_id
  environment                = var.environment
  database_subnet_ids        = module.network.database_subnet_ids
  database_security_group_id = module.security.database_security_group_id
  tags                       = local.common_tags
  database_instance_class    = var.database_instance_class
  database_allocated_storage = var.database_allocated_storage
  database_backup_retention  = var.database_backup_retention
  database_name              = "lawfirmpro_${var.environment}"
  database_username          = "lawfirm"
  database_password          = var.database_password
  redis_node_type            = var.redis_node_type
  redis_parameter_group_name = "default.redis7"
  enable_multi_az            = var.environment == "production"
  enable_read_replica        = var.environment == "production"
}

# Kubernetes Module
module "kubernetes" {
  source = "./modules/kubernetes"

  cluster_name               = "${var.environment}-lawfirmpro-cluster"
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  public_subnet_ids          = module.network.public_subnet_ids
  eks_node_role_arn          = module.compute.eks_node_role_arn
  kubernetes_cluster_version = var.kubernetes_cluster_version
  node_instance_type         = var.node_instance_type
  desired_node_count         = var.desired_node_count
  max_node_count             = var.max_node_count
  min_node_count             = var.min_node_count
  tags                       = local.common_tags
  enable_cluster_autoscaler  = true
  enable_metrics_server      = true
  enable_aws_load_balancer_controller = true
  ssh_key_name               = var.ssh_key_name
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "main" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/aws/lawfirmpro/${var.environment}"
  retention_in_days = var.environment == "production" ? 365 : 30

  tags = local.common_tags
}

# SSM Parameter Store for application configuration
resource "aws_ssm_parameter" "database_url" {
  name        = "/lawfirmpro/${var.environment}/database/url"
  description = "Database connection URL"
  type        = "SecureString"
  value       = "postgresql://${module.database.database_username}:${var.database_password}@${module.database.rds_endpoint}:5432/${module.database.database_name}"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "redis_url" {
  name        = "/lawfirmpro/${var.environment}/redis/url"
  description = "Redis connection URL"
  type        = "SecureString"
  value       = "redis://${module.database.redis_endpoint}:6379"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/lawfirmpro/${var.environment}/jwt/secret"
  description = "JWT secret key"
  type        = "SecureString"
  value       = var.jwt_secret

  tags = local.common_tags
}

resource "aws_ssm_parameter" "session_secret" {
  name        = "/lawfirmpro/${var.environment}/session/secret"
  description = "Session secret key"
  type        = "SecureString"
  value       = var.session_secret

  tags = local.common_tags
}