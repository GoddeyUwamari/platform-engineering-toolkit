#!/bin/bash

# ============================================================================
# Database Migration Runner Script
# Runs all SQL migration files in order
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database configuration from environment or defaults
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-cloudbill}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Migration directory - UPDATED for your structure
MIGRATIONS_DIR="$(dirname "$0")/../shared/database/migrations"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}CloudBill Database Migration Runner${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

echo -e "${YELLOW}Database Connection:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is accessible
echo -e "${YELLOW}Checking database connection...${NC}"
export PGPASSWORD=$DB_PASSWORD
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Failed to connect to database${NC}"
    echo -e "${RED}Please check your database configuration${NC}"
    exit 1
fi

# Create database if it doesn't exist
echo ""
echo -e "${YELLOW}Creating database if not exists...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database '$DB_NAME' ready${NC}"
else
    echo -e "${RED}✗ Failed to create database${NC}"
    exit 1
fi

# Run migrations
echo ""
echo -e "${YELLOW}Running migrations...${NC}"
echo ""

MIGRATION_COUNT=0
for migration_file in $(ls -1 $MIGRATIONS_DIR/*.sql | sort); do
    filename=$(basename "$migration_file")
    echo -e "${BLUE}Running: $filename${NC}"
    
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"; then
        echo -e "${GREEN}✓ $filename completed${NC}"
        ((MIGRATION_COUNT++))
    else
        echo -e "${RED}✗ $filename failed${NC}"
        exit 1
    fi
    echo ""
done

# Summary
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Migration Summary${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ $MIGRATION_COUNT migrations executed successfully${NC}"
echo -e "${GREEN}✓ Database is ready for use${NC}"
echo ""

# Show table info
echo -e "${YELLOW}Database Tables:${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\dt"

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Test Credentials (Seed Data):${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "Email: ${GREEN}admin@democompany.com${NC}"
echo -e "Password: ${GREEN}Admin123!${NC}"
echo -e "Role: ${GREEN}SUPER_ADMIN${NC}"
echo ""
echo -e "Email: ${GREEN}user@democompany.com${NC}"
echo -e "Password: ${GREEN}User123!${NC}"
echo -e "Role: ${GREEN}USER${NC}"
echo ""

unset PGPASSWORD