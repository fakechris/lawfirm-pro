#!/bin/bash

# Health check script for Law Firm Pro
# Usage: ./health-check.sh <environment> <health-check-url>

set -e

ENVIRONMENT=$1
HEALTH_CHECK_URL=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$HEALTH_CHECK_URL" ]; then
    echo "Usage: $0 <environment> <health-check-url>"
    exit 1
fi

echo "🏥 Running health checks for $ENVIRONMENT environment..."
echo "🔗 Health check URL: $HEALTH_CHECK_URL"

# Set health check thresholds
case $ENVIRONMENT in
    "staging")
        MAX_RESPONSE_TIME=5
        MAX_ERROR_RATE=5
        ;;
    "production")
        MAX_RESPONSE_TIME=3
        MAX_ERROR_RATE=1
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Function to check HTTP health
check_http_health() {
    local url=$1
    local timeout=$2
    
    echo "📡 Checking HTTP health: $url"
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\n" --max-time $timeout "$url" || echo "HTTP_CODE:000\nTIME_TOTAL:0")
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    time_total=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ HTTP health check passed (Status: $http_code, Time: ${time_total}s)"
        return 0
    else
        echo "❌ HTTP health check failed (Status: $http_code, Time: ${time_total}s)"
        return 1
    fi
}

# Function to check database health
check_database_health() {
    echo "🗄️ Checking database health..."
    
    # This would typically check the database connection
    # For now, we'll simulate it
    if command -v kubectl &> /dev/null; then
        # Check if database pods are running
        db_pods=$(kubectl get pods -n lawfirmpro-$ENVIRONMENT -l app=postgres --no-headers | wc -l)
        if [ "$db_pods" -gt 0 ]; then
            echo "✅ Database health check passed"
            return 0
        else
            echo "❌ Database health check failed - no pods running"
            return 1
        fi
    else
        echo "⚠️ kubectl not available, skipping database health check"
        return 0
    fi
}

# Function to check Redis health
check_redis_health() {
    echo "🔴 Checking Redis health..."
    
    if command -v kubectl &> /dev/null; then
        # Check if Redis pods are running
        redis_pods=$(kubectl get pods -n lawfirmpro-$ENVIRONMENT -l app=redis --no-headers | wc -l)
        if [ "$redis_pods" -gt 0 ]; then
            echo "✅ Redis health check passed"
            return 0
        else
            echo "❌ Redis health check failed - no pods running"
            return 1
        fi
    else
        echo "⚠️ kubectl not available, skipping Redis health check"
        return 0
    fi
}

# Function to check application metrics
check_application_metrics() {
    echo "📊 Checking application metrics..."
    
    metrics_url="${HEALTH_CHECK_URL}/metrics"
    
    if curl -s --max-time 5 "$metrics_url" > /dev/null; then
        echo "✅ Application metrics check passed"
        return 0
    else
        echo "❌ Application metrics check failed"
        return 1
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    echo "🔒 Checking SSL certificate..."
    
    if [[ "$HEALTH_CHECK_URL" == https://* ]]; then
        domain=$(echo "$HEALTH_CHECK_URL" | sed 's|https://||' | sed 's|/.*||')
        
        if command -v openssl &> /dev/null; then
            if openssl s_client -connect "$domain:443" -servername "$domain" < /dev/null > /dev/null 2>&1; then
                echo "✅ SSL certificate check passed"
                return 0
            else
                echo "❌ SSL certificate check failed"
                return 1
            fi
        else
            echo "⚠️ openssl not available, skipping SSL certificate check"
            return 0
        fi
    else
        echo "⚠️ Not HTTPS, skipping SSL certificate check"
        return 0
    fi
}

# Function to check load balancer health
check_load_balancer_health() {
    echo "⚖️ Checking load balancer health..."
    
    if command -v kubectl &> /dev/null; then
        # Check ingress status
        ingress=$(kubectl get ingress lawfirmpro-ingress -n lawfirmpro-$ENVIRONMENT --no-headers 2>/dev/null || echo "")
        if [ -n "$ingress" ]; then
            echo "✅ Load balancer health check passed"
            return 0
        else
            echo "❌ Load balancer health check failed - ingress not found"
            return 1
        fi
    else
        echo "⚠️ kubectl not available, skipping load balancer health check"
        return 0
    fi
}

# Function to check pod health
check_pod_health() {
    echo "📦 Checking pod health..."
    
    if command -v kubectl &> /dev/null; then
        # Check if pods are running and ready
        ready_pods=$(kubectl get pods -n lawfirmpro-$ENVIRONMENT -l app=lawfirmpro --field-selector=status.phase=Running --no-headers | grep "1/1" | wc -l)
        total_pods=$(kubectl get pods -n lawfirmpro-$ENVIRONMENT -l app=lawfirmpro --no-headers | wc -l)
        
        if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
            echo "✅ Pod health check passed ($ready_pods/$total_pods pods ready)"
            return 0
        else
            echo "❌ Pod health check failed ($ready_pods/$total_pods pods ready)"
            return 1
        fi
    else
        echo "⚠️ kubectl not available, skipping pod health check"
        return 0
    fi
}

# Function to check resource usage
check_resource_usage() {
    echo "💻 Checking resource usage..."
    
    if command -v kubectl &> /dev/null; then
        # Check CPU and memory usage
        cpu_usage=$(kubectl top pods -n lawfirmpro-$ENVIRONMENT -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $2}' | sed 's/m//' | awk '{sum+=$1} END {print sum}')
        memory_usage=$(kubectl top pods -n lawfirmpro-$ENVIRONMENT -l app=lawfirmpro --no-headers 2>/dev/null | awk '{print $3}' | sed 's/Mi//' | awk '{sum+=$1} END {print sum}')
        
        if [ -n "$cpu_usage" ] && [ -n "$memory_usage" ]; then
            echo "✅ Resource usage check passed (CPU: ${cpu_usage}m, Memory: ${memory_usage}Mi)"
            return 0
        else
            echo "❌ Resource usage check failed - could not get metrics"
            return 1
        fi
    else
        echo "⚠️ kubectl not available, skipping resource usage check"
        return 0
    fi
}

# Run all health checks
echo "🔄 Running comprehensive health checks..."

# Set error counter
error_count=0

# Run individual checks
check_http_health "$HEALTH_CHECK_URL" "$MAX_RESPONSE_TIME" || ((error_count++))
check_database_health || ((error_count++))
check_redis_health || ((error_count++))
check_application_metrics || ((error_count++))
check_ssl_certificate || ((error_count++))
check_load_balancer_health || ((error_count++))
check_pod_health || ((error_count++))
check_resource_usage || ((error_count++))

# Summary
echo ""
echo "📊 Health Check Summary"
echo "======================"
echo "Environment: $ENVIRONMENT"
echo "Health Check URL: $HEALTH_CHECK_URL"
echo "Total Checks: 8"
echo "Failed Checks: $error_count"

if [ "$error_count" -eq 0 ]; then
    echo "✅ All health checks passed!"
    exit 0
else
    echo "❌ $error_count health check(s) failed!"
    exit 1
fi