-- ============================================================================
-- Migration 006: Create Billing Indexes
-- Description: Performance indexes for billing tables
-- Author: CloudBill Team
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- SUBSCRIPTION PLANS INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active 
ON subscription_plans(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_name 
ON subscription_plans(name);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort 
ON subscription_plans(sort_order, is_active);

-- ============================================================================
-- TENANT SUBSCRIPTIONS INDEXES
-- ============================================================================
-- Most common query: Get tenant's active subscription
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_status 
ON tenant_subscriptions(tenant_id, status);

-- For plan analytics
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan 
ON tenant_subscriptions(plan_id) 
WHERE status = 'active';

-- For renewal jobs
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_renewal 
ON tenant_subscriptions(current_period_end, auto_renew) 
WHERE status = 'active' AND auto_renew = true;

-- For trial expiration checks
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_trial 
ON tenant_subscriptions(trial_ends_at) 
WHERE is_trial = true AND status = 'active';

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_dates 
ON tenant_subscriptions(started_at, current_period_start, current_period_end);

-- ============================================================================
-- INVOICES INDEXES
-- ============================================================================
-- Most common: Get tenant's invoices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created 
ON invoices(tenant_id, created_at DESC);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status 
ON invoices(status, created_at DESC);

-- Find unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid 
ON invoices(status, due_date) 
WHERE status IN ('open', 'past_due');

-- Invoice number lookup (already unique, but explicit index helps)
CREATE INDEX IF NOT EXISTS idx_invoices_number 
ON invoices(invoice_number);

-- Subscription invoices
CREATE INDEX IF NOT EXISTS idx_invoices_subscription 
ON invoices(subscription_id) 
WHERE subscription_id IS NOT NULL;

-- Period queries
CREATE INDEX IF NOT EXISTS idx_invoices_period 
ON invoices(period_start, period_end);

-- Payment date analytics
CREATE INDEX IF NOT EXISTS idx_invoices_paid 
ON invoices(paid_at) 
WHERE paid_at IS NOT NULL;

-- ============================================================================
-- INVOICE ITEMS INDEXES
-- ============================================================================
-- Get all items for an invoice
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice 
ON invoice_items(invoice_id, created_at);

-- Item type analytics
CREATE INDEX IF NOT EXISTS idx_invoice_items_type 
ON invoice_items(item_type);

-- JSONB metadata queries (if you query metadata frequently)
CREATE INDEX IF NOT EXISTS idx_invoice_items_metadata 
ON invoice_items USING gin(metadata);

-- ============================================================================
-- USAGE RECORDS INDEXES
-- ============================================================================
-- Most common: Get tenant usage
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_period 
ON usage_records(tenant_id, period_start, period_end);

-- Usage type queries
CREATE INDEX IF NOT EXISTS idx_usage_records_type 
ON usage_records(usage_type, tenant_id);

-- Subscription usage
CREATE INDEX IF NOT EXISTS idx_usage_records_subscription 
ON usage_records(subscription_id) 
WHERE subscription_id IS NOT NULL;

-- Time-based aggregation
CREATE INDEX IF NOT EXISTS idx_usage_records_recorded 
ON usage_records(recorded_at DESC);

-- Period lookup for billing jobs
CREATE INDEX IF NOT EXISTS idx_usage_records_billing_period 
ON usage_records(period_start, period_end, tenant_id);

-- JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_usage_records_metadata 
ON usage_records USING gin(metadata);

-- ============================================================================
-- BILLING CYCLES INDEXES
-- ============================================================================
-- Get tenant's billing cycles
CREATE INDEX IF NOT EXISTS idx_billing_cycles_tenant 
ON billing_cycles(tenant_id, cycle_start DESC);

-- Active cycles
CREATE INDEX IF NOT EXISTS idx_billing_cycles_active 
ON billing_cycles(status, cycle_end) 
WHERE status = 'active';

-- Subscription cycles
CREATE INDEX IF NOT EXISTS idx_billing_cycles_subscription 
ON billing_cycles(subscription_id);

-- Find cycles by date range
CREATE INDEX IF NOT EXISTS idx_billing_cycles_dates 
ON billing_cycles(cycle_start, cycle_end);

-- Invoice lookup
CREATE INDEX IF NOT EXISTS idx_billing_cycles_invoice 
ON billing_cycles(invoice_id) 
WHERE invoice_id IS NOT NULL;

-- ============================================================================
-- CREDITS INDEXES
-- ============================================================================
-- Get tenant's active credits
CREATE INDEX IF NOT EXISTS idx_credits_tenant_active 
ON credits(tenant_id, status) 
WHERE status = 'active';

-- Credit type analytics
CREATE INDEX IF NOT EXISTS idx_credits_type 
ON credits(credit_type, status);

-- Expiration checks
CREATE INDEX IF NOT EXISTS idx_credits_expiration 
ON credits(expires_at, status) 
WHERE status = 'active' AND expires_at IS NOT NULL;

-- Reference code lookup
CREATE INDEX IF NOT EXISTS idx_credits_reference 
ON credits(reference_code) 
WHERE reference_code IS NOT NULL;

-- Invoice credits
CREATE INDEX IF NOT EXISTS idx_credits_invoice 
ON credits(invoice_id) 
WHERE invoice_id IS NOT NULL;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Dashboard query: Tenant's current subscription with plan details
CREATE INDEX IF NOT EXISTS idx_tenant_sub_plan_lookup 
ON tenant_subscriptions(tenant_id, plan_id, status);

-- Revenue reporting: All paid invoices by period
CREATE INDEX IF NOT EXISTS idx_invoices_revenue 
ON invoices(status, period_start, total_amount) 
WHERE status = 'paid';

-- Usage-based billing: Aggregate usage by tenant and type
CREATE INDEX IF NOT EXISTS idx_usage_aggregation 
ON usage_records(tenant_id, usage_type, period_start, period_end);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX idx_tenant_subscriptions_tenant_status IS 'Fast lookup of tenant subscriptions by status';
COMMENT ON INDEX idx_invoices_tenant_created IS 'Optimized for tenant invoice list queries';
COMMENT ON INDEX idx_usage_records_tenant_period IS 'Usage aggregation by tenant and period';
COMMENT ON INDEX idx_billing_cycles_active IS 'Quick access to active billing cycles';

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================
ANALYZE subscription_plans;
ANALYZE tenant_subscriptions;
ANALYZE invoices;
ANALYZE invoice_items;
ANALYZE usage_records;
ANALYZE billing_cycles;
ANALYZE credits;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✓ Migration 006 completed successfully';
    RAISE NOTICE '✓ Created performance indexes for all billing tables';
    RAISE NOTICE '✓ Tables analyzed for query optimization';
END $$;