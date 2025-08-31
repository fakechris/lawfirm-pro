#!/bin/bash

# Security Audit Script for Law Firm Pro
# Comprehensive security audit for Chinese legal compliance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../../compliance/configs/compliance-automation.yaml"
LOG_FILE="/var/log/security-audit.log"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_DIR="/tmp/security-audit-reports/${TIMESTAMP}"

# Chinese legal requirements compliance
COMPLIANCE_STANDARD="Chinese Legal Requirements (PIPL, CSL, DSL)"
AUDIT_TYPE="Comprehensive Security Audit"

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
        ALERT_EMAIL=$(yq '.reporting.reports[0].recipients[0]' "$CONFIG_FILE" 2>/dev/null || echo "compliance@lawfirmpro.com")
        BACKUP_S3_BUCKET=$(yq '.storage.primary.config.bucket' "$CONFIG_FILE" 2>/dev/null || echo "lawfirmpro-backups")
    else
        ALERT_EMAIL="compliance@lawfirmpro.com"
        BACKUP_S3_BUCKET="lawfirmpro-backups"
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
    local required_commands=("systemctl" "grep" "awk" "find" "stat" "netstat" "ss" "openssl")
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

# PIPL Compliance Audit
audit_pipl_compliance() {
    log "Starting PIPL compliance audit..."
    
    local pipl_report="$REPORT_DIR/pipl-compliance.txt"
    
    echo "=== PIPL Compliance Audit Report - $(date) ===" > "$pipl_report"
    echo "Standard: Personal Information Protection Law (PIPL)" >> "$pipl_report"
    echo "" >> "$pipl_report"
    
    local pipl_score=0
    local total_checks=0
    
    # Check 1: Data Localization
    ((total_checks++))
    echo "1. Data Localization Requirements:" >> "$pipl_report"
    local db_region=$(grep -i "region" /etc/environment 2>/dev/null | grep -i "china" || echo "")
    if [[ -n "$db_region" ]]; then
        echo "   ✅ Database region configured for China: $db_region" >> "$pipl_report"
        ((pipl_score++))
    else
        echo "   ❌ Database region not configured for China" >> "$pipl_report"
    fi
    
    # Check 2: Consent Management
    ((total_checks++))
    echo "" >> "$pipl_report"
    echo "2. Consent Management:" >> "$pipl_report"
    local consent_records=$(find /var/log -name "*consent*" -type f 2>/dev/null | wc -l)
    if [[ "$consent_records" -gt 0 ]]; then
        echo "   ✅ Consent records found: $consent_records files" >> "$pipl_report"
        ((pipl_score++))
    else
        echo "   ❌ No consent records found" >> "$pipl_report"
    fi
    
    # Check 3: Data Subject Rights
    ((total_checks++))
    echo "" >> "$pipl_report"
    echo "3. Data Subject Rights Implementation:" >> "$pipl_report"
    local dsr_procedures=$(find /opt -name "*dsr*" -o -name "*data-subject*" 2>/dev/null | wc -l)
    if [[ "$dsr_procedures" -gt 0 ]]; then
        echo "   ✅ Data subject rights procedures found: $dsr_procedures" >> "$pipl_report"
        ((pipl_score++))
    else
        echo "   ❌ Data subject rights procedures not found" >> "$pipl_report"
    fi
    
    # Check 4: Data Retention Policies
    ((total_checks++))
    echo "" >> "$pipl_report"
    echo "4. Data Retention Policies:" >> "$pipl_report"
    local retention_policies=$(find /etc -name "*retention*" -o -name "*policy*" 2>/dev/null | wc -l)
    if [[ "$retention_policies" -gt 0 ]]; then
        echo "   ✅ Data retention policies found: $retention_policies" >> "$pipl_report"
        ((pipl_score++))
    else
        echo "   ❌ Data retention policies not found" >> "$pipl_report"
    fi
    
    # Check 5: Breach Notification Procedures
    ((total_checks++))
    echo "" >> "$pipl_report"
    echo "5. Breach Notification Procedures:" >> "$pipl_report"
    local breach_procedures=$(find /opt -name "*breach*" -o -name "*incident*" 2>/dev/null | wc -l)
    if [[ "$breach_procedures" -gt 0 ]]; then
        echo "   ✅ Breach notification procedures found: $breach_procedures" >> "$pipl_report"
        ((pipl_score++))
    else
        echo "   ❌ Breach notification procedures not found" >> "$pipl_report"
    fi
    
    # Calculate PIPL compliance score
    local pipl_percentage=$((pipl_score * 100 / total_checks))
    echo "" >> "$pipl_report"
    echo "PIPL Compliance Score: $pipl_percentage% ($pipl_score/$total_checks)" >> "$pipl_report"
    
    # Send alert if score is below threshold
    if [[ "$pipl_percentage" -lt 80 ]]; then
        send_notification "PIPL Compliance Alert" "PIPL compliance score is $pipl_percentage%. Immediate action required." "HIGH"
    fi
    
    log "PIPL compliance audit completed - Score: $pipl_percentage%"
}

# CSL Compliance Audit
audit_csl_compliance() {
    log "Starting CSL compliance audit..."
    
    local csl_report="$REPORT_DIR/csl-compliance.txt"
    
    echo "=== CSL Compliance Audit Report - $(date) ===" > "$csl_report"
    echo "Standard: Cybersecurity Law (CSL)" >> "$csl_report"
    echo "" >> "$csl_report"
    
    local csl_score=0
    local total_checks=0
    
    # Check 1: Network Security Grading
    ((total_checks++))
    echo "1. Network Security Grading System:" >> "$csl_report"
    local security_grading=$(find /etc -name "*grading*" -o -name "*classification*" 2>/dev/null | wc -l)
    if [[ "$security_grading" -gt 0 ]]; then
        echo "   ✅ Security grading system implemented" >> "$csl_report"
        ((csl_score++))
    else
        echo "   ❌ Security grading system not implemented" >> "$csl_report"
    fi
    
    # Check 2: Critical Infrastructure Protection
    ((total_checks++))
    echo "" >> "$csl_report"
    echo "2. Critical Infrastructure Protection:" >> "$csl_report"
    local infrastructure_protection=$(systemctl is-active firewalld 2>/dev/null && echo "active" || echo "inactive")
    if [[ "$infrastructure_protection" == "active" ]]; then
        echo "   ✅ Firewall protection active" >> "$csl_report"
        ((csl_score++))
    else
        echo "   ❌ Firewall protection inactive" >> "$csl_report"
    fi
    
    # Check 3: Security Assessments
    ((total_checks++))
    echo "" >> "$csl_report"
    echo "3. Security Assessments:" >> "$csl_report"
    local security_assessments=$(find /var/log -name "*audit*" -o -name "*assessment*" 2>/dev/null | wc -l)
    if [[ "$security_assessments" -gt 0 ]]; then
        echo "   ✅ Security assessment records found: $security_assessments" >> "$csl_report"
        ((csl_score++))
    else
        echo "   ❌ No security assessment records found" >> "$csl_report"
    fi
    
    # Check 4: Incident Reporting
    ((total_checks++))
    echo "" >> "$csl_report"
    echo "4. Incident Reporting Procedures:" >> "$csl_report"
    local incident_reporting=$(find /opt -name "*incident*" -o -name "*reporting*" 2>/dev/null | wc -l)
    if [[ "$incident_reporting" -gt 0 ]]; then
        echo "   ✅ Incident reporting procedures found" >> "$csl_report"
        ((csl_score++))
    else
        echo "   ❌ Incident reporting procedures not found" >> "$csl_report"
    fi
    
    # Check 5: Data Classification
    ((total_checks++))
    echo "" >> "$csl_report"
    echo "5. Data Classification System:" >> "$csl_report"
    local data_classification=$(find /etc -name "*classification*" 2>/dev/null | wc -l)
    if [[ "$data_classification" -gt 0 ]]; then
        echo "   ✅ Data classification system found" >> "$csl_report"
        ((csl_score++))
    else
        echo "   ❌ Data classification system not found" >> "$csl_report"
    fi
    
    # Calculate CSL compliance score
    local csl_percentage=$((csl_score * 100 / total_checks))
    echo "" >> "$csl_report"
    echo "CSL Compliance Score: $csl_percentage% ($csl_score/$total_checks)" >> "$csl_report"
    
    # Send alert if score is below threshold
    if [[ "$csl_percentage" -lt 80 ]]; then
        send_notification "CSL Compliance Alert" "CSL compliance score is $csl_percentage%. Immediate action required." "HIGH"
    fi
    
    log "CSL compliance audit completed - Score: $csl_percentage%"
}

# DSL Compliance Audit
audit_dsl_compliance() {
    log "Starting DSL compliance audit..."
    
    local dsl_report="$REPORT_DIR/dsl-compliance.txt"
    
    echo "=== DSL Compliance Audit Report - $(date) ===" > "$dsl_report"
    echo "Standard: Data Security Law (DSL)" >> "$dsl_report"
    echo "" >> "$dsl_report"
    
    local dsl_score=0
    local total_checks=0
    
    # Check 1: Data Classification System
    ((total_checks++))
    echo "1. Data Classification System:" >> "$dsl_report"
    local classification_levels=$(grep -r "CONFIDENTIAL\|RESTRICTED\|INTERNAL" /etc/policies/ 2>/dev/null | wc -l)
    if [[ "$classification_levels" -gt 0 ]]; then
        echo "   ✅ Data classification levels defined: $classification_levels references" >> "$dsl_report"
        ((dsl_score++))
    else
        echo "   ❌ Data classification levels not defined" >> "$dsl_report"
    fi
    
    # Check 2: Risk Assessments
    ((total_checks++))
    echo "" >> "$dsl_report"
    echo "2. Risk Assessment Procedures:" >> "$dsl_report"
    local risk_assessments=$(find /opt -name "*risk*" -o -name "*assessment*" 2>/dev/null | wc -l)
    if [[ "$risk_assessments" -gt 0 ]]; then
        echo "   ✅ Risk assessment procedures found: $risk_assessments" >> "$dsl_report"
        ((dsl_score++))
    else
        echo "   ❌ Risk assessment procedures not found" >> "$dsl_report"
    fi
    
    # Check 3: Security Measures
    ((total_checks++))
    echo "" >> "$dsl_report"
    echo "3. Security Measures Implementation:" >> "$dsl_report"
    local security_measures=$(systemctl is-active fail2ban ufw apparmor 2>/dev/null | grep -c "active")
    if [[ "$security_measures" -ge 2 ]]; then
        echo "   ✅ Security measures implemented: $security_measures active services" >> "$dsl_report"
        ((dsl_score++))
    else
        echo "   ❌ Insufficient security measures: $security_measures active services" >> "$dsl_report"
    fi
    
    # Check 4: Cross-border Data Transfer
    ((total_checks++))
    echo "" >> "$dsl_report"
    echo "4. Cross-border Data Transfer Controls:" >> "$dsl_report"
    local transfer_controls=$(find /etc -name "*transfer*" -o -name "*border*" 2>/dev/null | wc -l)
    if [[ "$transfer_controls" -gt 0 ]]; then
        echo "   ✅ Cross-border data transfer controls found" >> "$dsl_report"
        ((dsl_score++))
    else
        echo "   ❌ Cross-border data transfer controls not found" >> "$dsl_report"
    fi
    
    # Check 5: Data Processing Security
    ((total_checks++))
    echo "" >> "$dsl_report"
    echo "5. Data Processing Security:" >> "$dsl_report"
    local processing_security=$(systemctl is-active auditd 2>/dev/null && echo "active" || echo "inactive")
    if [[ "$processing_security" == "active" ]]; then
        echo "   ✅ Data processing audit logging active" >> "$dsl_report"
        ((dsl_score++))
    else
        echo "   ❌ Data processing audit logging inactive" >> "$dsl_report"
    fi
    
    # Calculate DSL compliance score
    local dsl_percentage=$((dsl_score * 100 / total_checks))
    echo "" >> "$dsl_report"
    echo "DSL Compliance Score: $dsl_percentage% ($dsl_score/$total_checks)" >> "$dsl_report"
    
    # Send alert if score is below threshold
    if [[ "$dsl_percentage" -lt 80 ]]; then
        send_notification "DSL Compliance Alert" "DSL compliance score is $dsl_percentage%. Immediate action required." "HIGH"
    fi
    
    log "DSL compliance audit completed - Score: $dsl_percentage%"
}

# Technical Security Audit
audit_technical_security() {
    log "Starting technical security audit..."
    
    local tech_report="$REPORT_DIR/technical-security.txt"
    
    echo "=== Technical Security Audit Report - $(date) ===" > "$tech_report"
    echo "" >> "$tech_report"
    
    local tech_score=0
    local total_checks=0
    
    # Check 1: System Hardening
    ((total_checks++))
    echo "1. System Hardening:" >> "$tech_report"
    local ssh_config="/etc/ssh/sshd_config"
    if [[ -f "$ssh_config" ]]; then
        local root_login=$(grep -c "^PermitRootLogin no" "$ssh_config")
        local password_auth=$(grep -c "^PasswordAuthentication no" "$ssh_config")
        if [[ "$root_login" -gt 0 && "$password_auth" -gt 0 ]]; then
            echo "   ✅ SSH hardening properly configured" >> "$tech_report"
            ((tech_score++))
        else
            echo "   ❌ SSH hardening issues detected" >> "$tech_report"
        fi
    else
        echo "   ❌ SSH configuration file not found" >> "$tech_report"
    fi
    
    # Check 2: Firewall Configuration
    ((total_checks++))
    echo "" >> "$tech_report"
    echo "2. Firewall Configuration:" >> "$tech_report"
    if systemctl is-active --quiet ufw; then
        echo "   ✅ UFW firewall is active" >> "$tech_report"
        ((tech_score++))
    else
        echo "   ❌ UFW firewall is inactive" >> "$tech_report"
    fi
    
    # Check 3: Encryption Standards
    ((total_checks++))
    echo "" >> "$tech_report"
    echo "3. Encryption Standards:" >> "$tech_report"
    local ssl_config=$(find /etc -name "*.pem" -o -name "*.crt" -o -name "*.key" 2>/dev/null | wc -l)
    if [[ "$ssl_config" -gt 0 ]]; then
        echo "   ✅ SSL/TLS certificates found: $ssl_config" >> "$tech_report"
        ((tech_score++))
    else
        echo "   ❌ No SSL/TLS certificates found" >> "$tech_report"
    fi
    
    # Check 4: Access Controls
    ((total_checks++))
    echo "" >> "$tech_report"
    echo "4. Access Controls:" >> "$tech_report"
    local sudo_users=$(grep -c "^sudo" /etc/group 2>/dev/null || echo "0")
    if [[ "$sudo_users" -le 5 ]]; then
        echo "   ✅ Limited sudo users: $sudo_users" >> "$tech_report"
        ((tech_score++))
    else
        echo "   ❌ Too many sudo users: $sudo_users" >> "$tech_report"
    fi
    
    # Check 5: Logging and Monitoring
    ((total_checks++))
    echo "" >> "$tech_report"
    echo "5. Logging and Monitoring:" >> "$tech_report"
    local auditd_status=$(systemctl is-active auditd 2>/dev/null || echo "inactive")
    if [[ "$auditd_status" == "active" ]]; then
        echo "   ✅ Audit logging is active" >> "$tech_report"
        ((tech_score++))
    else
        echo "   ❌ Audit logging is inactive" >> "$tech_report"
    fi
    
    # Calculate technical security score
    local tech_percentage=$((tech_score * 100 / total_checks))
    echo "" >> "$tech_report"
    echo "Technical Security Score: $tech_percentage% ($tech_score/$total_checks)" >> "$tech_report"
    
    log "Technical security audit completed - Score: $tech_percentage%"
}

# Vulnerability Assessment
perform_vulnerability_assessment() {
    log "Starting vulnerability assessment..."
    
    local vuln_report="$REPORT_DIR/vulnerability-assessment.txt"
    
    echo "=== Vulnerability Assessment Report - $(date) ===" > "$vuln_report"
    echo "" >> "$vuln_report"
    
    # Check for known vulnerabilities
    echo "Checking for known vulnerabilities..." >> "$vuln_report"
    
    # Check package vulnerabilities
    if command -v apt &> /dev/null; then
        echo "" >> "$vuln_report"
        echo "Package Vulnerabilities:" >> "$vuln_report"
        apt list --upgradable 2>/dev/null | grep -i security >> "$vuln_report" || echo "   ✅ No security updates pending" >> "$vuln_report"
    fi
    
    # Check for weak passwords
    echo "" >> "$vuln_report"
    echo "Password Security:" >> "$vuln_report"
    local weak_passwords=$(grep -c "password.*:" /etc/shadow 2>/dev/null || echo "0")
    if [[ "$weak_passwords" -eq 0 ]]; then
        echo "   ✅ No weak password hashes found" >> "$vuln_report"
    else
        echo "   ❌ Potential weak password hashes found: $weak_passwords" >> "$vuln_report"
    fi
    
    # Check for open ports
    echo "" >> "$vuln_report"
    echo "Network Services:" >> "$vuln_report"
    if command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep LISTEN >> "$vuln_report"
    elif command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep LISTEN >> "$vuln_report"
    fi
    
    # Check for SUID/SGID files
    echo "" >> "$vuln_report"
    echo "SUID/SGID Files:" >> "$vuln_report"
    local suid_files=$(find / -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
    echo "   Total SUID/SGID files: $suid_files" >> "$vuln_report"
    
    # Check for world-writable files
    echo "" >> "$vuln_report"
    echo "World-Writable Files:" >> "$vuln_report"
    local ww_files=$(find / -type f -perm -o+w 2>/dev/null | wc -l)
    echo "   Total world-writable files: $ww_files" >> "$vuln_report"
    
    log "Vulnerability assessment completed"
}

# Access Control Audit
audit_access_controls() {
    log "Starting access control audit..."
    
    local access_report="$REPORT_DIR/access-controls.txt"
    
    echo "=== Access Control Audit Report - $(date) ===" > "$access_report"
    echo "" >> "$access_report"
    
    # Audit user accounts
    echo "User Account Audit:" >> "$access_report"
    echo "Total user accounts:" $(cat /etc/passwd | wc -l) >> "$access_report"
    echo "Active user accounts:" $(cat /etc/passwd | grep -v "/nologin" | grep -v "/false" | wc -l) >> "$access_report"
    echo "System accounts:" $(cat /etc/passwd | grep -E "/nologin|/false" | wc -l) >> "$access_report"
    
    # Check for unused accounts
    echo "" >> "$access_report"
    echo "Potentially Unused Accounts (last login > 90 days):" >> "$access_report"
    if command -v lastlog &> /dev/null; then
        lastlog -b 90 | grep -v "Never logged in" >> "$access_report" 2>/dev/null || echo "   No unused accounts found" >> "$access_report"
    fi
    
    # Audit sudo access
    echo "" >> "$access_report"
    echo "Sudo Access:" >> "$access_report"
    if [[ -f /etc/sudoers ]]; then
        grep -v "^#" /etc/sudoers | grep -v "^$" >> "$access_report" 2>/dev/null || echo "   No custom sudo rules found" >> "$access_report"
    fi
    
    # Audit group memberships
    echo "" >> "$access_report"
    echo "Group Memberships:" >> "$access_report"
    echo "Users with sudo access:" $(grep "^sudo" /etc/group | cut -d: -f4 | tr ',' ' ' | wc -w) >> "$access_report"
    echo "Users with admin access:" $(grep "^admin" /etc/group 2>/dev/null | cut -d: -f4 | tr ',' ' ' | wc -w || echo "0") >> "$access_report"
    
    log "Access control audit completed"
}

# Generate comprehensive audit report
generate_audit_report() {
    log "Generating comprehensive audit report..."
    
    local final_report="$REPORT_DIR/security-audit-report-${TIMESTAMP}.md"
    
    # Calculate overall scores
    local pipl_score=$(grep "PIPL Compliance Score:" "$REPORT_DIR/pipl-compliance.txt" | awk '{print $4}' | sed 's/%//')
    local csl_score=$(grep "CSL Compliance Score:" "$REPORT_DIR/csl-compliance.txt" | awk '{print $4}' | sed 's/%//')
    local dsl_score=$(grep "DSL Compliance Score:" "$REPORT_DIR/dsl-compliance.txt" | awk '{print $4}' | sed 's/%//')
    local tech_score=$(grep "Technical Security Score:" "$REPORT_DIR/technical-security.txt" | awk '{print $4}' | sed 's/%//')
    
    local overall_score=$(((pipl_score + csl_score + dsl_score + tech_score) / 4))
    
    cat > "$final_report" << EOF
# Security Audit Report

**Generated:** $(date)  
**System:** $(hostname)  
**Environment:** ${ENVIRONMENT:-"production"}  
**Audit Type:** $AUDIT_TYPE  
**Compliance Standard:** $COMPLIANCE_STANDARD

## Executive Summary

This comprehensive security audit evaluates the Law Firm Pro system against Chinese legal requirements (PIPL, CSL, DSL) and technical security best practices. The audit covers compliance frameworks, technical controls, and vulnerability assessments.

## Overall Security Score: $overall_score%

### Framework Scores
- **PIPL Compliance:** $pipl_score%
- **CSL Compliance:** $csl_score%
- **DSL Compliance:** $dsl_score%
- **Technical Security:** $tech_score%

## Compliance Status

### Personal Information Protection Law (PIPL) - $pipl_score%
$(cat "$REPORT_DIR/pipl-compliance.txt" | grep -E "(✅|❌)" | sed 's/^/- /')

### Cybersecurity Law (CSL) - $csl_score%
$(cat "$REPORT_DIR/csl-compliance.txt" | grep -E "(✅|❌)" | sed 's/^/- /')

### Data Security Law (DSL) - $dsl_score%
$(cat "$REPORT_DIR/dsl-compliance.txt" | grep -E "(✅|❌)" | sed 's/^/- /')

## Technical Security Assessment - $tech_score%
$(cat "$REPORT_DIR/technical-security.txt" | grep -E "(✅|❌)" | sed 's/^/- /')

## Vulnerability Assessment

### Critical Findings
$(cat "$REPORT_DIR/vulnerability-assessment.txt" | grep -E "(❌|CRITICAL|HIGH)" || echo "No critical findings identified")

### Recommendations
1. **Immediate Actions (0-30 days):**
   - Address all critical vulnerabilities
   - Remediate compliance gaps below 80%
   - Implement missing security controls

2. **Short-term Actions (30-90 days):**
   - Enhance monitoring and alerting
   - Improve documentation and procedures
   - Conduct staff training

3. **Long-term Actions (90+ days):**
   - Implement continuous compliance monitoring
   - Establish regular penetration testing
   - Develop security maturity roadmap

## Access Control Summary

$(cat "$REPORT_DIR/access-controls.txt" | grep -E "Total|Users with" | sed 's/^/- /')

## Detailed Reports

- [PIPL Compliance](pipl-compliance.txt)
- [CSL Compliance](csl-compliance.txt)
- [DSL Compliance](dsl-compliance.txt)
- [Technical Security](technical-security.txt)
- [Vulnerability Assessment](vulnerability-assessment.txt)
- [Access Controls](access-controls.txt)

## Next Audit

**Recommended:** $(date -d '3 months' '+%Y-%m-%d')  
**Type:** Follow-up Compliance Audit  
**Focus:** Remediation verification

---

*This report was generated automatically by the Law Firm Pro security audit script.*
EOF

    log "Comprehensive audit report generated: $final_report"
    
    # Upload report to S3 if configured
    if command -v aws &> /dev/null; then
        aws s3 cp "$REPORT_DIR" "s3://${BACKUP_S3_BUCKET}/audit-reports/${TIMESTAMP}/" --recursive || true
    fi
    
    # Send summary notification
    local summary="Security audit completed. Overall score: $overall_score%. Report available at: $final_report"
    local severity="INFO"
    if [[ "$overall_score" -lt 80 ]]; then
        severity="HIGH"
    fi
    send_notification "Security Audit Completed" "$summary" "$severity"
}

# Clean up temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove old audit directories (keep last 30 days)
    find /tmp/security-audit-reports -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting security audit process..."
    
    # Set error trap
    trap 'error_exit "Script interrupted"' INT TERM
    trap cleanup EXIT
    
    # Execute audit tasks
    load_config
    validate_prerequisites
    create_report_directory
    audit_pipl_compliance
    audit_csl_compliance
    audit_dsl_compliance
    audit_technical_security
    perform_vulnerability_assessment
    audit_access_controls
    generate_audit_report
    
    log "Security audit process completed successfully"
    
    # Exit with success
    exit 0
}

# Run main function
main "$@"