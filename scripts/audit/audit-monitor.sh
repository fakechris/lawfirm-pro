#!/bin/bash

# Audit Monitoring Script
# This script monitors the audit trail system and generates alerts

set -euo pipefail

# Configuration
AUDIT_SERVICE_URL="${AUDIT_SERVICE_URL:-http://localhost:3000/api/audit}"
ALERT_EMAIL="${ALERT_EMAIL:-security@lawfirmpro.com}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
LOG_FILE="/var/log/audit-monitor.log"
MAX_LOG_SIZE=$((50 * 1024 * 1024))  # 50MB
ALERT_THRESHOLD=${ALERT_THRESHOLD:-10}
CHECK_INTERVAL=${CHECK_INTERVAL:-300}  # 5 minutes

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "ERROR") echo -e "${RED}[${timestamp}] ERROR: ${message}${NC}" ;;
        "WARN") echo -e "${YELLOW}[${timestamp}] WARN: ${message}${NC}" ;;
        "INFO") echo -e "${GREEN}[${timestamp}] INFO: ${message}${NC}" ;;
        *) echo "[${timestamp}] $level: $message" ;;
    esac
    
    echo "[${timestamp}] $level: $message" >> "$LOG_FILE"
}

# Rotate log file if it's too large
rotate_log() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        gzip "${LOG_FILE}.old" &
        log "INFO" "Log file rotated"
    fi
}

# Send email alert
send_email_alert() {
    local subject="$1"
    local body="$2"
    
    if command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$ALERT_EMAIL"
        log "INFO" "Email alert sent to $ALERT_EMAIL"
    else
        log "WARN" "Mail command not available, cannot send email alert"
    fi
}

# Send webhook alert
send_webhook_alert() {
    local title="$1"
    local message="$2"
    local severity="$3"
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        local payload=$(cat <<EOF
{
    "title": "$title",
    "message": "$message",
    "severity": "$severity",
    "timestamp": "$(date -Iseconds)",
    "service": "audit-monitor"
}
EOF
)
        
        if command -v curl &> /dev/null; then
            curl -s -X POST \
                -H "Content-Type: application/json" \
                -d "$payload" \
                "$ALERT_WEBHOOK" || log "ERROR" "Failed to send webhook alert"
            log "INFO" "Webhook alert sent"
        else
            log "WARN" "Curl command not available, cannot send webhook alert"
        fi
    fi
}

# Check audit service health
check_service_health() {
    if ! command -v curl &> /dev/null; then
        log "ERROR" "Curl command not available, cannot check service health"
        return 1
    fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "${AUDIT_SERVICE_URL}/health" 2>/dev/null || echo "000")
    
    if [ "$response" != "200" ]; then
        log "ERROR" "Audit service health check failed: HTTP $response"
        send_email_alert "Audit Service Health Check Failed" "Audit service returned HTTP $response"
        send_webhook_alert "Audit Service Down" "Health check failed with HTTP $response" "CRITICAL"
        return 1
    fi
    
    log "INFO" "Audit service health check passed"
    return 0
}

# Get real-time metrics
get_metrics() {
    if ! command -v curl &> /dev/null; then
        log "ERROR" "Curl command not available, cannot get metrics"
        return 1
    fi
    
    local metrics=$(curl -s "${AUDIT_SERVICE_URL}/metrics/realtime" 2>/dev/null || echo "")
    
    if [ -z "$metrics" ]; then
        log "ERROR" "Failed to get audit metrics"
        return 1
    fi
    
    echo "$metrics"
}

# Check for anomalies
check_anomalies() {
    if ! command -v curl &> /dev/null; then
        log "ERROR" "Curl command not available, cannot check anomalies"
        return 1
    fi
    
    local anomalies=$(curl -s "${AUDIT_SERVICE_URL}/anomalies" 2>/dev/null || echo "[]")
    
    # Parse anomalies (simple JSON parsing)
    local anomaly_count=$(echo "$anomalies" | grep -o '"type":' | wc -l || echo "0")
    
    if [ "$anomaly_count" -gt 0 ]; then
        log "WARN" "Detected $anomaly_count anomalies in audit logs"
        
        # Extract anomaly details
        local anomaly_details=$(echo "$anomalies" | grep -E '"type"|"severity"' | head -10)
        log "WARN" "Anomaly details: $anomaly_details"
        
        # Send alerts if threshold exceeded
        if [ "$anomaly_count" -gt "$ALERT_THRESHOLD" ]; then
            send_email_alert "Audit Anomaly Alert" "Detected $anomaly_count anomalies in audit logs"
            send_webhook_alert "Audit Anomalies Detected" "$anomaly_count anomalies detected" "WARNING"
        fi
    fi
    
    return 0
}

# Check compliance status
check_compliance() {
    if ! command -v curl &> /dev/null; then
        log "ERROR" "Curl command not available, cannot check compliance"
        return 1
    fi
    
    local compliance=$(curl -s "${AUDIT_SERVICE_URL}/compliance/summary" 2>/dev/null || echo "")
    
    if [ -z "$compliance" ]; then
        log "ERROR" "Failed to get compliance summary"
        return 1
    fi
    
    # Extract compliance score (simple parsing)
    local compliance_score=$(echo "$compliance" | grep -o '"complianceScore":[0-9.]*' | cut -d':' -f2 || echo "0")
    
    if (( $(echo "$compliance_score < 90" | bc -l) )); then
        log "WARN" "Low compliance score detected: $compliance_score%"
        send_email_alert "Compliance Score Alert" "Compliance score is $compliance_score%"
        send_webhook_alert "Low Compliance Score" "Score: $compliance_score%" "WARNING"
    fi
    
    # Check for critical issues
    local critical_issues=$(echo "$compliance" | grep -o '"criticalIssues":[0-9]*' | cut -d':' -f2 || echo "0")
    
    if [ "$critical_issues" -gt 0 ]; then
        log "ERROR" "Detected $critical_issues critical compliance issues"
        send_email_alert "Critical Compliance Issues" "Found $critical_issues critical compliance issues"
        send_webhook_alert "Critical Compliance Issues" "$critical_issues issues found" "CRITICAL"
    fi
    
    return 0
}

# Check system resources
check_system_resources() {
    # Check disk space
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 80 ]; then
        log "WARN" "High disk usage: ${disk_usage}%"
        if [ "$disk_usage" -gt 90 ]; then
            send_email_alert "High Disk Usage Alert" "Disk usage is ${disk_usage}%"
            send_webhook_alert "High Disk Usage" "${disk_usage}% used" "WARNING"
        fi
    fi
    
    # Check memory usage
    if command -v vm_stat &> /dev/null; then
        # macOS
        local page_size=$(vm_stat | head -1 | awk '{print $7}' | sed 's/\.//')
        local free_pages=$(vm_stat | awk '/free/ {gsub(/\./, ""); print $3}')
        local free_memory=$((free_pages * page_size / 1024 / 1024))
        
        if [ "$free_memory" -lt 100 ]; then
            log "WARN" "Low memory: ${free_memory}MB free"
            send_email_alert "Low Memory Alert" "Only ${free_memory}MB memory free"
            send_webhook_alert "Low Memory" "${free_memory}MB free" "WARNING"
        fi
    elif command -v free &> /dev/null; then
        # Linux
        local free_memory=$(free -m | awk 'NR==2{print $7}')
        if [ "$free_memory" -lt 100 ]; then
            log "WARN" "Low memory: ${free_memory}MB free"
            send_email_alert "Low Memory Alert" "Only ${free_memory}MB memory free"
            send_webhook_alert "Low Memory" "${free_memory}MB free" "WARNING"
        fi
    fi
    
    # Check CPU usage (simplified)
    if command -v top &> /dev/null; then
        local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' || echo "0")
        if (( $(echo "$cpu_usage > 80" | bc -l) )); then
            log "WARN" "High CPU usage: ${cpu_usage}%"
            if (( $(echo "$cpu_usage > 90" | bc -l) )); then
                send_email_alert "High CPU Usage Alert" "CPU usage is ${cpu_usage}%"
                send_webhook_alert "High CPU Usage" "${cpu_usage}% used" "WARNING"
            fi
        fi
    fi
}

# Generate daily report
generate_daily_report() {
    local report_date=$(date '+%Y-%m-%d')
    local report_file="/tmp/audit-report-${report_date}.txt"
    
    {
        echo "Audit Trail Daily Report - $report_date"
        echo "========================================"
        echo ""
        
        echo "System Health Check:"
        check_service_health
        echo ""
        
        echo "Resource Status:"
        check_system_resources
        echo ""
        
        echo "Audit Metrics:"
        get_metrics | jq '.' 2>/dev/null || echo "Failed to get metrics"
        echo ""
        
        echo "Compliance Status:"
        check_compliance
        echo ""
        
        echo "Anomaly Detection:"
        check_anomalies
        echo ""
        
        echo "Report generated at: $(date)"
        
    } > "$report_file"
    
    # Email report
    if [ -f "$report_file" ]; then
        send_email_alert "Audit Daily Report - $report_date" "$(cat "$report_file")"
        rm "$report_file"
    fi
    
    log "INFO" "Daily report generated"
}

# Main monitoring loop
main() {
    log "INFO" "Starting audit monitoring service"
    
    # Trap signals for graceful shutdown
    trap 'log "INFO" "Shutting down audit monitoring service"; exit 0' SIGINT SIGTERM
    
    while true; do
        rotate_log
        
        # Perform health checks
        check_service_health
        
        # Check for anomalies
        check_anomalies
        
        # Check compliance
        check_compliance
        
        # Check system resources
        check_system_resources
        
        # Generate daily report at midnight
        local current_hour=$(date '+%H')
        if [ "$current_hour" = "00" ]; then
            generate_daily_report
        fi
        
        log "INFO" "Monitoring cycle completed, sleeping for $CHECK_INTERVAL seconds"
        sleep "$CHECK_INTERVAL"
    done
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --health-check     Run health check only"
    echo "  --check-anomalies   Check for anomalies only"
    echo "  --check-compliance Check compliance only"
    echo "  --daily-report     Generate daily report"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AUDIT_SERVICE_URL   Audit service URL (default: http://localhost:3000/api/audit)"
    echo "  ALERT_EMAIL         Email address for alerts (default: security@lawfirmpro.com)"
    echo "  ALERT_WEBHOOK       Webhook URL for alerts"
    echo "  ALERT_THRESHOLD     Anomaly alert threshold (default: 10)"
    echo "  CHECK_INTERVAL      Check interval in seconds (default: 300)"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    --health-check)
        check_service_health
        ;;
    --check-anomalies)
        check_anomalies
        ;;
    --check-compliance)
        check_compliance
        ;;
    --daily-report)
        generate_daily_report
        ;;
    --help)
        usage
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        usage
        exit 1
        ;;
esac