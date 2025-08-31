#!/bin/bash

# Monitoring script for Law Firm Pro deployment
# Usage: ./monitoring.sh <environment> <kubeconfig>

set -e

ENVIRONMENT=$1
KUBECONFIG=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$KUBECONFIG" ]; then
    echo "Usage: $0 <environment> <kubeconfig>"
    exit 1
fi

echo "📊 Starting monitoring for $ENVIRONMENT environment..."

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        NAMESPACE="lawfirmpro-staging"
        ALERT_THRESHOLD_CPU=80
        ALERT_THRESHOLD_MEMORY=85
        ALERT_THRESHOLD_RESPONSE_TIME=5
        ;;
    "production")
        NAMESPACE="lawfirmpro-production"
        ALERT_THRESHOLD_CPU=70
        ALERT_THRESHOLD_MEMORY=80
        ALERT_THRESHOLD_RESPONSE_TIME=3
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Function to check application metrics
check_application_metrics() {
    echo "📈 Checking application metrics..."
    
    if command -v kubectl &> /dev/null; then
        # Get application pods
        app_pods=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null || echo "")
        
        if [ -z "$app_pods" ]; then
            echo "❌ No application pods found"
            return 1
        fi
        
        # Check CPU usage
        cpu_usage=$(kubectl top pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        
        # Check memory usage
        memory_usage=$(kubectl top pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        
        echo "CPU Usage: ${cpu_usage}m"
        echo "Memory Usage: ${memory_usage}Mi"
        
        # Check thresholds
        if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
            echo "⚠️ High CPU usage detected: ${cpu_usage}m > ${ALERT_THRESHOLD_CPU}m"
            send_alert "high-cpu" "High CPU usage: ${cpu_usage}m"
        fi
        
        if (( $(echo "$memory_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
            echo "⚠️ High memory usage detected: ${memory_usage}Mi > ${ALERT_THRESHOLD_MEMORY}Mi"
            send_alert "high-memory" "High memory usage: ${memory_usage}Mi"
        fi
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to check response times
check_response_times() {
    echo "⏱️ Checking response times..."
    
    if command -v curl &> /dev/null; then
        # Get health check URL
        health_url="https://$ENVIRONMENT.lawfirmpro.com/health"
        
        # Measure response time
        response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 10 "$health_url" || echo "999")
        
        echo "Response Time: ${response_time}s"
        
        # Check threshold
        if (( $(echo "$response_time > $ALERT_THRESHOLD_RESPONSE_TIME" | bc -l) )); then
            echo "⚠️ High response time detected: ${response_time}s > ${ALERT_THRESHOLD_RESPONSE_TIME}s"
            send_alert "high-response-time" "High response time: ${response_time}s"
        fi
        
        return 0
    else
        echo "❌ curl not available"
        return 1
    fi
}

# Function to check error rates
check_error_rates() {
    echo "📉 Checking error rates..."
    
    if command -v kubectl &> /dev/null; then
        # Get application pods
        app_pods=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null || echo "")
        
        if [ -z "$app_pods" ]; then
            echo "❌ No application pods found"
            return 1
        fi
        
        # Check pod restarts
        restarts=$(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $4}' | awk '{sum+=$1} END {print sum}')
        
        echo "Total Restarts: $restarts"
        
        if [ "$restarts" -gt 5 ]; then
            echo "⚠️ High number of pod restarts: $restarts"
            send_alert "high-restarts" "High number of pod restarts: $restarts"
        fi
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to check database health
check_database_health() {
    echo "🗄️ Checking database health..."
    
    if command -v kubectl &> /dev/null; then
        # Get database pods
        db_pods=$(kubectl get pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null || echo "")
        
        if [ -z "$db_pods" ]; then
            echo "❌ No database pods found"
            return 1
        fi
        
        # Check database connections
        db_cpu=$(kubectl top pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        db_memory=$(kubectl top pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        
        echo "Database CPU: ${db_cpu}m"
        echo "Database Memory: ${db_memory}Mi"
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to check Redis health
check_redis_health() {
    echo "🔴 Checking Redis health..."
    
    if command -v kubectl &> /dev/null; then
        # Get Redis pods
        redis_pods=$(kubectl get pods -n $NAMESPACE -l app=redis --no-headers 2>/dev/null || echo "")
        
        if [ -z "$redis_pods" ]; then
            echo "❌ No Redis pods found"
            return 1
        fi
        
        # Check Redis connections
        redis_cpu=$(kubectl top pods -n $NAMESPACE -l app=redis --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        redis_memory=$(kubectl top pods -n $NAMESPACE -l app=redis --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')
        
        echo "Redis CPU: ${redis_cpu}m"
        echo "Redis Memory: ${redis_memory}Mi"
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    echo "🔒 Checking SSL certificate..."
    
    if command -v openssl &> /dev/null; then
        domain="$ENVIRONMENT.lawfirmpro.com"
        
        # Get certificate expiration
        expiration=$(openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
        
        if [ -n "$expiration" ]; then
            echo "SSL Certificate expires: $expiration"
            
            # Check if certificate expires within 30 days
            expiration_timestamp=$(date -d "$expiration" +%s)
            current_timestamp=$(date +%s)
            days_until_expiry=$(( (expiration_timestamp - current_timestamp) / 86400 ))
            
            if [ "$days_until_expiry" -lt 30 ]; then
                echo "⚠️ SSL certificate expires in $days_until_expiry days"
                send_alert "ssl-expiry" "SSL certificate expires in $days_until_expiry days"
            fi
        fi
        
        return 0
    else
        echo "❌ openssl not available"
        return 1
    fi
}

# Function to check disk usage
check_disk_usage() {
    echo "💾 Checking disk usage..."
    
    if command -v kubectl &> /dev/null; then
        # Get PVCs
        pvc_usage=$(kubectl get pvc -n $NAMESPACE --no-headers 2>/dev/null | awk '{print $1, $2, $4}' || echo "")
        
        if [ -n "$pvc_usage" ]; then
            echo "PVC Usage:"
            echo "$pvc_usage"
        fi
        
        return 0
    else
        echo "❌ kubectl not available"
        return 1
    fi
}

# Function to send alerts
send_alert() {
    local alert_type=$1
    local message=$2
    
    echo "🚨 Sending alert: $alert_type - $message"
    
    # Send to Slack if webhook is available
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\": \"🚨 Monitoring Alert for $ENVIRONMENT: $message\"}" \
            "$SLACK_WEBHOOK" || true
    fi
    
    # Send to custom webhook if available
    if [ -n "$MONITORING_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"environment\": \"$ENVIRONMENT\", \"type\": \"$alert_type\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" \
            "$MONITORING_WEBHOOK" || true
    fi
}

# Function to generate monitoring report
generate_monitoring_report() {
    echo "📋 Generating monitoring report..."
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    report_file="/tmp/monitoring_report_${timestamp}.txt"
    
    cat > "$report_file" << EOF
Monitoring Report for $ENVIRONMENT Environment
============================================

Timestamp: $(date -Iseconds)
Environment: $ENVIRONMENT
Namespace: $NAMESPACE

Application Metrics:
- CPU Usage: $(kubectl top pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')m
- Memory Usage: $(kubectl top pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')Mi
- Response Time: $(curl -o /dev/null -s -w '%{time_total}' --max-time 10 "https://$ENVIRONMENT.lawfirmpro.com/health" 2>/dev/null || echo "N/A")s
- Pod Restarts: $(kubectl get pods -n $NAMESPACE -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $4}' | awk '{sum+=$1} END {print sum}')

Database Metrics:
- CPU Usage: $(kubectl top pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')m
- Memory Usage: $(kubectl top pods -n $NAMESPACE -l app=postgres --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')Mi

Redis Metrics:
- CPU Usage: $(kubectl top pods -n $NAMESPACE -l app=redis --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')m
- Memory Usage: $(kubectl top pods -n $NAMESPACE -l app=redis --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {if (NR>0) print sum/NR; else print 0}')Mi

SSL Certificate:
- Expiration: $(openssl s_client -connect "$ENVIRONMENT.lawfirmpro.com:443" -servername "$ENVIRONMENT.lawfirmpro.com" 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)

Alerts:
$(grep "⚠️" /tmp/monitoring.log 2>/dev/null || echo "No alerts")

EOF
    
    echo "✅ Monitoring report generated: $report_file"
}

# Main monitoring process
echo "🚀 Starting monitoring process..."

# Create log file
log_file="/tmp/monitoring.log"
touch "$log_file"

# Run monitoring checks
check_application_metrics | tee -a "$log_file"
check_response_times | tee -a "$log_file"
check_error_rates | tee -a "$log_file"
check_database_health | tee -a "$log_file"
check_redis_health | tee -a "$log_file"
check_ssl_certificate | tee -a "$log_file"
check_disk_usage | tee -a "$log_file"

# Generate report
generate_monitoring_report

echo "✅ Monitoring completed successfully!"
echo "📊 Log file: $log_file"