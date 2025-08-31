#!/bin/bash

# Blue-green deployment script for zero-downtime deployments
# Usage: ./deploy-blue-green.sh <environment> <image-tag> <kubeconfig>

set -e

ENVIRONMENT=$1
IMAGE_TAG=$2
KUBECONFIG=$3

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ] || [ -z "$KUBECONFIG" ]; then
    echo "Usage: $0 <environment> <image-tag> <kubeconfig>"
    exit 1
fi

echo "🔄 Starting blue-green deployment to $ENVIRONMENT environment..."
echo "📦 Image tag: $IMAGE_TAG"

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        NAMESPACE="lawfirmpro-staging"
        ;;
    "production")
        NAMESPACE="lawfirmpro-production"
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Determine current active deployment
CURRENT_COLOR=$(kubectl get ingress lawfirmpro-ingress -n $NAMESPACE -o jsonpath='{.metadata.annotations.rolling-update/active-color}' 2>/dev/null || echo "blue")
INACTIVE_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

echo "🎨 Current active color: $CURRENT_COLOR"
echo "🎨 Deploying to: $INACTIVE_COLOR"

# Create backup before deployment
echo "💾 Creating backup..."
./backup.sh $ENVIRONMENT $KUBECONFIG

# Deploy to inactive color
echo "🚀 Deploying to $INACTIVE_COLOR environment..."
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lawfirmpro-app-$INACTIVE_COLOR
  namespace: $NAMESPACE
  labels:
    app: lawfirmpro
    environment: $ENVIRONMENT
    color: $INACTIVE_COLOR
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lawfirmpro
      environment: $ENVIRONMENT
      color: $INACTIVE_COLOR
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: lawfirmpro
        environment: $ENVIRONMENT
        color: $INACTIVE_COLOR
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: lawfirmpro-app
        image: $IMAGE_TAG
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: lawfirmpro-config
        - secretRef:
            name: lawfirmpro-secrets
        resources:
          limits:
            cpu: "1000m"
            memory: "1Gi"
          requests:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
        - name: logs
          mountPath: /app/logs
        - name: temp
          mountPath: /app/temp
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: lawfirmpro-uploads-pvc
      - name: logs
        persistentVolumeClaim:
          claimName: lawfirmpro-logs-pvc
      - name: temp
        emptyDir: {}
      imagePullSecrets:
      - name: regcred
EOF

# Create service for inactive color
echo "🌐 Creating service for $INACTIVE_COLOR environment..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: lawfirmpro-service-$INACTIVE_COLOR
  namespace: $NAMESPACE
  labels:
    app: lawfirmpro
    environment: $ENVIRONMENT
    color: $INACTIVE_COLOR
spec:
  selector:
    app: lawfirmpro
    environment: $ENVIRONMENT
    color: $INACTIVE_COLOR
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  type: ClusterIP
EOF

# Wait for deployment to be ready
echo "⏳ Waiting for $INACTIVE_COLOR deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/lawfirmpro-app-$INACTIVE_COLOR -n $NAMESPACE

# Run health checks
echo "🏥 Running health checks on $INACTIVE_COLOR deployment..."
./health-check.sh $ENVIRONMENT "http://lawfirmpro-service-$INACTIVE_COLOR.$NAMESPACE.svc.cluster.local/health"

# Switch traffic to new deployment
echo "🔄 Switching traffic to $INACTIVE_COLOR deployment..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lawfirmpro-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    rolling-update/active-color: "$INACTIVE_COLOR"
spec:
  tls:
  - hosts:
    - "$ENVIRONMENT.lawfirmpro.com"
    secretName: lawfirmpro-tls
  rules:
  - host: "$ENVIRONMENT.lawfirmpro.com"
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: lawfirmpro-service-$INACTIVE_COLOR
            port:
              number: 80
EOF

# Wait for traffic switch
echo "⏳ Waiting for traffic switch..."
sleep 30

# Verify deployment
echo "🔍 Verifying deployment..."
./health-check.sh $ENVIRONMENT "https://$ENVIRONMENT.lawfirmpro.com/health"

# Scale down old deployment
echo "📉 Scaling down $CURRENT_COLOR deployment..."
kubectl scale deployment lawfirmpro-app-$CURRENT_COLOR --replicas=0 -n $NAMESPACE

# Clean up old deployment after confirmation
echo "🧹 Cleaning up old deployment..."
kubectl delete deployment lawfirmpro-app-$CURRENT_COLOR -n $NAMESPACE --ignore-not-found=true
kubectl delete service lawfirmpro-service-$CURRENT_COLOR -n $NAMESPACE --ignore-not-found=true

echo "✅ Blue-green deployment completed successfully!"
echo "🌐 Application is now running on $INACTIVE_COLOR deployment"
echo "🌐 Application available at: https://$ENVIRONMENT.lawfirmpro.com"