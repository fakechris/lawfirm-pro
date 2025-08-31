#!/bin/bash

# Grafana Setup Script for Law Firm Pro
# This script sets up Grafana dashboards and datasources

set -e

# Configuration
GRAFANA_URL="http://localhost:3000"
GRAFANA_USER="admin"
GRAFANA_PASSWORD="admin123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Grafana for Law Firm Pro...${NC}"

# Wait for Grafana to be ready
echo -e "${YELLOW}Waiting for Grafana to be ready...${NC}"
until curl -s "$GRAFANA_URL/api/health" > /dev/null; do
    echo "Waiting for Grafana..."
    sleep 5
done

# Change default password
echo -e "${YELLOW}Changing default Grafana password...${NC}"
curl -X POST -H "Content-Type: application/json" -d '{
  "oldPassword": "admin",
  "newPassword": "'"$GRAFANA_PASSWORD"'",
  "confirmNew": "'"$GRAFANA_PASSWORD"'"
}' "$GRAFANA_URL/api/user/password" -u admin:admin

# Create API token for automation
echo -e "${YELLOW}Creating API token...${NC}"
TOKEN_RESPONSE=$(curl -X POST -H "Content-Type: application/json" -d '{
  "name": "Monitoring Setup Token",
  "role": "Admin"
}' "$GRAFANA_URL/api/auth/keys" -u "$GRAFANA_USER:$GRAFANA_PASSWORD")

API_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"key":"[^"]*' | cut -d'"' -f4)

if [ -z "$API_TOKEN" ]; then
    echo -e "${RED}Failed to create API token${NC}"
    exit 1
fi

echo -e "${GREEN}API token created: $API_TOKEN${NC}"

# Add Prometheus datasource
echo -e "${YELLOW}Adding Prometheus datasource...${NC}"
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "name": "Prometheus",
  "type": "prometheus",
  "access": "proxy",
  "url": "http://prometheus:9090",
  "isDefault": true,
  "jsonData": {
    "httpMethod": "POST",
    "queryTimeout": "60s",
    "timeInterval": "15s"
  }
}' "$GRAFANA_URL/api/datasources"

# Add Loki datasource
echo -e "${YELLOW}Adding Loki datasource...${NC}"
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "name": "Loki",
  "type": "loki",
  "access": "proxy",
  "url": "http://loki:3100",
  "jsonData": {
    "maxLines": 1000
  }
}' "$GRAFANA_URL/api/datasources"

# Import system overview dashboard
echo -e "${YELLOW}Importing System Overview dashboard...${NC}"
DASHBOARD_JSON=$(cat /Users/chris/workspace/lawfirmpro/monitoring/grafana/dashboards/system-overview.json)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "dashboard": '"$(echo "$DASHBOARD_JSON" | jq -c '.dashboard')"',
  "overwrite": true
}' "$GRAFANA_URL/api/dashboards/db"

# Import integration services dashboard
echo -e "${YELLOW}Importing Integration Services dashboard...${NC}"
DASHBOARD_JSON=$(cat /Users/chris/workspace/lawfirmpro/monitoring/grafana/dashboards/integration-services.json)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "dashboard": '"$(echo "$DASHBOARD_JSON" | jq -c '.dashboard')"',
  "overwrite": true
}' "$GRAFANA_URL/api/dashboards/db"

# Import alerts dashboard
echo -e "${YELLOW}Importing Alerts dashboard...${NC}"
DASHBOARD_JSON=$(cat /Users/chris/workspace/lawfirmpro/monitoring/grafana/dashboards/alerts-dashboard.json)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "dashboard": '"$(echo "$DASHBOARD_JSON" | jq -c '.dashboard')"',
  "overwrite": true
}' "$GRAFANA_URL/api/dashboards/db"

# Import performance dashboard
echo -e "${YELLOW}Importing Performance dashboard...${NC}"
DASHBOARD_JSON=$(cat /Users/chris/workspace/lawfirmpro/monitoring/grafana/dashboards/performance-dashboard.json)
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "dashboard": '"$(echo "$DASHBOARD_JSON" | jq -c '.dashboard')"',
  "overwrite": true
}' "$GRAFANA_URL/api/dashboards/db"

# Create monitoring folder
echo -e "${YELLOW}Creating monitoring folder...${NC}"
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "title": "Law Firm Pro Monitoring",
  "uid": "lawfirmpro-monitoring"
}' "$GRAFANA_URL/api/folders"

# Configure notification channels
echo -e "${YELLOW}Configuring notification channels...${NC}"
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $API_TOKEN" -d '{
  "name": "Email Alerts",
  "type": "email",
  "settings": {
    "addresses": "alerts@lawfirmpro.com",
    "subject": "Law Firm Pro Alert"
  },
  "secureFields": {}
}' "$GRAFANA_URL/api/alert-notifications"

echo -e "${GREEN}Grafana setup completed successfully!${NC}"
echo ""
echo -e "${GREEN}Grafana is available at: $GRAFANA_URL${NC}"
echo "Username: $GRAFANA_USER"
echo "Password: $GRAFANA_PASSWORD"
echo ""
echo -e "${YELLOW}Imported dashboards:${NC}"
echo "  - System Overview"
echo "  - Integration Services"
echo "  - Alerts & Incidents"
echo "  - Performance Monitoring"
echo ""
echo -e "${YELLOW}Note: Update notification channels with your actual email/webhook URLs${NC}"