-- ============================================================================
-- Migration: 004_seed_initial_data.sql
-- Description: Insert seed data for testing (optional)
-- ============================================================================

-- Insert a default test tenant
INSERT INTO tenants (
    id,
    name,
    slug,
    plan,
    status,
    billing_email,
    max_users,
    settings,
    trial_ends_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Company',
    'demo',
    'PROFESSIONAL',
    'ACTIVE',
    'admin@democompany.com',
    50,
    '{
        "currency": "USD",
        "timezone": "America/New_York",
        "dateFormat": "MM/DD/YYYY",
        "primaryColor": "#1e40af"
    }'::jsonb,
    NULL
) ON CONFLICT (id) DO NOTHING;

-- Insert a super admin user
-- Password: Admin123! (hashed with bcrypt, salt rounds = 12)
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    tenant_id,
    email_verified,
    last_login_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@democompany.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lW6XcHVVqUPa',
    'Admin',
    'User',
    'SUPER_ADMIN',
    'ACTIVE',
    '00000000-0000-0000-0000-000000000001',
    TRUE,
    NOW()
) ON CONFLICT (email, tenant_id) DO NOTHING;

-- Insert a regular user for testing
-- Password: User123!
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    tenant_id,
    email_verified,
    last_login_at
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'user@democompany.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lW6XcHVVqUPa',
    'Test',
    'User',
    'USER',
    'ACTIVE',
    '00000000-0000-0000-0000-000000000001',
    TRUE,
    NULL
) ON CONFLICT (email, tenant_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE tenants IS 'Seed data includes Demo Company tenant for testing';
COMMENT ON TABLE users IS 'Seed data includes admin@democompany.com (password: Admin123!) for testing';