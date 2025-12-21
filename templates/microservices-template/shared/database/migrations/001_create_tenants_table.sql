-- ============================================================================
-- Migration: 001_create_tenants_table.sql
-- Description: Create tenants table for multi-tenancy
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    plan VARCHAR(50) NOT NULL DEFAULT 'FREE',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    billing_email VARCHAR(255) NOT NULL,
    max_users INTEGER NOT NULL DEFAULT 5,
    settings JSONB DEFAULT '{}',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT tenants_plan_check CHECK (plan IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')),
    CONSTRAINT tenants_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED')),
    CONSTRAINT tenants_max_users_check CHECK (max_users > 0)
);

-- Create indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tenants
CREATE TRIGGER trigger_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE tenants IS 'Stores tenant/organization information for multi-tenancy';
COMMENT ON COLUMN tenants.slug IS 'URL-friendly unique identifier for tenant (subdomain)';
COMMENT ON COLUMN tenants.plan IS 'Subscription plan: FREE, STARTER, PROFESSIONAL, ENTERPRISE';
COMMENT ON COLUMN tenants.status IS 'Tenant status: ACTIVE, SUSPENDED, TRIAL, CANCELLED';
COMMENT ON COLUMN tenants.settings IS 'JSON object containing tenant-specific settings (currency, timezone, etc)';
