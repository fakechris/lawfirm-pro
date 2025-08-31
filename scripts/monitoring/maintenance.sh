#!/bin/bash

# Monitoring Maintenance Script for Law Firm Pro
# This script performs routine maintenance tasks for the monitoring system

set -e

# Configuration
MONITORING_DIR="/Users/chris/workspace/lawfirmpro/monitoring"
BACKUP_DIR="/Users/chris/workspace/lawfirmpro/backups/monitoring"
LOG_FILE="/Users/chris/workspace/lawfirmpro/logs/monitoring-maintenance.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

echo -e "${GREEN}Starting monitoring maintenance...${NC}"
log "Starting monitoring maintenance"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Grafana dashboards
echo -e "${YELLOW}Backing up Grafana dashboards...${NC}"
log "Backing up Grafana dashboards"
cd "$MONITORING_DIR"
docker exec grafana grafana-cli --user admin --password admin123 dashboards export "$BACKUP_DIR/dashboards-$(date +%Y%m%d).tar.gz"

# Backup Prometheus configuration
echo -e "${YELLOW}Backing up Prometheus configuration...${NC}"
log "Backing up Prometheus configuration"
cp -r "$MONITORING_DIR/prometheus" "$BACKUP_DIR/prometheus-$(date +%Y%m%d)"
cp -r "$MONITORING_DIR/alertmanager.yml" "$BACKUP_DIR/alertmanager-$(date +%Y%m%d).yml"

# Backup Grafana configuration
echo -e "${YELLOW}Backing up Grafana configuration...${NC}"
log "Backing up Grafana configuration"
docker exec grafana tar -czf - /etc/grafana > "$BACKUP_DIR/grafana-config-$(date +%Y%m%d).tar.gz"

# Clean up old backups (keep last 7 days)
echo -e "${YELLOW}Cleaning up old backups...${NC}"
log "Cleaning up old backups"
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*-$(date +%Y%m%d)" -mtime +7 -exec rm -rf {} \;

# Clean up Prometheus data (older than 30 days)
echo -e "${YELLOW}Cleaning up old Prometheus data...${NC}"
log "Cleaning up old Prometheus data"
curl -X POST -g 'http://localhost:9090/api/v1/admin/tsdb/clean_tombstones' || true

# Clean up old logs
echo -e "${YELLOW}Cleaning up old logs...${NC}"
log "Cleaning up old logs"
find "$LOG_FILE" -mtime +30 -exec rm -f {} \; || true

# Check service health
echo -e "${YELLOW}Checking service health...${NC}"
log "Checking service health"

services=("prometheus" "grafana" "alertmanager" "loki" "promtail")
for service in "${services[@]}"; do
    if docker ps -q -f name="$service" | grep -q .; then
        echo -e "${GREEN}$service is running${NC}"
        log "$service is running"
    else
        echo -e "${RED}$service is not running${NC}"
        log "$service is not running"
    fi
done

# Check disk usage
echo -e "${YELLOW}Checking disk usage...${NC}"
log "Checking disk usage"
disk_usage=$(df -h "$MONITORING_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    echo -e "${RED}Warning: Disk usage is ${disk_usage}%${NC}"
    log "Warning: Disk usage is ${disk_usage}%"
else
    echo -e "${GREEN}Disk usage is ${disk_usage}%${NC}"
    log "Disk usage is ${disk_usage}%"
fi

# Restart services if needed
echo -e "${YELLOW}Checking if services need restart...${NC}"
log "Checking if services need restart"

# Check Prometheus memory usage
prometheus_memory=$(docker stats prometheus --no-stream --format "table {{.MemUsage}}" | tail -n 1 | awk '{print $1}' | sed 's/MiB//')
if [ "$prometheus_memory" -gt 1024 ]; then
    echo -e "${YELLOW}Restarting Prometheus (memory usage: ${prometheus_memory}MB)${NC}"
    log "Restarting Prometheus (memory usage: ${prometheus_memory}MB)"
    docker restart prometheus
fi

# Check Grafana memory usage
grafana_memory=$(docker stats grafana --no-stream --format "table {{.MemUsage}}" | tail -n 1 | awk '{print $1}' | sed 's/MiB//')
if [ "$grafana_memory" -gt 512 ]; then
    echo -e "${YELLOW}Restarting Grafana (memory usage: ${grafana_memory}MB)${NC}"
    log "Restarting Grafana (memory usage: ${grafana_memory}MB)"
    docker restart grafana
fi

# Generate maintenance report
echo -e "${YELLOW}Generating maintenance report...${NC}"
log "Generating maintenance report"
cat > "$BACKUP_DIR/maintenance-report-$(date +%Y%m%d).txt" << EOF
Monitoring Maintenance Report
=============================
Date: $(date)
Duration: $SECONDS seconds

Services Status:
- Prometheus: $(docker ps -q -f name=prometheus | grep -q . && echo "Running" || echo "Stopped")
- Grafana: $(docker ps -q -f name=grafana | grep -q . && echo "Running" || echo "Stopped")
- Alertmanager: $(docker ps -q -f name=alertmanager | grep -q . && echo "Running" || echo "Stopped")
- Loki: $(docker ps -q -f name=loki | grep -q . && echo "Running" || echo "Stopped")
- Promtail: $(docker ps -q -f name=promtail | grep -q . && echo "Running" || echo "Stopped")

Disk Usage: ${disk_usage}%
Prometheus Memory: ${prometheus_memory}MB
Grafana Memory: ${grafana_memory}MB

Backups Created:
- Dashboards: dashboards-$(date +%Y%m%d).tar.gz
- Prometheus Config: prometheus-$(date +%Y%m%d)
- Alertmanager Config: alertmanager-$(date +%Y%m%d).yml
- Grafana Config: grafana-config-$(date +%Y%m%d).tar.gz

Maintenance completed successfully.
EOF

echo -e "${GREEN}Monitoring maintenance completed successfully!${NC}"
log "Monitoring maintenance completed successfully"
echo ""
echo -e "${GREEN}Maintenance report saved to: $BACKUP_DIR/maintenance-report-$(date +%Y%m%d).txt${NC}"
echo ""
echo -e "${YELLOW}Next maintenance scheduled: $(date -d '+7 days' '+%Y-%m-%d')${NC}"