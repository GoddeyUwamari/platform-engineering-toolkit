-- ============================================================================
-- Migration 009: Create Notification Indexes
-- Description: Performance indexes for notification tables
-- Author: CloudBill Team
-- Date: 2025-10-28
-- ============================================================================

-- ============================================================================
-- NOTIFICATION TEMPLATES INDEXES
-- ============================================================================
-- Most common: Get tenant's active templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_active
ON notification_templates(tenant_id, is_active)
WHERE is_active = true;

-- Template lookup by type and channel
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_channel
ON notification_templates(type, channel, is_active);

-- Template name lookup
CREATE INDEX IF NOT EXISTS idx_notification_templates_name
ON notification_templates(tenant_id, name);

-- Channel filtering
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel
ON notification_templates(channel)
WHERE is_active = true;

-- JSONB variables queries (if searching template variables)
CREATE INDEX IF NOT EXISTS idx_notification_templates_variables
ON notification_templates USING gin(variables);

-- ============================================================================
-- NOTIFICATIONS INDEXES
-- ============================================================================
-- Most common: Get tenant's notifications
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
ON notifications(tenant_id, created_at DESC);

-- Status filtering (for queued/pending notifications)
CREATE INDEX IF NOT EXISTS idx_notifications_status
ON notifications(status, created_at DESC);

-- Pending notifications for processing
CREATE INDEX IF NOT EXISTS idx_notifications_pending
ON notifications(status, created_at)
WHERE status IN ('pending', 'queued');

-- Failed notifications for retry
CREATE INDEX IF NOT EXISTS idx_notifications_failed
ON notifications(status, created_at)
WHERE status = 'failed';

-- Channel filtering
CREATE INDEX IF NOT EXISTS idx_notifications_channel
ON notifications(channel, created_at DESC);

-- Type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type
ON notifications(type, tenant_id);

-- Template usage tracking
CREATE INDEX IF NOT EXISTS idx_notifications_template
ON notifications(template_id)
WHERE template_id IS NOT NULL;

-- Recipient lookup (for notification history)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
ON notifications(recipient, tenant_id, created_at DESC);

-- Sent date for analytics
CREATE INDEX IF NOT EXISTS idx_notifications_sent
ON notifications(sent_at DESC)
WHERE sent_at IS NOT NULL;

-- JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata
ON notifications USING gin(metadata);

-- ============================================================================
-- NOTIFICATION LOGS INDEXES
-- ============================================================================
-- Get logs for a specific notification
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification
ON notification_logs(notification_id, created_at DESC);

-- Status filtering for delivery tracking
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
ON notification_logs(status, created_at DESC);

-- Failed deliveries for monitoring
CREATE INDEX IF NOT EXISTS idx_notification_logs_failed
ON notification_logs(status, created_at)
WHERE status = 'failed';

-- Delivery tracking (sent, delivered, bounced)
CREATE INDEX IF NOT EXISTS idx_notification_logs_delivery
ON notification_logs(status, created_at)
WHERE status IN ('sent', 'delivered', 'bounced');

-- Provider filtering for analytics
CREATE INDEX IF NOT EXISTS idx_notification_logs_provider
ON notification_logs(provider, created_at DESC)
WHERE provider IS NOT NULL;

-- Provider message ID lookup
CREATE INDEX IF NOT EXISTS idx_notification_logs_provider_message
ON notification_logs(provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- Retry attempts tracking
CREATE INDEX IF NOT EXISTS idx_notification_logs_attempts
ON notification_logs(attempts, status);

-- JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_metadata
ON notification_logs USING gin(metadata);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Dashboard query: Tenant's recent notifications by status
CREATE INDEX IF NOT EXISTS idx_notifications_dashboard
ON notifications(tenant_id, status, created_at DESC);

-- Notification processing: Pending notifications by channel
CREATE INDEX IF NOT EXISTS idx_notifications_processing
ON notifications(channel, status, created_at)
WHERE status IN ('pending', 'queued');

-- Analytics: Notification delivery success rate by type
CREATE INDEX IF NOT EXISTS idx_notifications_analytics
ON notifications(type, status, sent_at);

-- Template usage analytics
CREATE INDEX IF NOT EXISTS idx_notifications_template_usage
ON notifications(template_id, status, created_at)
WHERE template_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX idx_notifications_tenant_created IS 'Fast lookup of tenant notifications ordered by creation date';
COMMENT ON INDEX idx_notifications_pending IS 'Optimized for notification queue processing';
COMMENT ON INDEX idx_notification_logs_notification IS 'Quick access to delivery logs for a notification';
COMMENT ON INDEX idx_notifications_processing IS 'Efficient querying of pending notifications by channel';

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================
ANALYZE notification_templates;
ANALYZE notifications;
ANALYZE notification_logs;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 009 completed successfully';
    RAISE NOTICE '✓ Created performance indexes for all notification tables';
    RAISE NOTICE '✓ Tables analyzed for query optimization';
END $$;
