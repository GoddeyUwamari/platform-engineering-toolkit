-- ============================================================================
-- Migration: 003_enable_row_level_security.sql
-- Description: Enable Row-Level Security (RLS) for multi-tenancy isolation
-- ============================================================================

-- Enable Row-Level Security on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users
-- Users can only see and modify data within their own tenant
CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Create policy for SUPER_ADMIN to access all tenants
-- This policy allows super admins to bypass tenant isolation
CREATE POLICY users_super_admin_access ON users
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', TRUE)::UUID
            AND u.role = 'SUPER_ADMIN'
        )
    );

-- Add comments
COMMENT ON POLICY users_tenant_isolation ON users IS 
    'Ensures users can only access data from their own tenant';
COMMENT ON POLICY users_super_admin_access ON users IS 
    'Allows SUPER_ADMIN users to access data across all tenants';

-- Note: To set tenant context in application code, use:
-- SELECT set_config('app.current_tenant_id', '<tenant_id>', false);
-- SELECT set_config('app.current_user_id', '<user_id>', false);