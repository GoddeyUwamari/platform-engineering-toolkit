#!/bin/bash

# =============================================================================
# Emergency Rollback Script
# =============================================================================
# Rolls back to the previous deployment version
# Can be used manually or automatically in CI/CD
#
# Usage:
#   ./scripts/rollback.sh <environment>
#   ./scripts/rollback.sh staging
#   ./scripts/rollback.sh production
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-staging}
NAMESPACE="production-api-${ENVIRONMENT}"
DEPLOYMENT_NAME="${ENVIRONMENT}-production-api"

echo "==================================================================="
echo "Emergency Rollback"
echo "==================================================================="
echo "Environment: ${ENVIRONMENT}"
echo "Namespace: ${NAMESPACE}"
echo "Deployment: ${DEPLOYMENT_NAME}"
echo ""

# Confirmation prompt (skip if running in CI)
if [ -z "$CI" ]; then
    read -p "Are you sure you want to rollback ${ENVIRONMENT}? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
fi

# =============================================================================
# 1. Check Current Status
# =============================================================================
echo ""
echo -e "${BLUE}1. Checking current deployment status${NC}"
echo "-------------------------------------------------------------------"

if ! kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} > /dev/null 2>&1; then
    echo -e "${RED}❌ Deployment not found${NC}"
    exit 1
fi

CURRENT_REVISION=$(kubectl rollout history deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} \
    | tail -n 1 | awk '{print $1}')
echo -e "${GREEN}✓${NC} Current revision: ${CURRENT_REVISION}"

# =============================================================================
# 2. Check Rollout History
# =============================================================================
echo ""
echo -e "${BLUE}2. Checking rollout history${NC}"
echo "-------------------------------------------------------------------"

echo "Rollout history:"
kubectl rollout history deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}

HISTORY_COUNT=$(kubectl rollout history deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} \
    | tail -n +2 | wc -l)

if [ "$HISTORY_COUNT" -lt 2 ]; then
    echo -e "${RED}❌ No previous revision to rollback to${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Previous revisions available"

# =============================================================================
# 3. Backup Current State
# =============================================================================
echo ""
echo -e "${BLUE}3. Backing up current deployment state${NC}"
echo "-------------------------------------------------------------------"

BACKUP_DIR="/tmp/rollback-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p ${BACKUP_DIR}

kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} -o yaml \
    > ${BACKUP_DIR}/deployment.yaml

kubectl get pods -n ${NAMESPACE} -o yaml \
    > ${BACKUP_DIR}/pods.yaml

echo -e "${GREEN}✓${NC} Backup saved to: ${BACKUP_DIR}"

# =============================================================================
# 4. Perform Rollback
# =============================================================================
echo ""
echo -e "${BLUE}4. Initiating rollback${NC}"
echo "-------------------------------------------------------------------"

echo -e "${YELLOW}⚠️  Rolling back deployment...${NC}"

kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}

echo -e "${GREEN}✓${NC} Rollback initiated"

# =============================================================================
# 5. Wait for Rollback to Complete
# =============================================================================
echo ""
echo -e "${BLUE}5. Waiting for rollback to complete${NC}"
echo "-------------------------------------------------------------------"

echo "Monitoring rollback progress..."

if kubectl rollout status deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} --timeout=5m; then
    echo -e "${GREEN}✓${NC} Rollback completed successfully"
else
    echo -e "${RED}❌ Rollback failed or timed out${NC}"
    exit 1
fi

# =============================================================================
# 6. Verify Rollback
# =============================================================================
echo ""
echo -e "${BLUE}6. Verifying rollback${NC}"
echo "-------------------------------------------------------------------"

# Wait a bit for pods to stabilize
sleep 10

READY_REPLICAS=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
    -o jsonpath='{.status.readyReplicas}')
DESIRED_REPLICAS=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${NAMESPACE} \
    -o jsonpath='{.spec.replicas}')

echo "Ready replicas: ${READY_REPLICAS}/${DESIRED_REPLICAS}"

if [ "${READY_REPLICAS}" == "${DESIRED_REPLICAS}" ]; then
    echo -e "${GREEN}✓${NC} All replicas are ready"
else
    echo -e "${YELLOW}⚠️  Not all replicas are ready yet${NC}"
fi

# Check pod status
echo ""
echo "Pod status:"
kubectl get pods -n ${NAMESPACE} -l app=production-api

# =============================================================================
# 7. Run Smoke Tests
# =============================================================================
echo ""
echo -e "${BLUE}7. Running smoke tests${NC}"
echo "-------------------------------------------------------------------"

# Get ingress URL
if [ "${ENVIRONMENT}" == "production" ]; then
    BASE_URL="https://api.yourdomain.com"
else
    BASE_URL="https://staging-api.yourdomain.com"
fi

echo "Testing: ${BASE_URL}"

# Simple health check
if curl -s -f ${BASE_URL}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Health check passed"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Rollback may have failed. Please investigate manually."
    exit 1
fi

# Readiness check
if curl -s -f ${BASE_URL}/ready > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Readiness check passed"
else
    echo -e "${RED}❌ Readiness check failed${NC}"
    echo "Services may not be fully ready. Please investigate."
fi

# =============================================================================
# 8. Get New Revision Info
# =============================================================================
echo ""
echo -e "${BLUE}8. New deployment info${NC}"
echo "-------------------------------------------------------------------"

NEW_REVISION=$(kubectl rollout history deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} \
    | tail -n 1 | awk '{print $1}')

echo "Previous revision: ${CURRENT_REVISION}"
echo "Current revision: ${NEW_REVISION}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==================================================================="
echo -e "${GREEN}✅ ROLLBACK COMPLETED SUCCESSFULLY${NC}"
echo "==================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Namespace: ${NAMESPACE}"
echo "Deployment: ${DEPLOYMENT_NAME}"
echo "Rolled back from revision ${CURRENT_REVISION} to ${NEW_REVISION}"
echo "Backup location: ${BACKUP_DIR}"
echo ""
echo "Next steps:"
echo "1. Monitor application logs:"
echo "   kubectl logs -f -n ${NAMESPACE} -l app=production-api"
echo ""
echo "2. Check metrics and errors"
echo ""
echo "3. Investigate the cause of the issue that required rollback"
echo ""
echo "4. If issue persists, consider rolling back again:"
echo "   ./scripts/rollback.sh ${ENVIRONMENT}"
echo ""

exit 0
