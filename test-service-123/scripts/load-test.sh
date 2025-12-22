#!/bin/bash

# =============================================================================
# Load Testing Script
# =============================================================================
# Simple load test using Apache Bench (ab) or curl
# Tests the application's performance under load
#
# Usage:
#   ./scripts/load-test.sh <base_url> <requests> <concurrency>
#   ./scripts/load-test.sh https://staging-api.yourdomain.com 1000 10
#   ./scripts/load-test.sh https://api.yourdomain.com 10000 100
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL=${1:-http://localhost:3000}
TOTAL_REQUESTS=${2:-1000}
CONCURRENCY=${3:-10}

echo "==================================================================="
echo "Load Testing"
echo "==================================================================="
echo "Base URL: ${BASE_URL}"
echo "Total Requests: ${TOTAL_REQUESTS}"
echo "Concurrency: ${CONCURRENCY}"
echo ""

# Check if ab (Apache Bench) is available
if command -v ab > /dev/null 2>&1; then
    USE_AB=true
    echo "Tool: Apache Bench (ab)"
else
    USE_AB=false
    echo "Tool: curl (fallback)"
    echo -e "${YELLOW}⚠️  Apache Bench not found. Install with: brew install httpd (macOS) or apt-get install apache2-utils (Linux)${NC}"
fi

echo ""

# =============================================================================
# 1. Baseline Test
# =============================================================================
echo ""
echo -e "${BLUE}1. Baseline Response Time Test${NC}"
echo "-------------------------------------------------------------------"

echo "Measuring baseline response time (single request)..."

start_time=$(date +%s%N)
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
end_time=$(date +%s%N)

response_time=$(( (end_time - start_time) / 1000000 ))

if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓${NC} Baseline response time: ${response_time}ms"
else
    echo -e "${RED}❌ Baseline test failed (status: ${response})${NC}"
    exit 1
fi

# =============================================================================
# 2. Health Endpoint Load Test
# =============================================================================
echo ""
echo -e "${BLUE}2. Health Endpoint Load Test${NC}"
echo "-------------------------------------------------------------------"

if [ "$USE_AB" == true ]; then
    echo "Running load test with Apache Bench..."
    ab -n ${TOTAL_REQUESTS} -c ${CONCURRENCY} -q "${BASE_URL}/health"
else
    echo "Running load test with curl..."
    echo "Progress:"

    start_time=$(date +%s)
    success_count=0
    error_count=0

    for ((i=1; i<=${TOTAL_REQUESTS}; i++)); do
        if [ $((i % CONCURRENCY)) -eq 0 ]; then
            wait
        fi

        (
            response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
            if [ "$response" == "200" ]; then
                echo "success"
            else
                echo "error"
            fi
        ) &

        if [ $((i % 100)) -eq 0 ]; then
            echo -n "."
        fi
    done

    wait
    end_time=$(date +%s)

    total_time=$((end_time - start_time))
    requests_per_second=$((TOTAL_REQUESTS / total_time))

    echo ""
    echo ""
    echo "Results:"
    echo "  Total requests: ${TOTAL_REQUESTS}"
    echo "  Total time: ${total_time}s"
    echo "  Requests per second: ${requests_per_second}"
fi

# =============================================================================
# 3. API Endpoint Load Test
# =============================================================================
echo ""
echo -e "${BLUE}3. API Endpoint Load Test${NC}"
echo "-------------------------------------------------------------------"

if [ "$USE_AB" == true ]; then
    echo "Testing /api/v1 endpoint..."
    ab -n $((TOTAL_REQUESTS / 2)) -c ${CONCURRENCY} -q "${BASE_URL}/api/v1"
else
    echo "Testing /api/v1 endpoint with curl..."

    success_count=0
    for i in {1..50}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1")
        if [ "$response" == "200" ]; then
            success_count=$((success_count + 1))
        fi
        if [ $((i % 10)) -eq 0 ]; then
            echo -n "."
        fi
    done

    echo ""
    success_rate=$((success_count * 100 / 50))
    echo "Success rate: ${success_rate}%"
fi

# =============================================================================
# 4. Mixed Endpoint Test
# =============================================================================
echo ""
echo -e "${BLUE}4. Mixed Endpoint Load Test${NC}"
echo "-------------------------------------------------------------------"

echo "Testing multiple endpoints simultaneously..."

endpoints=(
    "/health"
    "/ready"
    "/api/v1"
)

for endpoint in "${endpoints[@]}"; do
    echo "  Testing: ${endpoint}"

    if [ "$USE_AB" == true ]; then
        ab -n $((TOTAL_REQUESTS / 10)) -c ${CONCURRENCY} -q "${BASE_URL}${endpoint}" | grep "Requests per second"
    else
        for i in {1..20}; do
            curl -s -o /dev/null "${BASE_URL}${endpoint}" &
        done
        wait
        echo "    ✓ Completed 20 concurrent requests"
    fi
done

# =============================================================================
# 5. Sustained Load Test
# =============================================================================
echo ""
echo -e "${BLUE}5. Sustained Load Test (30 seconds)${NC}"
echo "-------------------------------------------------------------------"

echo "Applying sustained load for 30 seconds..."

if [ "$USE_AB" == true ]; then
    ab -t 30 -c ${CONCURRENCY} -q "${BASE_URL}/health"
else
    end_time=$(($(date +%s) + 30))
    request_count=0

    while [ $(date +%s) -lt $end_time ]; do
        for i in $(seq 1 ${CONCURRENCY}); do
            curl -s -o /dev/null "${BASE_URL}/health" &
            request_count=$((request_count + 1))
        done
        wait
        echo -n "."
    done

    echo ""
    echo "Total requests sent: ${request_count}"
fi

# =============================================================================
# 6. Check Health After Load
# =============================================================================
echo ""
echo -e "${BLUE}6. Post-Load Health Check${NC}"
echo "-------------------------------------------------------------------"

sleep 5

echo "Checking health after load test..."

response=$(curl -s "${BASE_URL}/ready")

if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Application is healthy after load test"
else
    echo -e "${RED}❌ Application may be degraded after load test${NC}"
    echo "Response: ${response}"
fi

# =============================================================================
# 7. Performance Recommendations
# =============================================================================
echo ""
echo -e "${BLUE}7. Recommendations${NC}"
echo "-------------------------------------------------------------------"

echo ""
echo "Based on the load test results:"
echo ""
echo "For more comprehensive load testing, consider using:"
echo "  • k6 (https://k6.io/)"
echo "  • Artillery (https://artillery.io/)"
echo "  • Gatling (https://gatling.io/)"
echo "  • JMeter (https://jmeter.apache.org/)"
echo ""
echo "Monitor these metrics during load testing:"
echo "  • Response times (p50, p95, p99)"
echo "  • Error rates"
echo "  • CPU and memory usage"
echo "  • Database connection pool"
echo "  • Cache hit rates"
echo ""

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "==================================================================="
echo -e "${GREEN}✅ LOAD TEST COMPLETED${NC}"
echo "==================================================================="
echo ""
echo "Check your monitoring dashboards for detailed metrics"
echo ""

exit 0
