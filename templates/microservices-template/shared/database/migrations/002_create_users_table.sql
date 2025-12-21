
-- ============================================================================
-- Migration: 002_create_users_table.sql
-- Description: Create users table with authentication support
-- ============================================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    tenant_id UUID NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT users_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'BILLING_ADMIN', 'USER', 'VIEWER')),
    CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING')),
    CONSTRAINT users_email_length_check CHECK (LENGTH(email) >= 3),
    
    -- Unique constraint: email must be unique per tenant
    CONSTRAINT users_email_tenant_unique UNIQUE (email, tenant_id)
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Create trigger for users
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE users IS 'Stores user accounts with authentication and authorization';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (null for OAuth-only users)';
COMMENT ON COLUMN users.role IS 'User role for RBAC: SUPER_ADMIN, ADMIN, BILLING_ADMIN, USER, VIEWER';
COMMENT ON COLUMN users.status IS 'User account status: ACTIVE, INACTIVE, SUSPENDED, PENDING';
COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';