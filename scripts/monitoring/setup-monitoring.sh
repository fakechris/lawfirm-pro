#!/bin/bash

# Monitoring Setup Script for Law Firm Pro
# This script sets up the complete monitoring infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="/Users/chris/workspace/lawfirmpro/monitoring"
SCRIPTS_DIR="/Users/chris/workspace/lawfirmpro/scripts/monitoring"

echo -e "${GREEN}Starting Law Firm Pro monitoring setup...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p "$MONITORING_DIR/data/prometheus"
mkdir -p "$MONITORING_DIR/data/grafana"
mkdir -p "$MONITORING_DIR/data/alertmanager"
mkdir -p "$MONITORING_DIR/data/loki"
mkdir -p "$MONITORING_DIR/logs"

# Set permissions
chmod 755 "$MONITORING_DIR/data"
chmod 755 "$SCRIPTS_DIR"

# Create .env file for monitoring
echo -e "${YELLOW}Creating environment configuration...${NC}"
cat > "$MONITORING_DIR/.env" << EOF
# Monitoring Environment Variables
GRAFANA_ADMIN_PASSWORD=admin123
SLACK_CRITICAL_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_CRITICAL_WEBHOOK
SLACK_WARNING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WARNING_WEBHOOK
SLACK_MONITORING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_MONITORING_WEBHOOK
PAGERDUTY_SERVICE_KEY=YOUR_PAGERDUTY_SERVICE_KEY
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@lawfirmpro.com
SMTP_PASSWORD=your-smtp-password
ENVIRONMENT=development
EOF

echo -e "${GREEN}Environment configuration created at $MONITORING_DIR/.env${NC}"
echo -e "${YELLOW}Please update the .env file with your actual configuration values.${NC}"

# Start monitoring services
echo -e "${YELLOW}Starting monitoring services...${NC}"
cd "$MONITORING_DIR"

# Start Prometheus stack
echo -e "${YELLOW}Starting Prometheus, Grafana, and Alertmanager...${NC}"
docker-compose up -d

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 30

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose ps

# Start logging services
echo -e "${YELLOW}Starting logging services...${NC}"
cd "$MONITORING_DIR/logging"
docker-compose up -d

# Wait for logging services
sleep 20

echo -e "${YELLOW}Checking logging service status...${NC}"
docker-compose ps

# Create default dashboards and datasources
echo -e "${YELLOW}Setting up Grafana dashboards...${NC}"
cd "$MONITORING_DIR"
./scripts/setup-grafana.sh

echo -e "${GREEN}Monitoring setup completed successfully!${NC}"
echo ""
echo -e "${GREEN}Services are now running:${NC}"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3000 (admin/admin123)"
echo "  - Alertmanager: http://localhost:9093"
echo "  - Loki: http://localhost:3100"
echo "  - Kibana: http://localhost:5601"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update $MONITORING_DIR/.env with your actual configuration"
echo "2. Configure notification channels in Alertmanager"
echo "3. Import custom dashboards into Grafana"
echo "4. Set up application metrics export"
echo ""
echo -e "${GREEN}Monitoring setup complete!${NC}"