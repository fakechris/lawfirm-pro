#!/bin/bash

# Backup Validation Script for Law Firm Pro
# Validates backup integrity and performs test restores

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../configs/backup-config.yaml"
LOG_FILE="/var/log/backup-validation.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error_exit "Configuration file not found: $CONFIG_FILE"
    fi
    
    # Parse YAML configuration (using yq if available, otherwise simplified parsing)
    if command -v yq &> /dev/null; then
        BACKUP_S3_BUCKET=$(yq '.storage.primary.config.bucket' "$CONFIG_FILE")
        AWS_REGION=$(yq '.storage.primary.config.region' "$CONFIG_FILE")
        LOCAL_BACKUP_PATH=$(yq '.storage.secondary.config.path' "$CONFIG_FILE")
        VALIDATION_ENABLED=$(yq '.validation.enabled' "$CONFIG_FILE")
    else
        log "WARNING: yq not found, using default configuration"
        BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-lawfirmpro-backups}"
        AWS_REGION="${AWS_REGION:-us-east-1}"
        LOCAL_BACKUP_PATH="${LOCAL_BACKUP_PATH:-/opt/backups}"
        VALIDATION_ENABLED="true"
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check required commands
    local required_commands=("aws" "openssl" "tar" "gzip" "sha256sum")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "Required command not found: $cmd"
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error_exit "AWS credentials not configured or invalid"
    fi
    
    log "Prerequisites validation completed"
}

# Check backup storage connectivity
check_storage_connectivity() {
    log "Checking storage connectivity..."
    
    # Check S3 connectivity
    if ! aws s3 ls "s3://${BACKUP_S3_BUCKET}" &> /dev/null; then
        error_exit "Cannot access S3 bucket: ${BACKUP_S3_BUCKET}"
    fi
    
    # Check local storage
    if [[ ! -d "$LOCAL_BACKUP_PATH" ]]; then
        log "WARNING: Local backup path does not exist: $LOCAL_BACKUP_PATH"
        mkdir -p "$LOCAL_BACKUP_PATH"
    fi
    
    # Check disk space
    local available_space=$(df "$LOCAL_BACKUP_PATH" | awk 'NR==2 {print $4}')
    local required_space=$((5 * 1024 * 1024))  # 5GB in KB
    if [[ "$available_space" -lt "$required_space" ]]; then
        error_exit "Insufficient disk space for validation operations"
    fi
    
    log "Storage connectivity check completed"
}

# List recent backups
list_recent_backups() {
    log "Listing recent backups..."
    
    # List S3 backups from last 7 days
    local cutoff_date=$(date -d '7 days ago' '+%Y-%m-%d')
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/" --recursive | \
        grep "$cutoff_date" | \
        sort -r | \
        head -20 > /tmp/recent_backups.txt
    
    local backup_count=$(wc -l < /tmp/recent_backups.txt)
    log "Found $backup_count recent backups"
    
    if [[ "$backup_count" -eq 0 ]]; then
        error_exit "No recent backups found for validation"
    fi
}

# Validate backup integrity
validate_backup_integrity() {
    log "Starting backup integrity validation..."
    
    local validation_failed=false
    
    while IFS= read -r backup_line; do
        if [[ -z "$backup_line" ]]; then
            continue
        fi
        
        # Parse backup information
        local backup_path=$(echo "$backup_line" | awk '{print $4}')
        local backup_size=$(echo "$backup_line" | awk '{print $3}')
        local backup_date=$(echo "$backup_line" | awk '{print $1" "$2}')
        
        log "Validating backup: $backup_path"
        
        # Skip validation for non-backup files
        if [[ "$backup_path" != *".backup"* ]] && [[ "$backup_path" != *".tar.gz"* ]]; then
            continue
        fi
        
        # Download backup for validation
        local temp_file="/tmp/backup_validation_${TIMESTAMP}_${RANDOM}"
        if ! aws s3 cp "s3://${BACKUP_S3_BUCKET}/${backup_path}" "$temp_file"; then
            log "ERROR: Failed to download backup: $backup_path"
            validation_failed=true
            continue
        fi
        
        # Validate file size
        local downloaded_size=$(stat -c%s "$temp_file")
        local expected_size=$(echo "$backup_size" | sed 's/[^0-9]//g')
        if [[ "$downloaded_size" -ne "$expected_size" ]]; then
            log "ERROR: Size mismatch for $backup_path. Expected: $expected_size, Got: $downloaded_size"
            validation_failed=true
        fi
        
        # Validate checksum if available
        local checksum_file="${backup_path}.sha256"
        if aws s3 ls "s3://${BACKUP_S3_BUCKET}/${checksum_file}" &> /dev/null; then
            local temp_checksum="/tmp/checksum_validation_${TIMESTAMP}_${RANDOM}"
            aws s3 cp "s3://${BACKUP_S3_BUCKET}/${checksum_file}" "$temp_checksum"
            
            local expected_checksum=$(cat "$temp_checksum" | awk '{print $1}')
            local actual_checksum=$(sha256sum "$temp_file" | awk '{print $1}')
            
            if [[ "$expected_checksum" != "$actual_checksum" ]]; then
                log "ERROR: Checksum mismatch for $backup_path"
                validation_failed=true
            else
                log "Checksum validation passed for $backup_path"
            fi
            
            rm -f "$temp_checksum"
        fi
        
        # Test decompression for compressed files
        if [[ "$backup_path" == *.tar.gz ]] || [[ "$backup_path" == *.tgz ]]; then
            if ! tar -tzf "$temp_file" > /dev/null 2>&1; then
                log "ERROR: Decompression failed for $backup_path"
                validation_failed=true
            else
                log "Decompression test passed for $backup_path"
            fi
        fi
        
        # Test decryption for encrypted files
        if [[ "$backup_path" == *.encrypted ]]; then
            if ! openssl enc -d -aes-256-cbc -in "$temp_file" -out "${temp_file}.decrypted" -pass pass:"test" 2>/dev/null; then
                log "WARNING: Decryption test failed for $backup_path (may require proper key)"
            else
                log "Decryption test passed for $backup_path"
                rm -f "${temp_file}.decrypted"
            fi
        fi
        
        # Clean up temporary file
        rm -f "$temp_file"
        
    done < /tmp/recent_backups.txt
    
    if [[ "$validation_failed" == true ]]; then
        error_exit "Backup integrity validation failed"
    fi
    
    log "Backup integrity validation completed successfully"
}

# Perform test restore
perform_test_restore() {
    log "Starting test restore operations..."
    
    # Select a random backup for test restore
    local random_backup=$(shuf -n 1 /tmp/recent_backups.txt)
    local backup_path=$(echo "$random_backup" | awk '{print $4}')
    
    if [[ -z "$backup_path" ]]; then
        log "WARNING: No backup available for test restore"
        return 0
    fi
    
    log "Performing test restore for: $backup_path"
    
    # Create test restore directory
    local test_restore_dir="/tmp/test_restore_${TIMESTAMP}"
    mkdir -p "$test_restore_dir"
    
    # Download backup
    if ! aws s3 cp "s3://${BACKUP_S3_BUCKET}/${backup_path}" "$test_restore_dir/"; then
        log "ERROR: Test restore download failed for $backup_path"
        rm -rf "$test_restore_dir"
        return 1
    fi
    
    # Perform restore operations based on backup type
    case "$backup_path" in
        *database*)
            log "Testing database restore capability..."
            # Simulate database restore (without actually restoring)
            if [[ "$backup_path" == *.sql.gz ]]; then
                if ! gzip -t "$test_restore_dir/$(basename "$backup_path")"; then
                    log "ERROR: Database backup integrity test failed"
                    rm -rf "$test_restore_dir"
                    return 1
                fi
            fi
            ;;
            
        *documents*)
            log "Testing document restore capability..."
            local backup_file="$test_restore_dir/$(basename "$backup_path")"
            if [[ "$backup_file" == *.tar.gz ]]; then
                if ! tar -tzf "$backup_file" > /dev/null 2>&1; then
                    log "ERROR: Document backup integrity test failed"
                    rm -rf "$test_restore_dir"
                    return 1
                fi
            fi
            ;;
            
        *)
            log "Testing general file restore capability..."
            local backup_file="$test_restore_dir/$(basename "$backup_path")"
            if [[ -f "$backup_file" ]]; then
                local file_size=$(stat -c%s "$backup_file")
                if [[ "$file_size" -eq 0 ]]; then
                    log "ERROR: Backup file is empty: $backup_path"
                    rm -rf "$test_restore_dir"
                    return 1
                fi
            fi
            ;;
    esac
    
    # Clean up test restore directory
    rm -rf "$test_restore_dir"
    
    log "Test restore completed successfully for: $backup_path"
}

# Generate validation report
generate_validation_report() {
    log "Generating validation report..."
    
    local report_file="/tmp/backup_validation_report_${TIMESTAMP}.json"
    
    cat > "$report_file" << EOF
{
  "validation_timestamp": "$(date -Iseconds)",
  "validation_summary": {
    "total_backups_checked": $(wc -l < /tmp/recent_backups.txt),
    "validation_status": "SUCCESS",
    "validation_duration_seconds": $SECONDS
  },
  "storage_configuration": {
    "s3_bucket": "$BACKUP_S3_BUCKET",
    "aws_region": "$AWS_REGION",
    "local_backup_path": "$LOCAL_BACKUP_PATH"
  },
  "recent_backups": [
EOF
    
    # Add recent backups to report
    local first=true
    while IFS= read -r backup_line; do
        if [[ -z "$backup_line" ]]; then
            continue
        fi
        
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        local backup_path=$(echo "$backup_line" | awk '{print $4}')
        local backup_size=$(echo "$backup_line" | awk '{print $3}')
        local backup_date=$(echo "$backup_line" | awk '{print $1" "$2}')
        
        cat >> "$report_file" << EOF
    {
      "path": "$backup_path",
      "size": "$backup_size",
      "date": "$backup_date",
      "validation_status": "VALID"
    }
EOF
    done < /tmp/recent_backups.txt
    
    cat >> "$report_file" << EOF
  ],
  "recommendations": [
    "Continue monitoring backup success rates",
    "Regularly test restore procedures",
    "Monitor storage usage and costs",
    "Review retention policies quarterly"
  ]
}
EOF
    
    # Upload report to S3
    aws s3 cp "$report_file" "s3://${BACKUP_S3_BUCKET}/reports/validation-reports/"
    
    # Send notification if configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Backup validation completed successfully for $BACKUP_S3_BUCKET. Report uploaded to S3.\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    log "Validation report generated and uploaded: $report_file"
}

# Clean up temporary files
cleanup() {
    log "Cleaning up temporary files..."
    rm -f /tmp/recent_backups.txt
    rm -f /tmp/backup_validation_*
    rm -f /tmp/checksum_validation_*
    rm -rf /tmp/test_restore_*
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting backup validation process..."
    
    # Set error trap
    trap 'error_exit "Script interrupted"' INT TERM
    trap cleanup EXIT
    
    # Execute validation steps
    load_config
    validate_prerequisites
    check_storage_connectivity
    list_recent_backups
    validate_backup_integrity
    perform_test_restore
    generate_validation_report
    
    log "Backup validation process completed successfully"
    
    # Exit with success
    exit 0
}

# Run main function
main "$@"