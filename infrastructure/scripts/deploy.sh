#!/bin/bash

# Law Firm Pro Infrastructure Deployment Script
# This script automates the deployment of infrastructure using Terraform and Helm

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"
HELM_DIR="$PROJECT_ROOT/kubernetes/helm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 <environment> <action>

Environment:
  dev         Development environment
  staging     Staging environment
  production  Production environment

Actions:
  init        Initialize Terraform and download dependencies
  plan        Show Terraform plan
  apply       Apply Terraform changes
  deploy      Deploy application using Helm
  destroy     Destroy infrastructure
  backup      Create backup
  restore     Restore from backup

Examples:
  $0 dev init
  $0 staging plan
  $0 production apply
  $0 dev deploy
EOF
}

# Function to validate environment
validate_environment() {
    local env=$1
    case $env in
        dev|staging|production)
            ;;
        *)
            error "Invalid environment: $env. Must be dev, staging, or production"
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    for tool in terraform helm kubectl aws; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed or not in PATH"
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
    fi
    
    log "Prerequisites check passed"
}

# Function to initialize Terraform
terraform_init() {
    local env=$1
    log "Initializing Terraform for environment: $env"
    
    cd "$TERRAFORM_DIR"
    
    # Create backend configuration
    cat > "backend-$env.tf" << EOF
terraform {
  backend "s3" {
    bucket = "lawfirmpro-terraform-state"
    key    = "$env/terraform.tfstate"
    region = "us-east-1"
    dynamodb_table = "lawfirmpro-terraform-lock"
    encrypt = true
  }
}
EOF
    
    terraform init -reconfigure
    
    log "Terraform initialized successfully"
}

# Function to run Terraform plan
terraform_plan() {
    local env=$1
    log "Running Terraform plan for environment: $env"
    
    cd "$TERRAFORM_DIR"
    
    terraform plan \
        -var-file="environments/$env/terraform.tfvars" \
        -out="plan-$env.out"
    
    log "Terraform plan completed"
}

# Function to apply Terraform changes
terraform_apply() {
    local env=$1
    log "Applying Terraform changes for environment: $env"
    
    cd "$TERRAFORM_DIR"
    
    terraform apply \
        -var-file="environments/$env/terraform.tfvars" \
        "plan-$env.out"
    
    log "Terraform apply completed"
}

# Function to deploy application
deploy_application() {
    local env=$1
    log "Deploying application to environment: $env"
    
    # Update kubeconfig
    aws eks update-kubeconfig --name "$env-lawfirmpro-cluster" --region us-east-1
    
    # Deploy using Helm
    helm upgrade --install lawfirmpro \
        "$HELM_DIR/lawfirmpro" \
        -f "$HELM_DIR/lawfirmpro/values-$env.yaml" \
        --namespace lawfirmpro \
        --create-namespace \
        --wait
    
    log "Application deployed successfully"
}

# Function to destroy infrastructure
destroy_infrastructure() {
    local env=$1
    warn "This will destroy all infrastructure for environment: $env"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Destruction cancelled"
        exit 0
    fi
    
    cd "$TERRAFORM_DIR"
    
    terraform destroy \
        -var-file="environments/$env/terraform.tfvars" \
        -auto-approve
    
    log "Infrastructure destroyed successfully"
}

# Function to create backup
create_backup() {
    local env=$1
    log "Creating backup for environment: $env"
    
    # Backup database
    aws rds create-db-snapshot \
        --db-instance-identifier "$env-lawfirmpro-db" \
        --db-snapshot-identifier "$env-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Backup S3 bucket
    aws s3 sync "s3://$env-lawfirmpro-uploads" "s3://$env-lawfirmpro-backups/uploads/$(date +%Y%m%d-%H%M%S)"
    
    log "Backup created successfully"
}

# Function to restore from backup
restore_backup() {
    local env=$1
    local snapshot_id=$2
    log "Restoring backup for environment: $env from snapshot: $snapshot_id"
    
    # Restore database
    aws rds restore-db-instance-from-db-snapshot \
        --db-instance-identifier "$env-lawfirmpro-db-restored" \
        --db-snapshot-identifier "$snapshot_id"
    
    log "Restore initiated. Monitor the restore process in AWS console."
}

# Main script execution
main() {
    if [[ $# -lt 2 ]]; then
        usage
        exit 1
    fi
    
    local environment=$1
    local action=$2
    
    validate_environment "$environment"
    check_prerequisites
    
    case $action in
        init)
            terraform_init "$environment"
            ;;
        plan)
            terraform_plan "$environment"
            ;;
        apply)
            terraform_plan "$environment"
            terraform_apply "$environment"
            ;;
        deploy)
            deploy_application "$environment"
            ;;
        destroy)
            destroy_infrastructure "$environment"
            ;;
        backup)
            create_backup "$environment"
            ;;
        restore)
            if [[ $# -ne 3 ]]; then
                error "Restore action requires snapshot ID"
            fi
            restore_backup "$environment" "$3"
            ;;
        *)
            error "Invalid action: $action"
            ;;
    esac
}

# Run main function with all arguments
main "$@"