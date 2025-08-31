#!/bin/bash

# Monitoring Health Check Script for Law Firm Pro
# This script checks the health of all monitoring components

set -e

# Configuration
MONITORING_DIR="/Users/chris/workspace/lawfirmpro/monitoring"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
LOG_FILE="/Users/chris/workspace/lawfirmpro/logs/health-check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check function
check_service() {
    local service_name=$1
    local service_url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    if [ -z "$service_url" ]; then
        # Check Docker container status
        if docker ps -q -f name="$service_name" | grep -q .; then
            echo -e "${GREEN}OK${NC}"
            return 0
        else
            echo -e "${RED}FAILED${NC}"
            return 1
        fi
    else
        # Check HTTP service status
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$service_url" || echo "000")
        
        if [ "$status_code" -eq "$expected_status" ]; then
            echo -e "${GREEN}OK${NC}"
            return 0
        else
            echo -e "${RED}FAILED (HTTP $status_code)${NC}"
            return 1
        fi
    fi
}

# Memory usage check
check_memory() {
    local service_name=$1
    local threshold_mb=$2
    
    echo -n "Checking $service_name memory usage... "
    
    local memory_usage=$(docker stats "$service_name" --no-stream --format "table {{.MemUsage}}" | tail -n 1 | awk '{print $1}' | sed 's/MiB//')
    
    if [ -z "$memory_usage" ]; then
        echo -e "${RED}FAILED (unable to get memory usage)${NC}"
        return 1
    fi
    
    if [ "$memory_usage" -lt "$threshold_mb" ]; then
        echo -e "${GREEN}OK (${memory_usage}MB)${NC}"
        return 0
    else
        echo -e "${YELLOW}WARNING (${memory_usage}MB > ${threshold_mb}MB)${NC}"
        return 1
    fi
}

# Disk usage check
check_disk() {
    local path=$1
    local threshold_percent=$2
    
    echo -n "Checking disk usage for $path... "
    
    local disk_usage=$(df -h "$path" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt "$threshold_percent" ]; then
        echo -e "${GREEN}OK (${disk_usage}%)${NC}"
        return 0
    else
        echo -e "${YELLOW}WARNING (${disk_usage}% > ${threshold_percent}%)${NC}"
        return 1
    fi
}

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

echo -e "${GREEN}Law Firm Pro Monitoring Health Check${NC}"
echo "=========================================="
log "Starting health check"

# Initialize health status
HEALTHY=true
FAILURES=0

# Check Docker services
echo -e "\n${YELLOW}Docker Services:${NC}"
check_service "prometheus" "" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "grafana" "" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "alertmanager" "" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "loki" "" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "promtail" "" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }

# Check HTTP endpoints
echo -e "\n${YELLOW}HTTP Endpoints:${NC}"
check_service "Prometheus API" "http://localhost:9090/api/v1/targets" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "Grafana API" "http://localhost:3000/api/health" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "Alertmanager" "http://localhost:9093/api/v1/status" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_service "Loki" "http://localhost:3100/ready" || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }

# Check memory usage
echo -e "\n${YELLOW}Memory Usage:${NC}"
check_memory "prometheus" 1024 || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_memory "grafana" 512 || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_memory "alertmanager" 256 || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }
check_memory "loki" 512 || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }

# Check disk usage
echo -e "\n${YELLOW}Disk Usage:${NC}"
check_disk "$MONITORING_DIR" 85 || { HEALTHY=false; FAILURES=$((FAILURES + 1)); }

# Check Prometheus data retention
echo -e "\n${YELLOW}Data Retention:${NC}"
echo -n "Checking Prometheus data retention... "
if [ -d "$MONITORING_DIR/data/prometheus" ]; then
    prometheus_data_size=$(du -sh "$MONITORING_DIR/data/prometheus" | cut -f1)
    echo -e "${GREEN}OK (${prometheus_data_size})${NC}"
else
    echo -e "${YELLOW}WARNING (Prometheus data directory not found)${NC}"
    HEALTHY=false
    FAILURES=$((FAILURES + 1))
fi

# Check Grafana dashboards
echo -n "Checking Grafana dashboards... "
if [ -d "$MONITORING_DIR/grafana/dashboards" ]; then
    dashboard_count=$(find "$MONITORING_DIR/grafana/dashboards" -name "*.json" | wc -l)
    echo -e "${GREEN}OK (${dashboard_count} dashboards)${NC}"
else
    echo -e "${YELLOW}WARNING (No dashboards found)${NC}"
    HEALTHY=false
    FAILURES=$((FAILURES + 1))
fi

# Check alert rules
echo -n "Checking alert rules... "
if [ -f "$MONITORING_DIR/prometheus/alert_rules.yml" ]; then
    alert_rules_count=$(grep -c "alert:" "$MONITORING_DIR/prometheus/alert_rules.yml" || echo 0)
    echo -e "${GREEN}OK (${alert_rules_count} alert rules)${NC}"
else
    echo -e "${YELLOW}WARNING (No alert rules found)${NC}"
    HEALTHY=false
    FAILURES=$((FAILURES + 1))
fi

# Summary
echo -e "\n${YELLOW}Health Check Summary:${NC}"
if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}All monitoring components are healthy!${NC}"
    log "Health check passed - all components healthy"
else
    echo -e "${RED}Health check failed with $FAILURES failure(s)${NC}"
    log "Health check failed with $FAILURES failures"
fi

# Generate health report
cat > "/tmp/health-check-report-$(date +%Y%m%d-%H%M%S).txt" << EOF
Law Firm Pro Monitoring Health Check Report
===========================================
Date: $(date)
Status: $([ "$HEALTHY" = true ] && echo "HEALTHY" || echo "UNHEALTHY")
Failures: $FAILURES

Services Checked:
- Prometheus: $(docker ps -q -f name=prometheus | grep -q . && echo "Running" || echo "Stopped")
- Grafana: $(docker ps -q -f name=grafana | grep -q . && echo "Running" || echo "Stopped")
- Alertmanager: $(docker ps -q -f name=alertmanager | grep -q . && echo "Running" || echo "Stopped")
- Loki: $(docker ps -q -f name=loki | grep -q . && echo "Running" || echo "Stopped")
- Promtail: $(docker ps -q -f name=promtail | grep -q . && echo "Running" || echo "Stopped")

Endpoints Checked:
- Prometheus API: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/api/v1/targets || echo "000")
- Grafana API: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")
- Alertmanager: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9093/api/v1/status || echo "000")
- Loki: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ready || echo "000")

Report generated at: $(date)
EOF

echo -e "\n${YELLOW}Health check report saved to: /tmp/health-check-report-$(date +%Y%m%d-%H%M%S).txt${NC}"

# Exit with appropriate code
if [ "$HEALTHY" = true ]; then
    exit 0
else
    exit 1
fi