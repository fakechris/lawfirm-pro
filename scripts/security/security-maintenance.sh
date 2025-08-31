#!/bin/bash

# Security Maintenance Script for Law Firm Pro
# Automated security maintenance and hardening tasks

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../../security/configs/security-scan.yaml"
LOG_FILE="/var/log/security-maintenance.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_DIR="/tmp/security-reports/${TIMESTAMP}"

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
    
    # Parse configuration (simplified parsing)
    if command -v yq &> /dev/null; then
        BACKUP_S3_BUCKET=$(yq '.backup_storage.primary.config.bucket' "$CONFIG_FILE" 2>/dev/null || echo "lawfirmpro-backups")
        ALERT_EMAIL=$(yq '.alerting.channels[0].recipients[0]' "$CONFIG_FILE" 2>/dev/null || echo "security-team@lawfirmpro.com")
    else
        BACKUP_S3_BUCKET="lawfirmpro-backups"
        ALERT_EMAIL="security-team@lawfirmpro.com"
    fi
}

# Send notification
send_notification() {
    local subject="$1"
    local message="$2"
    local severity="${3:-"INFO"}"
    
    log "Sending notification: $subject"
    
    # Email notification
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "[$severity] $subject" "$ALERT_EMAIL"
    fi
    
    # Slack notification if webhook configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="ℹ️"
        case "$severity" in
            "CRITICAL") emoji="🚨" ;;
            "HIGH") emoji="⚠️" ;;
            "MEDIUM") emoji="🔍" ;;
            "LOW") emoji="ℹ️" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji $subject\n$message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root"
    fi
    
    # Check required commands
    local required_commands=("systemctl" "apt" "ufw" "fail2ban" "logrotate" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "Required command not found: $cmd"
        fi
    done
    
    log "Prerequisites validation completed"
}

# Create report directory
create_report_directory() {
    mkdir -p "$REPORT_DIR"
    log "Report directory created: $REPORT_DIR"
}

# System updates and patching
perform_system_updates() {
    log "Starting system updates..."
    
    local update_report="$REPORT_DIR/system-updates.txt"
    
    # Update package lists
    echo "=== System Update Report - $(date) ===" > "$update_report"
    echo "" >> "$update_report"
    
    # Check for updates
    echo "Checking for available updates..." >> "$update_report"
    apt update >> "$update_report" 2>&1
    
    # List upgradable packages
    echo "" >> "$update_report"
    echo "Upgradable packages:" >> "$update_report"
    apt list --upgradable >> "$update_report" 2>&1
    
    # Apply security updates
    echo "" >> "$update_report"
    echo "Applying security updates..." >> "$update_report"
    if apt upgrade -y --security >> "$update_report" 2>&1; then
        log "Security updates applied successfully"
        echo "✅ Security updates applied successfully" >> "$update_report"
    else
        log "WARNING: Some security updates failed"
        echo "⚠️ Some security updates failed" >> "$update_report"
        send_notification "Security Updates Failed" "Some security updates failed to apply. Check $update_report for details." "HIGH"
    fi
    
    # Check if reboot is required
    if [[ -f /var/run/reboot-required ]]; then
        log "System reboot required"
        echo "⚠️ System reboot required" >> "$update_report"
        send_notification "System Reboot Required" "Security updates require system reboot. Please schedule maintenance window." "MEDIUM"
    fi
    
    log "System updates completed"
}

# Security hardening checks
perform_security_hardening() {
    log "Starting security hardening checks..."
    
    local hardening_report="$REPORT_DIR/security-hardening.txt"
    
    echo "=== Security Hardening Report - $(date) ===" > "$hardening_report"
    echo "" >> "$hardening_report"
    
    # Check SSH configuration
    echo "Checking SSH configuration..." >> "$hardening_report"
    local ssh_config="/etc/ssh/sshd_config"
    if [[ -f "$ssh_config" ]]; then
        if grep -q "^PermitRootLogin no" "$ssh_config"; then
            echo "✅ Root login disabled" >> "$hardening_report"
        else
            echo "❌ Root login enabled" >> "$hardening_report"
        fi
        
        if grep -q "^PasswordAuthentication no" "$ssh_config"; then
            echo "✅ Password authentication disabled" >> "$hardening_report"
        else
            echo "❌ Password authentication enabled" >> "$hardening_report"
        fi
        
        if grep -q "^PermitEmptyPasswords no" "$ssh_config"; then
            echo "✅ Empty passwords disabled" >> "$hardening_report"
        else
            echo "❌ Empty passwords allowed" >> "$hardening_report"
        fi
    fi
    
    # Check firewall status
    echo "" >> "$hardening_report"
    echo "Checking firewall status..." >> "$hardening_report"
    if systemctl is-active --quiet ufw; then
        echo "✅ Firewall is active" >> "$hardening_report"
    else
        echo "❌ Firewall is inactive" >> "$hardening_report"
        send_notification "Firewall Inactive" "UFW firewall is not active. This is a security risk." "HIGH"
    fi
    
    # Check fail2ban status
    echo "" >> "$hardening_report"
    echo "Checking fail2ban status..." >> "$hardening_report"
    if systemctl is-active --quiet fail2ban; then
        echo "✅ Fail2ban is active" >> "$hardening_report"
    else
        echo "❌ Fail2ban is inactive" >> "$hardening_report"
        send_notification "Fail2ban Inactive" "Fail2ban service is not active. This is a security risk." "MEDIUM"
    fi
    
    # Check automatic updates
    echo "" >> "$hardening_report"
    echo "Checking automatic updates..." >> "$hardening_report"
    if systemctl is-enabled --quiet unattended-upgrades; then
        echo "✅ Automatic updates enabled" >> "$hardening_report"
    else
        echo "❌ Automatic updates disabled" >> "$hardening_report"
    fi
    
    # Check for unnecessary services
    echo "" >> "$hardening_report"
    echo "Checking unnecessary services..." >> "$hardening_report"
    local unnecessary_services=("telnet" "rsh-server" "rlogin-server" "ypserv")
    for service in "${unnecessary_services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            echo "❌ $service is running" >> "$hardening_report"
        else
            echo "✅ $service is not running" >> "$hardening_report"
        fi
    done
    
    log "Security hardening checks completed"
}

# Security log analysis
analyze_security_logs() {
    log "Starting security log analysis..."
    
    local log_analysis_report="$REPORT_DIR/log-analysis.txt"
    
    echo "=== Security Log Analysis Report - $(date) ===" > "$log_analysis_report"
    echo "" >> "$log_analysis_report"
    
    # Analyze authentication logs
    echo "Analyzing authentication logs..." >> "$log_analysis_report"
    local failed_logins=$(grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo "0")
    local successful_logins=$(grep -c "Accepted password" /var/log/auth.log 2>/dev/null || echo "0")
    
    echo "Failed login attempts (last 24h): $failed_logins" >> "$log_analysis_report"
    echo "Successful logins (last 24h): $successful_logins" >> "$log_analysis_report"
    
    # Check for brute force attacks
    if [[ "$failed_logins" -gt 100 ]]; then
        echo "⚠️ High number of failed login attempts detected" >> "$log_analysis_report"
        send_notification "Potential Brute Force Attack" "High number of failed login attempts detected: $failed_logins" "HIGH"
    fi
    
    # Analyze system logs
    echo "" >> "$log_analysis_report"
    echo "Analyzing system logs..." >> "$log_analysis_report"
    local kernel_errors=$(grep -c "ERROR" /var/log/kern.log 2>/dev/null || echo "0")
    local system_errors=$(grep -c "error" /var/log/syslog 2>/dev/null || echo "0")
    
    echo "Kernel errors: $kernel_errors" >> "$log_analysis_report"
    echo "System errors: $system_errors" >> "$log_analysis_report"
    
    # Check for suspicious activities
    echo "" >> "$log_analysis_report"
    echo "Checking for suspicious activities..." >> "$log_analysis_report"
    
    # Check for sudo usage
    local sudo_attempts=$(grep -c "sudo:" /var/log/auth.log 2>/dev/null || echo "0")
    echo "Sudo attempts: $sudo_attempts" >> "$log_analysis_report"
    
    # Check for file system changes
    if command -v aide &> /dev/null; then
        echo "" >> "$log_analysis_report"
        echo "Checking file system integrity..." >> "$log_analysis_report"
        if aide --check >> "$log_analysis_report" 2>&1; then
            echo "✅ File system integrity check passed" >> "$log_analysis_report"
        else
            echo "❌ File system integrity check failed" >> "$log_analysis_report"
            send_notification "File System Integrity Check Failed" "AIDE detected changes to the file system. Check $log_analysis_report for details." "HIGH"
        fi
    fi
    
    log "Security log analysis completed"
}

# Disk space and resource monitoring
monitor_system_resources() {
    log "Starting system resource monitoring..."
    
    local resource_report="$REPORT_DIR/resource-monitoring.txt"
    
    echo "=== System Resource Monitoring Report - $(date) ===" > "$resource_report"
    echo "" >> "$resource_report"
    
    # Check disk space
    echo "Checking disk space..." >> "$resource_report"
    df -h >> "$resource_report"
    echo "" >> "$resource_report"
    
    # Check for low disk space
    local root_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ "$root_usage" -gt 80 ]]; then
        echo "⚠️ Root disk usage is ${root_usage}%" >> "$resource_report"
        send_notification "Low Disk Space" "Root disk usage is ${root_usage}%. Consider cleanup." "MEDIUM"
    fi
    
    # Check memory usage
    echo "" >> "$resource_report"
    echo "Checking memory usage..." >> "$resource_report"
    free -h >> "$resource_report"
    echo "" >> "$resource_report"
    
    # Check high memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3/$2 * 100}')
    if [[ "$memory_usage" -gt 90 ]]; then
        echo "⚠️ Memory usage is ${memory_usage}%" >> "$resource_report"
        send_notification "High Memory Usage" "Memory usage is ${memory_usage}%. Consider investigation." "MEDIUM"
    fi
    
    # Check CPU usage
    echo "" >> "$resource_report"
    echo "Checking CPU usage..." >> "$resource_report"
    top -bn1 | head -20 >> "$resource_report"
    echo "" >> "$resource_report"
    
    # Check load average
    local load_average=$(uptime | awk -F'load average:' '{print $2}')
    echo "Load average: $load_average" >> "$resource_report"
    
    # Check process count
    local process_count=$(ps aux | wc -l)
    echo "Total processes: $process_count" >> "$resource_report"
    
    log "System resource monitoring completed"
}

# Security service health checks
perform_health_checks() {
    log "Starting security service health checks..."
    
    local health_report="$REPORT_DIR/health-checks.txt"
    
    echo "=== Security Service Health Check Report - $(date) ===" > "$health_report"
    echo "" >> "$health_report"
    
    # Check essential security services
    local services=("ufw" "fail2ban" "apparmor" "auditd" "rsyslog")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            echo "✅ $service is running" >> "$health_report"
        else
            echo "❌ $service is not running" >> "$health_report"
            send_notification "Service Not Running" "$service is not running. This is a security risk." "MEDIUM"
        fi
    done
    
    # Check log rotation
    echo "" >> "$health_report"
    echo "Checking log rotation..." >> "$health_report"
    if systemctl is-active --quiet logrotate; then
        echo "✅ Log rotation is working" >> "$health_report"
    else
        echo "❌ Log rotation is not working" >> "$health_report"
    fi
    
    # Check backup service
    echo "" >> "$health_report"
    echo "Checking backup service..." >> "$health_report"
    if systemctl is-active --quiet backup-service; then
        echo "✅ Backup service is running" >> "$health_report"
    else
        echo "❌ Backup service is not running" >> "$health_report"
        send_notification "Backup Service Not Running" "Backup service is not running. This is a critical risk." "CRITICAL"
    fi
    
    # Check monitoring service
    echo "" >> "$health_report"
    echo "Checking monitoring service..." >> "$health_report"
    if systemctl is-active --quiet prometheus; then
        echo "✅ Monitoring service is running" >> "$health_report"
    else
        echo "❌ Monitoring service is not running" >> "$health_report"
        send_notification "Monitoring Service Not Running" "Monitoring service is not running. This is a critical risk." "CRITICAL"
    fi
    
    log "Security service health checks completed"
}

# Generate comprehensive security report
generate_security_report() {
    log "Generating comprehensive security report..."
    
    local final_report="$REPORT_DIR/security-report-${TIMESTAMP}.md"
    
    cat > "$final_report" << EOF
# Security Maintenance Report

**Generated:** $(date)  
**System:** $(hostname)  
**Environment:** ${ENVIRONMENT:-"production"}

## Executive Summary

This security maintenance report provides an overview of the current security posture of the Law Firm Pro system. The maintenance tasks include system updates, security hardening, log analysis, resource monitoring, and health checks.

## Key Findings

### System Updates
$(cat "$REPORT_DIR/system-updates.txt" | grep -E "(✅|⚠️|❌)" || echo "No significant issues found")

### Security Hardening
$(cat "$REPORT_DIR/security-hardening.txt" | grep -E "(✅|⚠️|❌)" || echo "No significant issues found")

### Log Analysis
- Failed login attempts: $(grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo "0")
- Successful logins: $(grep -c "Accepted password" /var/log/auth.log 2>/dev/null || echo "0")
- System errors: $(grep -c "error" /var/log/syslog 2>/dev/null || echo "0")

### Resource Monitoring
- Root disk usage: $(df / | awk 'NR==2 {print $5}')
- Memory usage: $(free | awk 'NR==2{printf "%.0f", $3/$2 * 100}')%
- Load average: $(uptime | awk -F'load average:' '{print $2}')

### Service Health
$(cat "$REPORT_DIR/health-checks.txt" | grep -E "(✅|❌)" || echo "All services are running")

## Recommendations

1. **Immediate Actions:**
   - Address any critical issues identified above
   - Schedule reboot if required by system updates
   - Review any security alerts or notifications

2. **Ongoing Maintenance:**
   - Continue regular security updates
   - Monitor system logs for suspicious activities
   - Ensure all security services remain active

3. **Long-term Improvements:**
   - Consider implementing automated security monitoring
   - Regular security awareness training for staff
   - Periodic security assessments and penetration testing

## Detailed Reports

- [System Updates](system-updates.txt)
- [Security Hardening](security-hardening.txt)
- [Log Analysis](log-analysis.txt)
- [Resource Monitoring](resource-monitoring.txt)
- [Health Checks](health-checks.txt)

## Next Maintenance

**Scheduled:** $(date -d '7 days' '+%Y-%m-%d')  
**Tasks:** System updates, security hardening, log analysis, resource monitoring

---

*This report was generated automatically by the Law Firm Pro security maintenance script.*
EOF

    log "Security report generated: $final_report"
    
    # Upload report to S3 if configured
    if command -v aws &> /dev/null; then
        aws s3 cp "$REPORT_DIR" "s3://${BACKUP_S3_BUCKET}/security-reports/${TIMESTAMP}/" --recursive || true
    fi
    
    # Send summary notification
    local summary="Security maintenance completed. Report available at: $final_report"
    send_notification "Security Maintenance Completed" "$summary" "INFO"
}

# Clean up temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove old report directories (keep last 7 days)
    find /tmp/security-reports -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    
    # Clean up old logs
    find /var/log -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting security maintenance process..."
    
    # Set error trap
    trap 'error_exit "Script interrupted"' INT TERM
    trap cleanup EXIT
    
    # Execute maintenance tasks
    load_config
    validate_prerequisites
    create_report_directory
    perform_system_updates
    perform_security_hardening
    analyze_security_logs
    monitor_system_resources
    perform_health_checks
    generate_security_report
    
    log "Security maintenance process completed successfully"
    
    # Exit with success
    exit 0
}

# Run main function
main "$@"