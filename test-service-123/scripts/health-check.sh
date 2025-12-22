#!/bin/bash

# =============================================================================
# Pre-Deployment Health Check Script
# =============================================================================
# Validates that all services are healthy before deployment
# Returns non-zero exit code if any check fails
#
# Usage:
#   ./scripts/health-check.sh <environment>
#   ./scripts/health-check.sh staging
#   ./scripts/health-check.sh production
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-staging}
NAMESPACE="production-api-${ENVIRONMENT}"

echo "==================================================================="
echo "Pre-Deployment Health Check - ${ENVIRONMENT}"
echo "==================================================================="

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# =============================================================================
# 1. Check Kubernetes Connection
# =============================================================================
echo ""
echo "1. Checking Kubernetes connection..."
if kubectl cluster-info > /dev/null 2>&1; then
    print_status 0 "Kubernetes cluster is reachable"
else
    print_status 1 "Cannot connect to Kubernetes cluster"
fi

# =============================================================================
# 2. Check Namespace Exists
# =============================================================================
echo ""
echo "2. Checking namespace..."
if kubectl get namespace ${NAMESPACE} > /dev/null 2>&1; then
    print_status 0 "Namespace ${NAMESPACE} exists"
else
    print_warning "Namespace ${NAMESPACE} does not exist (will be created)"
fi

# =============================================================================
# 3. Check Database Connectivity
# =============================================================================
echo ""
echo "3. Checking database connectivity..."
DB_SERVICE="postgres-service"

if kubectl get service ${DB_SERVICE} -n ${NAMESPACE} > /dev/null 2>&1; then
    print_status 0 "Database service ${DB_SERVICE} exists"

    # Try to create a test pod to check connectivity
    kubectl run db-test --image=postgres:15-alpine --rm -i --restart=Never \
        --namespace=${NAMESPACE} \
        --env="PGPASSWORD=\$(kubectl get secret production-api-secrets -n ${NAMESPACE} -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)" \
        -- psql -h ${DB_SERVICE} -U postgres -c "SELECT 1" > /dev/null 2>&1 && \
        print_status 0 "Database is accessible" || \
        print_warning "Database connection test failed (might not have credentials yet)"
else
    print_warning "Database service not found (expected for first deployment)"
fi

# =============================================================================
# 4. Check Redis Connectivity
# =============================================================================
echo ""
echo "4. Checking Redis connectivity..."
REDIS_SERVICE="redis-service"

if kubectl get service ${REDIS_SERVICE} -n ${NAMESPACE} > /dev/null 2>&1; then
    print_status 0 "Redis service ${REDIS_SERVICE} exists"

    # Try to ping Redis
    kubectl run redis-test --image=redis:7-alpine --rm -i --restart=Never \
        --namespace=${NAMESPACE} \
        -- redis-cli -h ${REDIS_SERVICE} ping > /dev/null 2>&1 && \
        print_status 0 "Redis is accessible" || \
        print_warning "Redis connection test failed"
else
    print_warning "Redis service not found (expected for first deployment)"
fi

# =============================================================================
# 5. Check Current Deployment Status
# =============================================================================
echo ""
echo "5. Checking current deployment status..."

DEPLOYMENT_NAME="${ENVIRONMENT}-production-api"
if kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} > /dev/null 2>&1; then
    READY_REPLICAS=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
        -o jsonpath='{.status.readyReplicas}')
    DESIRED_REPLICAS=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
        -o jsonpath='{.spec.replicas}')

    echo "   Current replicas: ${READY_REPLICAS:-0}/${DESIRED_REPLICAS:-0}"

    if [ "${READY_REPLICAS:-0}" -eq "${DESIRED_REPLICAS:-0}" ]; then
        print_status 0 "All replicas are ready"
    else
        print_warning "Not all replicas are ready"
    fi
else
    print_warning "No existing deployment found (first deployment)"
fi

# =============================================================================
# 6. Check Resource Availability
# =============================================================================
echo ""
echo "6. Checking cluster resources..."

# Check node status
NODES_READY=$(kubectl get nodes --no-headers | grep " Ready " | wc -l)
NODES_TOTAL=$(kubectl get nodes --no-headers | wc -l)

echo "   Nodes ready: ${NODES_READY}/${NODES_TOTAL}"
if [ "${NODES_READY}" -gt 0 ]; then
    print_status 0 "Cluster has ready nodes"
else
    print_status 1 "No ready nodes in cluster"
fi

# Check resource usage
echo ""
echo "   Node resource usage:"
kubectl top nodes 2>/dev/null || print_warning "Metrics server not available"

# =============================================================================
# 7. Check Secrets
# =============================================================================
echo ""
echo "7. Checking required secrets..."

REQUIRED_SECRETS=("DB_USER" "DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "JWT_REFRESH_SECRET")

if kubectl get secret production-api-secrets -n ${NAMESPACE} > /dev/null 2>&1; then
    for SECRET_KEY in "${REQUIRED_SECRETS[@]}"; do
        if kubectl get secret production-api-secrets -n ${NAMESPACE} \
            -o jsonpath="{.data.${SECRET_KEY}}" > /dev/null 2>&1; then
            echo -e "   ${GREEN}✓${NC} ${SECRET_KEY} exists"
        else
            echo -e "   ${RED}✗${NC} ${SECRET_KEY} missing"
        fi
    done
    print_status 0 "Secrets exist"
else
    print_warning "Secrets not found (will be created during deployment)"
fi

# =============================================================================
# 8. Check Ingress Controller
# =============================================================================
echo ""
echo "8. Checking Ingress controller..."

if kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx > /dev/null 2>&1; then
    INGRESS_READY=$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx \
        --field-selector=status.phase=Running --no-headers | wc -l)

    if [ "${INGRESS_READY}" -gt 0 ]; then
        print_status 0 "Ingress controller is running"
    else
        print_warning "Ingress controller not ready"
    fi
else
    print_warning "Ingress controller not found"
fi

# =============================================================================
# 9. Check cert-manager (for TLS)
# =============================================================================
echo ""
echo "9. Checking cert-manager..."

if kubectl get pods -n cert-manager -l app=cert-manager > /dev/null 2>&1; then
    CERT_MANAGER_READY=$(kubectl get pods -n cert-manager -l app=cert-manager \
        --field-selector=status.phase=Running --no-headers | wc -l)

    if [ "${CERT_MANAGER_READY}" -gt 0 ]; then
        print_status 0 "cert-manager is running"
    else
        print_warning "cert-manager not ready"
    fi
else
    print_warning "cert-manager not found (TLS certificates may not work)"
fi

# =============================================================================
# 10. Check Metrics Server (for HPA)
# =============================================================================
echo ""
echo "10. Checking metrics server..."

if kubectl get deployment metrics-server -n kube-system > /dev/null 2>&1; then
    print_status 0 "Metrics server is installed"
else
    print_warning "Metrics server not found (HPA may not work)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==================================================================="
echo -e "${GREEN}✅ Pre-deployment health check completed${NC}"
echo "==================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Namespace: ${NAMESPACE}"
echo "Cluster: $(kubectl config current-context)"
echo ""
echo "Ready to deploy!"
echo ""

exit 0
