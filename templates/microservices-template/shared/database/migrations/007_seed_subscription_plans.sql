-- ============================================================================
-- Migration 007: Seed Subscription Plans
-- Description: Initial subscription plan data (Free, Pro, Enterprise)
-- Author: CloudBill Team
-- Date: 2025-10-25
-- ============================================================================

-- ============================================================================
-- CLEAR EXISTING PLANS (if any)
-- ============================================================================
-- This allows re-running the migration safely
DELETE FROM subscription_plans WHERE name IN ('free', 'pro', 'enterprise');

-- ============================================================================
-- FREE PLAN
-- ============================================================================
INSERT INTO subscription_plans (
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    max_api_calls,
    max_storage_gb,
    max_users,
    max_projects,
    has_advanced_analytics,
    has_priority_support,
    has_custom_branding,
    has_api_access,
    has_webhooks,
    is_active,
    sort_order
) VALUES (
    'free',
    'Free Plan',
    'Perfect for getting started with CloudBill. Includes basic features to test the platform.',
    0.00,                           -- $0/month
    0.00,                           -- $0/year
    1000,                           -- 1,000 API calls/month
    1,                              -- 1 GB storage
    3,                              -- 3 users
    5,                              -- 5 projects
    false,                          -- No advanced analytics
    false,                          -- No priority support
    false,                          -- No custom branding
    false,                          -- No API access
    false,                          -- No webhooks
    true,                           -- Active
    1                               -- First in list
);

-- ============================================================================
-- PROFESSIONAL PLAN
-- ============================================================================
INSERT INTO subscription_plans (
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    max_api_calls,
    max_storage_gb,
    max_users,
    max_projects,
    has_advanced_analytics,
    has_priority_support,
    has_custom_branding,
    has_api_access,
    has_webhooks,
    is_active,
    sort_order
) VALUES (
    'pro',
    'Professional Plan',
    'For growing businesses that need more power. Includes advanced features and higher limits.',
    49.00,                          -- $49/month
    470.00,                         -- $470/year (20% discount: $588 - $118)
    50000,                          -- 50,000 API calls/month
    50,                             -- 50 GB storage
    10,                             -- 10 users
    50,                             -- 50 projects
    true,                           -- Advanced analytics included
    true,                           -- Priority support included
    false,                          -- No custom branding (Enterprise only)
    true,                           -- API access included
    true,                           -- Webhooks included
    true,                           -- Active
    2                               -- Second in list
);

-- ============================================================================
-- ENTERPRISE PLAN
-- ============================================================================
INSERT INTO subscription_plans (
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    max_api_calls,
    max_storage_gb,
    max_users,
    max_projects,
    has_advanced_analytics,
    has_priority_support,
    has_custom_branding,
    has_api_access,
    has_webhooks,
    is_active,
    sort_order
) VALUES (
    'enterprise',
    'Enterprise Plan',
    'For large organizations requiring unlimited resources, custom branding, and dedicated support.',
    199.00,                         -- $199/month
    1910.00,                        -- $1,910/year (20% discount: $2,388 - $478)
    -1,                             -- Unlimited API calls (-1 = unlimited)
    500,                            -- 500 GB storage
    -1,                             -- Unlimited users
    -1,                             -- Unlimited projects
    true,                           -- Advanced analytics included
    true,                           -- Priority support included
    true,                           -- Custom branding included
    true,                           -- API access included
    true,                           -- Webhooks included
    true,                           -- Active
    3                               -- Third in list
);

-- ============================================================================
-- VERIFY INSERTION
-- ============================================================================
DO $$
DECLARE
    plan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO plan_count FROM subscription_plans;
    
    IF plan_count >= 3 THEN
        RAISE NOTICE '✓ Migration 007 completed successfully';
        RAISE NOTICE '✓ Created % subscription plans:', plan_count;
        RAISE NOTICE '  - Free Plan: $0/month (1K API calls, 1GB storage, 3 users)';
        RAISE NOTICE '  - Pro Plan: $49/month (50K API calls, 50GB storage, 10 users)';
        RAISE NOTICE '  - Enterprise Plan: $199/month (Unlimited API, 500GB storage, Unlimited users)';
    ELSE
        RAISE EXCEPTION 'Migration failed: Expected at least 3 plans, found %', plan_count;
    END IF;
END $$;

-- ============================================================================
-- DISPLAY CREATED PLANS
-- ============================================================================
SELECT 
    name,
    display_name,
    price_monthly,
    price_yearly,
    max_api_calls,
    max_storage_gb,
    max_users,
    is_active
FROM subscription_plans
ORDER BY sort_order;