-- ============================================================================
-- Migration 010: Enable Row-Level Security for Notification Tables
-- Description: Enable RLS policies for multi-tenancy isolation on notification tables
-- Author: CloudBill Team
-- Date: 2025-10-28
-- ============================================================================

-- ============================================================================
-- NOTIFICATION TEMPLATES - RLS
-- ============================================================================
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY notification_templates_tenant_isolation ON notification_templates
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Super admin access policy
CREATE POLICY notification_templates_super_admin_access ON notification_templates
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', TRUE)::UUID
            AND u.role = 'SUPER_ADMIN'
        )
    );

COMMENT ON POLICY notification_templates_tenant_isolation ON notification_templates IS
    'Ensures templates can only be accessed by their own tenant';
COMMENT ON POLICY notification_templates_super_admin_access ON notification_templates IS
    'Allows SUPER_ADMIN users to access templates across all tenants';

-- ============================================================================
-- NOTIFICATIONS - RLS
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY notifications_tenant_isolation ON notifications
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Super admin access policy
CREATE POLICY notifications_super_admin_access ON notifications
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', TRUE)::UUID
            AND u.role = 'SUPER_ADMIN'
        )
    );

COMMENT ON POLICY notifications_tenant_isolation ON notifications IS
    'Ensures notifications can only be accessed by their own tenant';
COMMENT ON POLICY notifications_super_admin_access ON notifications IS
    'Allows SUPER_ADMIN users to access notifications across all tenants';

-- ============================================================================
-- NOTIFICATION LOGS - RLS
-- ============================================================================
-- Note: notification_logs inherits tenant context through notifications table
-- We enforce tenant isolation through the notification_id foreign key
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Tenant isolation through parent notification
CREATE POLICY notification_logs_tenant_isolation ON notification_logs
    USING (
        EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.id = notification_logs.notification_id
            AND n.tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.id = notification_logs.notification_id
            AND n.tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        )
    );

-- Super admin access policy
CREATE POLICY notification_logs_super_admin_access ON notification_logs
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', TRUE)::UUID
            AND u.role = 'SUPER_ADMIN'
        )
    );

COMMENT ON POLICY notification_logs_tenant_isolation ON notification_logs IS
    'Ensures notification logs can only be accessed by the tenant that owns the parent notification';
COMMENT ON POLICY notification_logs_super_admin_access ON notification_logs IS
    'Allows SUPER_ADMIN users to access notification logs across all tenants';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 010 completed successfully';
    RAISE NOTICE '✓ Enabled Row-Level Security on notification_templates';
    RAISE NOTICE '✓ Enabled Row-Level Security on notifications';
    RAISE NOTICE '✓ Enabled Row-Level Security on notification_logs';
    RAISE NOTICE '✓ All notification tables now enforce tenant isolation';
END $$;
