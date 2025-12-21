-- ============================================================================
-- Migration 008: Create Notification Tables
-- Description: Core notification tables for email, SMS, webhook notifications,
--              templates, and delivery logs
-- Author: CloudBill Team
-- Date: 2025-10-28
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATION TEMPLATES TABLE
-- Defines reusable templates for notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_template_type CHECK (type IN ('invoice_created', 'invoice_paid', 'payment_failed', 'subscription_created', 'subscription_cancelled', 'subscription_renewed', 'trial_ending', 'custom')),
    CONSTRAINT valid_template_channel CHECK (channel IN ('email', 'sms', 'webhook', 'push')),
    CONSTRAINT unique_tenant_template_name UNIQUE (tenant_id, name)
);

-- ============================================================================
-- 2. NOTIFICATIONS TABLE
-- Individual notification records for each delivery
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(500) NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_notification_type CHECK (type IN ('invoice_created', 'invoice_paid', 'payment_failed', 'subscription_created', 'subscription_cancelled', 'subscription_renewed', 'trial_ending', 'custom')),
    CONSTRAINT valid_notification_channel CHECK (channel IN ('email', 'sms', 'webhook', 'push')),
    CONSTRAINT valid_notification_status CHECK (status IN ('pending', 'sent', 'failed', 'queued', 'cancelled'))
);

-- ============================================================================
-- 3. NOTIFICATION LOGS TABLE
-- Detailed delivery logs with retry tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    provider VARCHAR(100),
    provider_message_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_log_status CHECK (status IN ('sent', 'failed', 'delivered', 'bounced', 'opened', 'clicked')),
    CONSTRAINT valid_attempts CHECK (attempts >= 1)
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE notification_templates IS 'Reusable notification templates for different channels';
COMMENT ON TABLE notifications IS 'Individual notification delivery records';
COMMENT ON TABLE notification_logs IS 'Detailed delivery logs with retry and status tracking';

COMMENT ON COLUMN notification_templates.variables IS 'Array of variable names used in template (e.g., ["customer_name", "invoice_number"])';
COMMENT ON COLUMN notifications.metadata IS 'Additional context data (e.g., user_id, invoice_id, etc.)';
COMMENT ON COLUMN notification_logs.attempts IS 'Number of delivery attempts made';
COMMENT ON COLUMN notification_logs.provider IS 'External provider used (e.g., SendGrid, Twilio, etc.)';
COMMENT ON COLUMN notification_logs.provider_message_id IS 'Provider-specific message/tracking ID';

DO $$
BEGIN
    RAISE NOTICE '✓ Migration 008 completed - Created 3 notification tables';
END $$;
