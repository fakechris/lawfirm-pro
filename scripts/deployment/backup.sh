#!/bin/bash

# Backup script for Law Firm Pro
# Usage: ./backup.sh <environment> <kubeconfig> [aws-access-key-id] [aws-secret-access-key] [s3-bucket]

set -e

ENVIRONMENT=$1
KUBECONFIG=$2
AWS_ACCESS_KEY_ID=${3:-""}
AWS_SECRET_ACCESS_KEY=${4:-""}
S3_BUCKET=${5:-""}

if [ -z "$ENVIRONMENT" ] || [ -z "$KUBECONFIG" ]; then
    echo "Usage: $0 <environment> <kubeconfig> [aws-access-key-id] [aws-secret-access-key] [s3-bucket]"
    exit 1
fi

echo "💾 Starting backup for $ENVIRONMENT environment..."

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        NAMESPACE="lawfirmpro-staging"
        BACKUP_RETENTION_DAYS=7
        ;;
    "production")
        NAMESPACE="lawfirmpro-production"
        BACKUP_RETENTION_DAYS=30
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Function to backup database
backup_database() {
    echo "🗄️ Backing up database..."
    
    if command -v kubectl &> /dev/null; then
        # Get PostgreSQL pod name
        postgres_pod=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        
        if [ -z "$postgres_pod" ]; then
            echo "❌ PostgreSQL pod not found"
            return 1
        fi
        
        # Create backup directory
        backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Get database credentials
        db_name=$(kubectl get secret lawfirmpro-secrets -n $NAMESPACE -o jsonpath='{.data.POSTGRES_DB}' | base64 -d 2>/dev/null || echo "lawfirmpro")
        db_user=$(kubectl get secret lawfirmpro-secrets -n $NAMESPACE -o jsonpath='{.data.POSTGRES_USER}' | base64 -d 2>/dev/null || echo "lawfirm")
        db_password=$(kubectl get secret lawfirmpro-secrets -n $NAMESPACE -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d 2>/dev/null || echo "lawfirm")
        
        # Perform database backup
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="$backup_dir/database_backup_${timestamp}.sql"
        
        kubectl exec -n $NAMESPACE "$postgres_pod" -- pg_dump -U "$db_user" -d "$db_name" > "$backup_file"
        
        if [ $? -eq 0 ]; then
            echo "✅ Database backup completed: $backup_file"
            DATABASE_BACKUP_FILE="$backup_file"
            return 0
        else
            echo "❌ Database backup failed"
            return 1
        fi
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to backup Redis
backup_redis() {
    echo "🔴 Backing up Redis..."
    
    if command -v kubectl &> /dev/null; then
        # Get Redis pod name
        redis_pod=$(kubectl get pods -n $NAMESPACE -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        
        if [ -z "$redis_pod" ]; then
            echo "❌ Redis pod not found"
            return 1
        fi
        
        # Create backup directory
        backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Perform Redis backup
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="$backup_dir/redis_backup_${timestamp}.rdb"
        
        # Get Redis password
        redis_password=$(kubectl get secret lawfirmpro-secrets -n $NAMESPACE -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d 2>/dev/null || echo "")
        
        # Save Redis data
        kubectl exec -n $NAMESPACE "$redis_pod" -- redis-cli --no-auth-warning -a "$redis_password" SAVE
        
        # Copy RDB file
        kubectl cp -n $NAMESPACE "$redis_pod":/data/dump.rdb "$backup_file"
        
        if [ $? -eq 0 ]; then
            echo "✅ Redis backup completed: $backup_file"
            REDIS_BACKUP_FILE="$backup_file"
            return 0
        else
            echo "❌ Redis backup failed"
            return 1
        fi
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to backup application files
backup_application_files() {
    echo "📁 Backing up application files..."
    
    if command -v kubectl &> /dev/null; then
        # Create backup directory
        backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Get application pods
        app_pods=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
        
        if [ -z "$app_pods" ]; then
            echo "❌ Application pods not found"
            return 1
        fi
        
        # Backup uploads directory
        timestamp=$(date +%Y%m%d_%H%M%S)
        uploads_backup="$backup_dir/uploads_backup_${timestamp}.tar.gz"
        
        # Create tar archive of uploads
        kubectl exec -n $NAMESPACE $(echo $app_pods | awk '{print $1}') -- tar -czf - -C /app uploads > "$uploads_backup"
        
        if [ $? -eq 0 ]; then
            echo "✅ Application files backup completed: $uploads_backup"
            APP_FILES_BACKUP_FILE="$uploads_backup"
            return 0
        else
            echo "❌ Application files backup failed"
            return 1
        fi
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to backup Kubernetes manifests
backup_kubernetes_manifests() {
    echo "☸️ Backing up Kubernetes manifests..."
    
    if command -v kubectl &> /dev/null; then
        # Create backup directory
        backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir/manifests"
        
        # Backup all resources in namespace
        kubectl get all -n $NAMESPACE -o yaml > "$backup_dir/manifests/all_resources.yaml"
        
        # Backup specific resources
        kubectl get configmaps -n $NAMESPACE -o yaml > "$backup_dir/manifests/configmaps.yaml"
        kubectl get secrets -n $NAMESPACE -o yaml > "$backup_dir/manifests/secrets.yaml"
        kubectl get deployments -n $NAMESPACE -o yaml > "$backup_dir/manifests/deployments.yaml"
        kubectl get services -n $NAMESPACE -o yaml > "$backup_dir/manifests/services.yaml"
        kubectl get ingress -n $NAMESPACE -o yaml > "$backup_dir/manifests/ingress.yaml"
        kubectl get pvc -n $NAMESPACE -o yaml > "$backup_dir/manifests/pvc.yaml"
        
        echo "✅ Kubernetes manifests backup completed"
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to upload to S3
upload_to_s3() {
    echo "☁️ Uploading backup to S3..."
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET" ]; then
        echo "⚠️ AWS credentials not provided, skipping S3 upload"
        return 0
    fi
    
    if command -v aws &> /dev/null; then
        # Configure AWS CLI
        export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
        
        backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
        timestamp=$(date +%Y%m%d_%H%M%S)
        s3_path="s3://$S3_BUCKET/backups/$ENVIRONMENT/$timestamp/"
        
        # Upload all backup files
        aws s3 cp "$backup_dir" "$s3_path" --recursive
        
        if [ $? -eq 0 ]; then
            echo "✅ Backup uploaded to S3: $s3_path"
            return 0
        else
            echo "❌ S3 upload failed"
            return 1
        fi
    else
        echo "❌ AWS CLI not available"
        return 1
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up old backups..."
    
    if command -v aws &> /dev/null && [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET" ]; then
        # Configure AWS CLI
        export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
        
        # Remove old backups from S3
        cutoff_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y-%m-%d)
        aws s3 ls "s3://$S3_BUCKET/backups/$ENVIRONMENT/" --recursive | while read -r line; do
            file_date=$(echo "$line" | awk '{print $1" "$2}')
            file_path=$(echo "$line" | awk '{print $4}')
            
            if [[ "$file_date" < "$cutoff_date" ]]; then
                echo "Removing old backup: $file_path"
                aws s3 rm "s3://$S3_BUCKET/$file_path"
            fi
        done
        
        echo "✅ Old backups cleaned up"
        return 0
    else
        echo "⚠️ AWS CLI not available or credentials not provided, skipping cleanup"
        return 0
    fi
}

# Function to verify backup integrity
verify_backup_integrity() {
    echo "🔍 Verifying backup integrity..."
    
    backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
    
    # Verify database backup
    if [ -f "$backup_dir/database_backup_"*.sql ]; then
        db_file=$(ls "$backup_dir/database_backup_"*.sql | head -1)
        if [ -s "$db_file" ]; then
            echo "✅ Database backup integrity verified"
        else
            echo "❌ Database backup is empty"
            return 1
        fi
    fi
    
    # Verify Redis backup
    if [ -f "$backup_dir/redis_backup_"*.rdb ]; then
        redis_file=$(ls "$backup_dir/redis_backup_"*.rdb | head -1)
        if [ -s "$redis_file" ]; then
            echo "✅ Redis backup integrity verified"
        else
            echo "❌ Redis backup is empty"
            return 1
        fi
    fi
    
    # Verify application files backup
    if [ -f "$backup_dir/uploads_backup_"*.tar.gz ]; then
        app_file=$(ls "$backup_dir/uploads_backup_"*.tar.gz | head -1)
        if tar -tzf "$app_file" > /dev/null 2>&1; then
            echo "✅ Application files backup integrity verified"
        else
            echo "❌ Application files backup is corrupted"
            return 1
        fi
    fi
    
    echo "✅ All backup integrity checks passed"
    return 0
}

# Function to create backup manifest
create_backup_manifest() {
    echo "📋 Creating backup manifest..."
    
    backup_dir="/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
    manifest_file="$backup_dir/backup_manifest.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_timestamp": "$(date -Iseconds)",
  "environment": "$ENVIRONMENT",
  "namespace": "$NAMESPACE",
  "backup_files": {
    "database": "$(ls "$backup_dir/database_backup_"*.sql 2>/dev/null | head -1 | xargs basename)",
    "redis": "$(ls "$backup_dir/redis_backup_"*.rdb 2>/dev/null | head -1 | xargs basename)",
    "application_files": "$(ls "$backup_dir/uploads_backup_"*.tar.gz 2>/dev/null | head -1 | xargs basename)"
  },
  "backup_size": "$(du -sh "$backup_dir" | cut -f1)",
  "retention_days": $BACKUP_RETENTION_DAYS
}
EOF
    
    echo "✅ Backup manifest created: $manifest_file"
}

# Main backup process
echo "🚀 Starting backup process..."

# Perform backups
backup_database || exit 1
backup_redis || exit 1
backup_application_files || exit 1
backup_kubernetes_manifests || exit 1

# Verify backup integrity
verify_backup_integrity || exit 1

# Create backup manifest
create_backup_manifest

# Upload to S3
upload_to_s3 || true

# Cleanup old backups
cleanup_old_backups || true

echo "✅ Backup completed successfully!"
echo "📁 Backup location: /tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)"
echo "📊 Backup size: $(du -sh "/tmp/lawfirmpro_backup_$(date +%Y%m%d_%H%M%S)" | cut -f1)"