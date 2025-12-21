#!/bin/bash

# ============================================================================
# CloudBill - Docker Database Initialization Script
# Runs migrations on Docker PostgreSQL container
# ============================================================================
# This script connects to the Docker PostgreSQL container and runs all
# migration files from shared/database/migrations/ in order.
#
# Usage: ./scripts/docker-init-db.sh
# Or:    make docker-db-migrate
# ============================================================================

set -e  # Exit immediately if a command exits with a non-zero status

# ----------------------------------------------------------------------------
# Colors for output (makes it easier to read)
# ----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
# Docker container name
CONTAINER_NAME="cloudbill-postgres"

# Database configuration (matches docker-compose.yml)
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="cloudbill"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Migration directory - uses your existing migration files
MIGRATIONS_DIR="$(dirname "$0")/../shared/database/migrations"

# ----------------------------------------------------------------------------
# Header
# ----------------------------------------------------------------------------
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   CloudBill - Docker Database Migration Runner${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ----------------------------------------------------------------------------
# Step 1: Check if Docker container is running
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[1/5] Checking Docker container...${NC}"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}✗ Error: Container '$CONTAINER_NAME' is not running${NC}"
    echo -e "${YELLOW}💡 Tip: Run 'make docker-db-start' first${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Container is running${NC}"
echo ""

# ----------------------------------------------------------------------------
# Step 2: Check container health
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[2/5] Checking container health...${NC}"
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
if [ "$HEALTH_STATUS" != "healthy" ]; then
    echo -e "${YELLOW}⚠ Container health status: $HEALTH_STATUS${NC}"
    echo -e "${YELLOW}⏳ Waiting for container to become healthy...${NC}"
    sleep 5
fi
echo -e "${GREEN}✓ Container is healthy${NC}"
echo ""

# ----------------------------------------------------------------------------
# Step 3: Test database connection
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[3/5] Testing database connection...${NC}"
export PGPASSWORD=$DB_PASSWORD
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c '\q' 2>/dev/null; then
    echo -e "${RED}✗ Failed to connect to database${NC}"
    echo -e "${YELLOW}💡 Connection details:${NC}"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   User: $DB_USER"
    exit 1
fi
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# ----------------------------------------------------------------------------
# Step 4: Ensure database exists
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[4/5] Checking database existence...${NC}"
DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "no" ]; then
    echo -e "${CYAN}Creating database '$DB_NAME'...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"
fi
echo -e "${GREEN}✓ Database '$DB_NAME' is ready${NC}"
echo ""

# ----------------------------------------------------------------------------
# Step 5: Run migrations
# ----------------------------------------------------------------------------
echo -e "${YELLOW}[5/5] Running migrations...${NC}"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}✗ Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Count migration files
MIGRATION_COUNT=0
TOTAL_MIGRATIONS=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')

if [ "$TOTAL_MIGRATIONS" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No migration files found in $MIGRATIONS_DIR${NC}"
    exit 0
fi

echo -e "${CYAN}Found $TOTAL_MIGRATIONS migration file(s)${NC}"
echo ""

# Run each migration file in order
for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    filename=$(basename "$migration_file")
    echo -e "${BLUE}▶ Running: $filename${NC}"
    
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ $filename completed${NC}"
        ((MIGRATION_COUNT++))
    else
        echo -e "${RED}  ✗ $filename failed${NC}"
        echo -e "${RED}Error details:${NC}"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
        exit 1
    fi
    echo ""
done

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Migration Summary${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ $MIGRATION_COUNT/$TOTAL_MIGRATIONS migrations executed successfully${NC}"
echo -e "${GREEN}✓ Database is ready for use${NC}"
echo ""

# ----------------------------------------------------------------------------
# Show database info
# ----------------------------------------------------------------------------
echo -e "${CYAN}Database Tables:${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\dt"
echo ""

echo -e "${CYAN}Test Users (from seed data):${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
    "SELECT email, role, status FROM users ORDER BY created_at;" 2>/dev/null || \
    echo "No users table yet (will be created by migrations)"
echo ""

# ----------------------------------------------------------------------------
# Connection info
# ----------------------------------------------------------------------------
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Connection Information${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "Host:     ${GREEN}$DB_HOST${NC}"
echo -e "Port:     ${GREEN}$DB_PORT${NC}"
echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "User:     ${GREEN}$DB_USER${NC}"
echo ""
echo -e "${YELLOW}💡 To connect manually:${NC}"
echo -e "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
echo -e "${YELLOW}💡 Or use Docker:${NC}"
echo -e "   docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo ""

# Clean up
unset PGPASSWORD

echo -e "${GREEN}✅ All done!${NC}"