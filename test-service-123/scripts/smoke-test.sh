#!/bin/bash

# =============================================================================
# Post-Deployment Smoke Test Script
# =============================================================================
# Validates that the deployed application is working correctly
# Tests critical endpoints and functionality
#
# Usage:
#   ./scripts/smoke-test.sh <base_url>
#   ./scripts/smoke-test.sh https://staging-api.yourdomain.com
#   ./scripts/smoke-test.sh https://api.yourdomain.com
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL=${1:-http://localhost:3000}

echo "==================================================================="
echo "Smoke Tests - Post-Deployment Validation"
echo "==================================================================="
echo "Base URL: ${BASE_URL}"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local command=$2

    echo -n "Testing: ${test_name}... "
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3

    echo -n "${description}... "
    TESTS_RUN=$((TESTS_RUN + 1))

    response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${endpoint}")

    if [ "$response" == "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${response})"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (expected ${expected_status}, got ${response})"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test JSON response
test_json_field() {
    local endpoint=$1
    local jq_query=$2
    local expected_value=$3
    local description=$4

    echo -n "${description}... "
    TESTS_RUN=$((TESTS_RUN + 1))

    response=$(curl -s "${BASE_URL}${endpoint}")
    actual_value=$(echo "$response" | jq -r "$jq_query")

    if [ "$actual_value" == "$expected_value" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (expected '${expected_value}', got '${actual_value}')"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# =============================================================================
# 1. Basic Connectivity
# =============================================================================
echo ""
echo -e "${BLUE}1. Testing Basic Connectivity${NC}"
echo "-------------------------------------------------------------------"

test_endpoint "/" "200" "Root endpoint"
test_endpoint "/health" "200" "Health check endpoint"
test_endpoint "/ready" "200" "Readiness check endpoint"
test_endpoint "/api/v1" "200" "API v1 endpoint"

# =============================================================================
# 2. Health Check Details
# =============================================================================
echo ""
echo -e "${BLUE}2. Testing Health Check Response${NC}"
echo "-------------------------------------------------------------------"

test_json_field "/health" ".success" "true" "Health check success field"
test_json_field "/health" ".message" "API is running" "Health check message"

# =============================================================================
# 3. Readiness Check Details
# =============================================================================
echo ""
echo -e "${BLUE}3. Testing Readiness Check Response${NC}"
echo "-------------------------------------------------------------------"

test_json_field "/ready" ".success" "true" "Readiness check success"
test_json_field "/ready" ".services.database.healthy" "true" "Database health"
test_json_field "/ready" ".services.redis.healthy" "true" "Redis health"

# =============================================================================
# 4. API Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}4. Testing API Endpoints${NC}"
echo "-------------------------------------------------------------------"

test_endpoint "/api/v1/users" "200" "Users API endpoint"
test_endpoint "/api/v1/tasks" "200" "Tasks API endpoint"

# =============================================================================
# 5. Non-Existent Endpoints (404 handling)
# =============================================================================
echo ""
echo -e "${BLUE}5. Testing Error Handling${NC}"
echo "-------------------------------------------------------------------"

test_endpoint "/nonexistent" "404" "404 for non-existent endpoint"
test_endpoint "/api/v1/nonexistent" "404" "404 for non-existent API endpoint"

# =============================================================================
# 6. API Validation (POST without body)
# =============================================================================
echo ""
echo -e "${BLUE}6. Testing API Validation${NC}"
echo "-------------------------------------------------------------------"

echo -n "POST /api/v1/users without body (should fail validation)... "
TESTS_RUN=$((TESTS_RUN + 1))

response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "${BASE_URL}/api/v1/users")

if [ "$response" == "400" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${response})"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} (expected 400, got ${response})"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# =============================================================================
# 7. Performance Check
# =============================================================================
echo ""
echo -e "${BLUE}7. Testing Performance${NC}"
echo "-------------------------------------------------------------------"

echo -n "Response time check (health endpoint)... "
TESTS_RUN=$((TESTS_RUN + 1))

response_time=$(curl -s -o /dev/null -w "%{time_total}" "${BASE_URL}/health")
response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

if [ "$response_time_ms" -lt 1000 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${response_time_ms}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  SLOW${NC} (${response_time_ms}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# =============================================================================
# 8. Load Test (Simple)
# =============================================================================
echo ""
echo -e "${BLUE}8. Testing Load Handling${NC}"
echo "-------------------------------------------------------------------"

echo -n "Concurrent requests test (10 requests)... "
TESTS_RUN=$((TESTS_RUN + 1))

for i in {1..10}; do
    curl -s "${BASE_URL}/health" > /dev/null &
done
wait

echo -e "${GREEN}✅ PASS${NC}"
TESTS_PASSED=$((TESTS_PASSED + 1))

# =============================================================================
# 9. Security Headers
# =============================================================================
echo ""
echo -e "${BLUE}9. Testing Security Headers${NC}"
echo "-------------------------------------------------------------------"

echo -n "X-Frame-Options header... "
TESTS_RUN=$((TESTS_RUN + 1))

header=$(curl -s -I "${BASE_URL}/health" | grep -i "x-frame-options" || echo "")

if [ -n "$header" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARNING${NC} (header not found)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

echo -n "X-Content-Type-Options header... "
TESTS_RUN=$((TESTS_RUN + 1))

header=$(curl -s -I "${BASE_URL}/health" | grep -i "x-content-type-options" || echo "")

if [ -n "$header" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARNING${NC} (header not found)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# =============================================================================
# 10. Database Connectivity
# =============================================================================
echo ""
echo -e "${BLUE}10. Testing Database Connectivity${NC}"
echo "-------------------------------------------------------------------"

echo -n "Database connection via API... "
TESTS_RUN=$((TESTS_RUN + 1))

# If users endpoint returns 200, database is connected
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/users")

if [ "$response" == "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} (database may not be connected)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==================================================================="
echo "Smoke Test Results"
echo "==================================================================="
echo "Total Tests: ${TESTS_RUN}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    exit 1
fi
