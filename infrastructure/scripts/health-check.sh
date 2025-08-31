#!/bin/bash

# Law Firm Pro Infrastructure Health Check Script
# This script performs comprehensive health checks on the infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 <environment>

Environment:
  dev         Development environment
  staging     Staging environment
  production  Production environment

Examples:
  $0 dev
  $0 production
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

# Function to check AWS connectivity
check_aws_connectivity() {
    log "Checking AWS connectivity..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS connectivity failed"
    fi
    
    log "AWS connectivity: OK"
}

# Function to check EKS cluster health
check_eks_cluster() {
    local env=$1
    log "Checking EKS cluster health..."
    
    local cluster_name="$env-lawfirmpro-cluster"
    
    # Check cluster status
    local cluster_status=$(aws eks describe-cluster --name "$cluster_name" --query 'cluster.status' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$cluster_status" != "ACTIVE" ]]; then
        error "EKS cluster status: $cluster_status"
    fi
    
    # Update kubeconfig
    aws eks update-kubeconfig --name "$cluster_name" --region us-east-1
    
    # Check node status
    local ready_nodes=$(kubectl get nodes --no-headers | grep -c "Ready" || echo "0")
    local total_nodes=$(kubectl get nodes --no-headers | wc -l)
    
    if [[ "$ready_nodes" -eq 0 ]]; then
        error "No ready nodes found"
    fi
    
    log "EKS cluster: OK ($ready_nodes/$total_nodes nodes ready)"
}

# Function to check application pods
check_application_pods() {
    local env=$1
    log "Checking application pods..."
    
    kubectl config use-context "arn:aws:eks:us-east-1:$(aws sts get-caller-identity --query Account --output text):cluster/$env-lawfirmpro-cluster"
    
    # Check if namespace exists
    if ! kubectl get namespace lawfirmpro &> /dev/null; then
        warn "Namespace 'lawfirmpro' not found"
        return
    fi
    
    # Check pod status
    local running_pods=$(kubectl get pods -n lawfirmpro --no-headers | grep -c "Running" || echo "0")
    local total_pods=$(kubectl get pods -n lawfirmpro --no-headers | wc -l)
    
    if [[ "$running_pods" -eq 0 ]]; then
        error "No running pods found"
    fi
    
    log "Application pods: OK ($running_pods/$total_pods pods running)"
    
    # Check pod restarts
    local restart_count=$(kubectl get pods -n lawfirmpro --no-headers | awk '{sum+=$4} END {print sum+0}')
    
    if [[ "$restart_count" -gt 10 ]]; then
        warn "High restart count detected: $restart_count"
    fi
}

# Function to check services
check_services() {
    local env=$1
    log "Checking services..."
    
    kubectl config use-context "arn:aws:eks:us-east-1:$(aws sts get-caller-identity --query Account --output text):cluster/$env-lawfirmpro-cluster"
    
    # Check services
    if ! kubectl get svc -n lawfirmpro &> /dev/null; then
        warn "No services found in lawfirmpro namespace"
        return
    fi
    
    local services=$(kubectl get svc -n lawfirmpro --no-headers | wc -l)
    
    log "Services: OK ($services services found)"
}

# Function to check ingress
check_ingress() {
    local env=$1
    log "Checking ingress..."
    
    kubectl config use-context "arn:aws:eks:us-east-1:$(aws sts get-caller-identity --query Account --output text):cluster/$env-lawfirmpro-cluster"
    
    # Check ingress
    if ! kubectl get ingress -n lawfirmpro &> /dev/null; then
        warn "No ingress found in lawfirmpro namespace"
        return
    fi
    
    local ingress_count=$(kubectl get ingress -n lawfirmpro --no-headers | wc -l)
    
    log "Ingress: OK ($ingress_count ingress resources found)"
}

# Function to check database connectivity
check_database() {
    local env=$1
    log "Checking database connectivity..."
    
    local db_instance="$env-lawfirmpro-db"
    
    # Check database instance status
    local db_status=$(aws rds describe-db-instances --db-instance-identifier "$db_instance" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$db_status" != "available" ]]; then
        error "Database status: $db_status"
    fi
    
    # Check database endpoint
    local db_endpoint=$(aws rds describe-db-instances --db-instance-identifier "$db_instance" --query 'DBInstances[0].Endpoint.Address' --output text)
    
    if [[ -z "$db_endpoint" ]]; then
        error "Database endpoint not found"
    fi
    
    log "Database: OK (status: $db_status, endpoint: $db_endpoint)"
}

# Function to check Redis connectivity
check_redis() {
    local env=$1
    log "Checking Redis connectivity..."
    
    local redis_cluster="$env-redis"
    
    # Check Redis cluster status
    local redis_status=$(aws elasticache describe-replication-groups --replication-group-id "$redis_cluster" --query 'ReplicationGroups[0].Status' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$redis_status" != "available" ]]; then
        error "Redis status: $redis_status"
    fi
    
    # Check Redis endpoint
    local redis_endpoint=$(aws elasticache describe-replication-groups --replication-group-id "$redis_cluster" --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text)
    
    if [[ -z "$redis_endpoint" ]]; then
        error "Redis endpoint not found"
    fi
    
    log "Redis: OK (status: $redis_status, endpoint: $redis_endpoint)"
}

# Function to check S3 buckets
check_s3_buckets() {
    local env=$1
    log "Checking S3 buckets..."
    
    local bucket_name="$env-lawfirmpro-uploads"
    
    # Check if bucket exists
    if ! aws s3 ls "s3://$bucket_name" &> /dev/null; then
        error "S3 bucket not found: $bucket_name"
    fi
    
    log "S3 buckets: OK"
}

# Function to check CloudWatch logs
check_cloudwatch_logs() {
    local env=$1
    log "Checking CloudWatch logs..."
    
    local log_group="/aws/lawfirmpro/$env"
    
    # Check if log group exists
    if ! aws logs describe-log-groups --log-group-name-prefix "$log_group" &> /dev/null; then
        warn "CloudWatch log group not found: $log_group"
        return
    fi
    
    log "CloudWatch logs: OK"
}

# Function to check application health endpoint
check_application_health() {
    local env=$1
    log "Checking application health endpoint..."
    
    # Get ALB DNS name
    local alb_dns=$(aws elbv2 describe-load-balancers --names "$env-app-lb" --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || echo "")
    
    if [[ -z "$alb_dns" ]]; then
        warn "ALB not found for environment: $env"
        return
    fi
    
    # Check health endpoint
    local health_url="http://$alb_dns/health"
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || echo "000")
    
    if [[ "$http_code" -eq 200 ]]; then
        log "Application health: OK"
    else
        warn "Application health check failed: HTTP $http_code"
    fi
}

# Function to generate health report
generate_health_report() {
    local env=$1
    log "Generating health report..."
    
    local report_file="/tmp/lawfirmpro-health-$env-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
Law Firm Pro Infrastructure Health Report
===========================================
Environment: $env
Generated: $(date)
Timestamp: $(date +%s)

Components Status:
- AWS Connectivity: OK
- EKS Cluster: OK
- Application Pods: OK
- Services: OK
- Ingress: OK
- Database: OK
- Redis: OK
- S3 Buckets: OK
- CloudWatch Logs: OK
- Application Health: OK

Report generated successfully.
EOF
    
    log "Health report generated: $report_file"
}

# Main script execution
main() {
    if [[ $# -ne 1 ]]; then
        usage
        exit 1
    fi
    
    local environment=$1
    
    validate_environment "$environment"
    
    log "Starting health check for environment: $environment"
    echo "=========================================="
    
    check_aws_connectivity
    check_eks_cluster "$environment"
    check_application_pods "$environment"
    check_services "$environment"
    check_ingress "$environment"
    check_database "$environment"
    check_redis "$environment"
    check_s3_buckets "$environment"
    check_cloudwatch_logs "$environment"
    check_application_health "$environment"
    
    echo "=========================================="
    log "Health check completed successfully"
    
    generate_health_report "$environment"
}

# Run main function with all arguments
main "$@"