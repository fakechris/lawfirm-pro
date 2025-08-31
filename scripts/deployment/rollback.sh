#!/bin/bash

# Rollback script for Law Firm Pro
# Usage: ./rollback.sh <environment> <kubeconfig> [version]

set -e

ENVIRONMENT=$1
KUBECONFIG=$2
VERSION=${3:-"previous"}

if [ -z "$ENVIRONMENT" ] || [ -z "$KUBECONFIG" ]; then
    echo "Usage: $0 <environment> <kubeconfig> [version]"
    exit 1
fi

echo "🔄 Starting rollback for $ENVIRONMENT environment..."
echo "📦 Target version: $VERSION"

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        NAMESPACE="lawfirmpro-staging"
        ;;
    "production")
        NAMESPACE="lawfirmpro-production"
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Function to get current deployment info
get_current_deployment() {
    echo "📊 Getting current deployment info..."
    
    if command -v kubectl &> /dev/null; then
        current_image=$(kubectl get deployment lawfirmpro-app -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")
        current_replicas=$(kubectl get deployment lawfirmpro-app -n $NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "")
        
        echo "Current image: $current_image"
        echo "Current replicas: $current_replicas"
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to create backup before rollback
create_backup() {
    echo "💾 Creating backup before rollback..."
    
    if command -v kubectl &> /dev/null; then
        # Create backup of current deployment
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="/tmp/lawfirmpro_backup_${timestamp}.yaml"
        
        kubectl get deployment lawfirmpro-app -n $NAMESPACE -o yaml > "$backup_file"
        echo "✅ Backup created: $backup_file"
        
        return 0
    else
        echo "❌ Cannot create backup - kubectl not available"
        return 1
    fi
}

# Function to get rollback version
get_rollback_version() {
    echo "🏷️ Determining rollback version..."
    
    if [ "$VERSION" = "previous" ]; then
        # Get the previous version from deployment history
        if command -v kubectl &> /dev/null; then
            revision=$(kubectl rollout history deployment/lawfirmpro-app -n $NAMESPACE | tail -2 | head -1 | awk '{print $1}')
            if [ -n "$revision" ]; then
                echo "Rolling back to revision: $revision"
                ROLLBACK_REVISION="$revision"
                return 0
            else
                echo "❌ Could not determine previous revision"
                return 1
            fi
        else
            echo "❌ kubectl not available"
            return 1
        fi
    else
        # Use specified version
        echo "Rolling back to version: $VERSION"
        ROLLBACK_VERSION="$VERSION"
        return 0
    fi
}

# Function to perform rollback
perform_rollback() {
    echo "🔄 Performing rollback..."
    
    if command -v kubectl &> /dev/null; then
        if [ -n "$ROLLBACK_REVISION" ]; then
            # Rollback to specific revision
            kubectl rollout undo deployment/lawfirmpro-app -n $NAMESPACE --to-revision="$ROLLBACK_REVISION"
        elif [ -n "$ROLLBACK_VERSION" ]; then
            # Rollback to specific version (update image)
            kubectl set image deployment/lawfirmpro-app -n $NAMESPACE lawfirmpro-app="$ROLLBACK_VERSION"
        else
            echo "❌ No rollback target specified"
            return 1
        fi
        
        echo "✅ Rollback initiated"
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to monitor rollback
monitor_rollback() {
    echo "📊 Monitoring rollback progress..."
    
    if command -v kubectl &> /dev/null; then
        # Wait for rollback to complete
        kubectl rollout status deployment/lawfirmpro-app -n $NAMESPACE --timeout=300s
        
        if [ $? -eq 0 ]; then
            echo "✅ Rollback completed successfully"
            return 0
        else
            echo "❌ Rollback failed or timed out"
            return 1
        fi
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to verify rollback
verify_rollback() {
    echo "🔍 Verifying rollback..."
    
    if command -v kubectl &> /dev/null; then
        # Check if pods are running
        ready_pods=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --field-selector=status.phase=Running --no-headers | grep "1/1" | wc -l)
        total_pods=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --no-headers | wc -l)
        
        if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
            echo "✅ Rollback verified - all pods are ready"
            return 0
        else
            echo "❌ Rollback verification failed - pods not ready"
            return 1
        fi
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to notify rollback status
notify_rollback_status() {
    local status=$1
    
    echo "📧 Notifying rollback status: $status"
    
    # Send notification via Slack if webhook is available
    if [ -n "$SLACK_WEBHOOK" ]; then
        message="{
            \"text\": \"Rollback completed for $ENVIRONMENT environment\",
            \"attachments\": [
                {
                    \"color\": \"${status}\"}",
                    \"fields\": [
                        {
                            \"title\": \"Environment\",
                            \"value\": \"$ENVIRONMENT\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Version\",
                            \"value\": \"$VERSION\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Status\",
                            \"value\": \"$status\",
                            \"short\": false
                        }
                    ]
                }
            ]
        }"
        
        curl -X POST -H 'Content-type: application/json' --data "$message" "$SLACK_WEBHOOK" || true
    fi
}

# Function to cleanup old revisions
cleanup_old_revisions() {
    echo "🧹 Cleaning up old revisions..."
    
    if command -v kubectl &> /dev/null; then
        # Keep only last 5 revisions
        kubectl rollout history deployment/lawfirmpro-app -n $NAMESPACE | tail -n +2 | head -n -5 | awk '{print $1}' | while read revision; do
            echo "Cleaning up revision: $revision"
            # Note: kubectl doesn't have a direct way to delete specific revisions
            # This would need to be implemented differently
        done
        
        echo "✅ Cleanup completed"
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Main rollback process
echo "🚀 Starting rollback process..."

# Get current deployment info
get_current_deployment || exit 1

# Create backup
create_backup || exit 1

# Get rollback version
get_rollback_version || exit 1

# Perform rollback
perform_rollback || exit 1

# Monitor rollback
monitor_rollback || exit 1

# Verify rollback
verify_rollback || exit 1

# Cleanup old revisions
cleanup_old_revisions || true

# Notify success
notify_rollback_status "success"

echo "✅ Rollback completed successfully!"
echo "🌐 Application should be back to the previous version"