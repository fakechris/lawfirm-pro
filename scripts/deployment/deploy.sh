#!/bin/bash

# Deployment script for Law Firm Pro
# Usage: ./deploy.sh <environment> <image-tag> <kubeconfig>

set -e

ENVIRONMENT=$1
IMAGE_TAG=$2
KUBECONFIG=$3

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ] || [ -z "$KUBECONFIG" ]; then
    echo "Usage: $0 <environment> <image-tag> <kubeconfig>"
    exit 1
fi

echo "🚀 Starting deployment to $ENVIRONMENT environment..."
echo "📦 Image tag: $IMAGE_TAG"

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        NAMESPACE="lawfirmpro-staging"
        REPLICA_COUNT=1
        RESOURCE_LIMITS_CPU="500m"
        RESOURCE_LIMITS_MEMORY="512Mi"
        ;;
    "production")
        NAMESPACE="lawfirmpro-production"
        REPLICA_COUNT=3
        RESOURCE_LIMITS_CPU="1000m"
        RESOURCE_LIMITS_MEMORY="1Gi"
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Create namespace if it doesn't exist
echo "📋 Creating namespace: $NAMESPACE"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create configmap
echo "⚙️ Creating configmap..."
kubectl create configmap lawfirmpro-config \
    --from-env-file=../config/$ENVIRONMENT.env \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

# Create secret
echo "🔐 Creating secret..."
kubectl create secret generic lawfirmpro-secrets \
    --from-env-file=../secrets/$ENVIRONMENT.env \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

# Deploy application
echo "🎯 Deploying application..."
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lawfirmpro-app
  namespace: $NAMESPACE
  labels:
    app: lawfirmpro
    environment: $ENVIRONMENT
spec:
  replicas: $REPLICA_COUNT
  selector:
    matchLabels:
      app: lawfirmpro
      environment: $ENVIRONMENT
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
            cpu: $RESOURCE_LIMITS_CPU
            memory: $RESOURCE_LIMITS_MEMORY
          requests:
            cpu: $(echo $RESOURCE_LIMITS_CPU | sed 's/m//g' | awk '{print $1/2"m"}')
            memory: $(echo $RESOURCE_LIMITS_MEMORY | sed 's/Mi//g' | awk '{print $1/2"Mi"}')
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

# Create service
echo "🌐 Creating service..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: lawfirmpro-service
  namespace: $NAMESPACE
  labels:
    app: lawfirmpro
    environment: $ENVIRONMENT
spec:
  selector:
    app: lawfirmpro
    environment: $ENVIRONMENT
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  type: ClusterIP
EOF

# Create ingress
echo "🌍 Creating ingress..."
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
            name: lawfirmpro-service
            port:
              number: 80
EOF

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/lawfirmpro-app -n $NAMESPACE

# Get deployment status
echo "📊 Deployment status:"
kubectl get pods -n $NAMESPACE -l app=lawfirmpro

echo "✅ Deployment completed successfully!"
echo "🌐 Application will be available at: https://$ENVIRONMENT.lawfirmpro.com"