-- ============================================================================
-- Sample Data Seed Script for CloudBill Dashboard Testing
-- Description: Generates realistic test data for invoices, subscriptions,
--              and related records for tenant testing
-- Target Tenant: 00000000-0000-0000-0000-000000000001 (Demo Company)
-- Date Range: Last 30 days
-- ============================================================================

-- ============================================================================
-- 1. CLEAR EXISTING DATA (Optional - uncomment if needed)
-- ============================================================================
-- DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = '00000000-0000-0000-0000-000000000001');
-- DELETE FROM invoices WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- DELETE FROM tenant_subscriptions WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- DELETE FROM usage_records WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 2. INSERT SAMPLE SUBSCRIPTIONS
-- ============================================================================
-- Create 5 subscription records with various statuses and billing cycles
INSERT INTO tenant_subscriptions (
        id,
        tenant_id,
        plan_id,
        status,
        billing_cycle,
        current_price,
        currency,
        started_at,
        current_period_start,
        current_period_end,
        cancelled_at,
        expires_at,
        auto_renew,
        trial_ends_at,
        is_trial,
        created_at,
        updated_at
    )
VALUES
        -- Subscription 1: Active Pro Plan (Monthly)
        (
            '11111111-1111-1111-1111-111111111111'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            (SELECT id FROM subscription_plans WHERE name = 'pro'),
            'active',
            'monthly',
            49.00,
            'USD',
            CURRENT_TIMESTAMP - INTERVAL '6 months',
            CURRENT_TIMESTAMP - INTERVAL '15 days',
            CURRENT_TIMESTAMP + INTERVAL '15 days',
            NULL,
            NULL,
            true,
            NULL,
            false,
            CURRENT_TIMESTAMP - INTERVAL '6 months',
            CURRENT_TIMESTAMP - INTERVAL '15 days'
        ),
        -- Subscription 2: Expired Enterprise Plan (Yearly)
        (
            '22222222-2222-2222-2222-222222222222'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            (SELECT id FROM subscription_plans WHERE name = 'enterprise'),
            'expired',
            'yearly',
            1910.00,
            'USD',
            CURRENT_TIMESTAMP - INTERVAL '3 months',
            CURRENT_TIMESTAMP - INTERVAL '3 months',
            CURRENT_TIMESTAMP + INTERVAL '9 months',
            NULL,
            NULL,
            true,
            NULL,
            false,
            CURRENT_TIMESTAMP - INTERVAL '3 months',
            CURRENT_TIMESTAMP
        ),
        -- Subscription 3: Cancelled Pro Plan
        (
            '33333333-3333-3333-3333-333333333333'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            (SELECT id FROM subscription_plans WHERE name = 'pro'),
            'cancelled',
            'monthly',
            49.00,
            'USD',
            CURRENT_TIMESTAMP - INTERVAL '1 year',
            CURRENT_TIMESTAMP - INTERVAL '2 months',
            CURRENT_TIMESTAMP - INTERVAL '1 month',
            CURRENT_TIMESTAMP - INTERVAL '1 month',
            CURRENT_TIMESTAMP - INTERVAL '1 month',
            false,
            NULL,
            false,
            CURRENT_TIMESTAMP - INTERVAL '1 year',
            CURRENT_TIMESTAMP - INTERVAL '1 month'
        ),
        -- Subscription 4: Suspended Free Plan (Trial Expired)
        (
            '44444444-4444-4444-4444-444444444444'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            (SELECT id FROM subscription_plans WHERE name = 'free'),
            'suspended',
            'monthly',
            0.00,
            'USD',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP + INTERVAL '25 days',
            NULL,
            NULL,
            true,
            CURRENT_TIMESTAMP + INTERVAL '9 days',
            true,
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days'
        ),
        -- Subscription 5: Past Due Pro Plan
        (
            '55555555-5555-5555-5555-555555555555'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            (SELECT id FROM subscription_plans WHERE name = 'pro'),
            'past_due',
            'monthly',
            49.00,
            'USD',
            CURRENT_TIMESTAMP - INTERVAL '8 months',
            CURRENT_TIMESTAMP - INTERVAL '1 month',
            CURRENT_TIMESTAMP,
            NULL,
            NULL,
            true,
            NULL,
            false,
            CURRENT_TIMESTAMP - INTERVAL '8 months',
            CURRENT_TIMESTAMP
        );

-- ============================================================================
-- 3. INSERT SAMPLE INVOICES
-- ============================================================================
-- Create 10 invoices with various statuses and amounts across the last 30 days
INSERT INTO invoices (
        id,
        tenant_id,
        subscription_id,
        invoice_number,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid,
        amount_due,
        currency,
        status,
        period_start,
        period_end,
        issue_date,
        due_date,
        paid_at,
        payment_method,
        payment_reference,
        notes,
        created_at,
        updated_at
    )
    VALUES
        -- Invoice 1: Paid Pro Monthly
        (
            'a1111111-1111-1111-1111-111111111111'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '11111111-1111-1111-1111-111111111111'::uuid,
            'INV-2025-001',
            49.00,
            4.90,
            0.00,
            53.90,
            53.90,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '45 days',
            CURRENT_TIMESTAMP - INTERVAL '15 days',
            CURRENT_TIMESTAMP - INTERVAL '20 days',
            CURRENT_TIMESTAMP - INTERVAL '13 days',
            CURRENT_TIMESTAMP - INTERVAL '14 days',
            'credit_card',
            'ch_3P4K5L6M7N8O9P0Q',
            'Automated monthly billing for Pro Plan',
            CURRENT_TIMESTAMP - INTERVAL '20 days',
            CURRENT_TIMESTAMP - INTERVAL '14 days'
        ),
        -- Invoice 2: Paid Enterprise Yearly
        (
            'a2222222-2222-2222-2222-222222222222'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '22222222-2222-2222-2222-222222222222'::uuid,
            'INV-2025-002',
            1910.00,
            191.00,
            0.00,
            2101.00,
            2101.00,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '90 days',
            CURRENT_TIMESTAMP + INTERVAL '275 days',
            CURRENT_TIMESTAMP - INTERVAL '27 days',
            CURRENT_TIMESTAMP - INTERVAL '20 days',
            CURRENT_TIMESTAMP - INTERVAL '22 days',
            'bank_transfer',
            'wire_20250115_001',
            'Annual Enterprise subscription - includes priority support',
            CURRENT_TIMESTAMP - INTERVAL '27 days',
            CURRENT_TIMESTAMP - INTERVAL '22 days'
        ),
        -- Invoice 3: Open (Pending) Pro Monthly
        (
            'a3333333-3333-3333-3333-333333333333'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '11111111-1111-1111-1111-111111111111'::uuid,
            'INV-2025-003',
            49.00,
            4.90,
            0.00,
            53.90,
            0.00,
            53.90,
            'USD',
            'open',
            CURRENT_TIMESTAMP - INTERVAL '15 days',
            CURRENT_TIMESTAMP + INTERVAL '15 days',
            CURRENT_TIMESTAMP - INTERVAL '10 days',
            CURRENT_TIMESTAMP + INTERVAL '5 days',
            NULL,
            NULL,
            NULL,
            'Current billing period',
            CURRENT_TIMESTAMP - INTERVAL '10 days',
            CURRENT_TIMESTAMP - INTERVAL '10 days'
        ),
        -- Invoice 4: Paid Pro Monthly (Previous Period)
        (
            'a4444444-4444-4444-4444-444444444444'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '33333333-3333-3333-3333-333333333333'::uuid,
            'INV-2025-004',
            49.00,
            4.90,
            4.90,
            49.00,
            49.00,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '60 days',
            CURRENT_TIMESTAMP - INTERVAL '30 days',
            CURRENT_TIMESTAMP - INTERVAL '25 days',
            CURRENT_TIMESTAMP - INTERVAL '18 days',
            CURRENT_TIMESTAMP - INTERVAL '20 days',
            'credit_card',
            'ch_3P9X8Y7Z6A5B4C3D',
            'Monthly Pro subscription with 10% loyalty discount',
            CURRENT_TIMESTAMP - INTERVAL '25 days',
            CURRENT_TIMESTAMP - INTERVAL '20 days'
        ),
        -- Invoice 5: Open (Overdue) Past Due Subscription
        (
            'a5555555-5555-5555-5555-555555555555'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '55555555-5555-5555-5555-555555555555'::uuid,
            'INV-2025-005',
            49.00,
            4.90,
            0.00,
            53.90,
            0.00,
            53.90,
            'USD',
            'open',
            CURRENT_TIMESTAMP - INTERVAL '60 days',
            CURRENT_TIMESTAMP - INTERVAL '30 days',
            CURRENT_TIMESTAMP - INTERVAL '28 days',
            CURRENT_TIMESTAMP - INTERVAL '21 days',
            NULL,
            NULL,
            NULL,
            'Payment failed - card expired. Please update payment method.',
            CURRENT_TIMESTAMP - INTERVAL '28 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days'
        ),
        -- Invoice 6: Draft (Usage Based)
        (
            'a6666666-6666-6666-6666-666666666666'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '22222222-2222-2222-2222-222222222222'::uuid,
            'INV-2025-006',
            125.50,
            12.55,
            0.00,
            138.05,
            0.00,
            138.05,
            'USD',
            'draft',
            CURRENT_TIMESTAMP - INTERVAL '7 days',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP - INTERVAL '1 day',
            CURRENT_TIMESTAMP + INTERVAL '14 days',
            NULL,
            NULL,
            NULL,
            'Usage-based charges for API calls (overage)',
            CURRENT_TIMESTAMP - INTERVAL '1 day',
            CURRENT_TIMESTAMP
        ),
        -- Invoice 7: Paid Pro Monthly (2 months ago)
        (
            'a7777777-7777-7777-7777-777777777777'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '11111111-1111-1111-1111-111111111111'::uuid,
            'INV-2024-098',
            49.00,
            4.90,
            0.00,
            53.90,
            53.90,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '75 days',
            CURRENT_TIMESTAMP - INTERVAL '45 days',
            CURRENT_TIMESTAMP - INTERVAL '50 days',
            CURRENT_TIMESTAMP - INTERVAL '43 days',
            CURRENT_TIMESTAMP - INTERVAL '45 days',
            'credit_card',
            'ch_3N1M2K3L4J5H6G7F',
            'Automated monthly billing',
            CURRENT_TIMESTAMP - INTERVAL '50 days',
            CURRENT_TIMESTAMP - INTERVAL '45 days'
        ),
        -- Invoice 8: Void (Cancelled)
        (
            'a8888888-8888-8888-8888-888888888888'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '33333333-3333-3333-3333-333333333333'::uuid,
            'INV-2024-099',
            49.00,
            4.90,
            0.00,
            53.90,
            0.00,
            0.00,
            'USD',
            'void',
            CURRENT_TIMESTAMP - INTERVAL '35 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '35 days',
            CURRENT_TIMESTAMP - INTERVAL '28 days',
            NULL,
            NULL,
            NULL,
            'Voided due to subscription cancellation - customer request',
            CURRENT_TIMESTAMP - INTERVAL '35 days',
            CURRENT_TIMESTAMP - INTERVAL '30 days'
        ),
        -- Invoice 9: Paid with Partial Refund
        (
            'a9999999-9999-9999-9999-999999999999'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '11111111-1111-1111-1111-111111111111'::uuid,
            'INV-2024-097',
            49.00,
            4.90,
            0.00,
            53.90,
            53.90,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '105 days',
            CURRENT_TIMESTAMP - INTERVAL '75 days',
            CURRENT_TIMESTAMP - INTERVAL '80 days',
            CURRENT_TIMESTAMP - INTERVAL '73 days',
            CURRENT_TIMESTAMP - INTERVAL '75 days',
            'credit_card',
            'ch_3M1N2O3P4Q5R6S7T',
            'Payment processed - partial refund issued for service downtime',
            CURRENT_TIMESTAMP - INTERVAL '80 days',
            CURRENT_TIMESTAMP - INTERVAL '60 days'
        ),
        -- Invoice 10: Paid Free Trial (Zero Amount)
        (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            '44444444-4444-4444-4444-444444444444'::uuid,
            'INV-2025-007',
            0.00,
            0.00,
            0.00,
            0.00,
            0.00,
            0.00,
            'USD',
            'paid',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP + INTERVAL '9 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP + INTERVAL '9 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            NULL,
            NULL,
            'Free trial period - no charges',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '5 days'
        );

-- ============================================================================
-- 4. INSERT INVOICE ITEMS (Line Items)
-- ============================================================================
-- Add detailed line items for each invoice
INSERT INTO invoice_items (
    invoice_id,
    description,
    item_type,
    quantity,
    unit_price,
    amount,
    tax_rate,
    tax_amount,
    metadata
)
VALUES
    -- Items for Invoice 1 (INV-2025-001)
    (
        'a1111111-1111-1111-1111-111111111111'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly"}'::jsonb
    ),
    -- Items for Invoice 2 (INV-2025-002)
    (
        'a2222222-2222-2222-2222-222222222222'::uuid,
        'Enterprise Plan - Annual Subscription',
        'subscription',
        1.00,
        1910.00,
        1910.00,
        10.00,
        191.00,
        '{"plan": "enterprise", "billing_cycle": "yearly", "discount": "20% annual discount"}'::jsonb
    ),
    -- Items for Invoice 3 (INV-2025-003)
    (
        'a3333333-3333-3333-3333-333333333333'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly"}'::jsonb
    ),
    -- Items for Invoice 4 (INV-2025-004)
    (
        'a4444444-4444-4444-4444-444444444444'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly"}'::jsonb
    ),
    (
        'a4444444-4444-4444-4444-444444444444'::uuid,
        'Loyalty Discount - 10% off',
        'discount',
        1.00,
        4.90,
        4.90,
        0.00,
        0.00,
        '{"discount_type": "loyalty", "discount_percent": 10}'::jsonb
    ),
    -- Items for Invoice 5 (INV-2025-005)
    (
        'a5555555-5555-5555-5555-555555555555'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly", "payment_status": "overdue"}'::jsonb
    ),
    -- Items for Invoice 6 (INV-2025-006) - Usage Based
    (
        'a6666666-6666-6666-6666-666666666666'::uuid,
        'API Call Overage - 15,250 calls',
        'usage',
        15250.00,
        0.005,
        76.25,
        10.00,
        7.63,
        '{"resource_type": "api_calls", "rate_per_call": 0.005}'::jsonb
    ),
    (
        'a6666666-6666-6666-6666-666666666666'::uuid,
        'Storage Overage - 12.5 GB',
        'usage',
        12.50,
        2.00,
        25.00,
        10.00,
        2.50,
        '{"resource_type": "storage", "rate_per_gb": 2.00}'::jsonb
    ),
    (
        'a6666666-6666-6666-6666-666666666666'::uuid,
        'Additional User Licenses - 3 users',
        'usage',
        3.00,
        8.00,
        24.00,
        10.00,
        2.40,
        '{"resource_type": "users", "rate_per_user": 8.00}'::jsonb
    ),
    -- Items for Invoice 7 (INV-2024-098)
    (
        'a7777777-7777-7777-7777-777777777777'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly"}'::jsonb
    ),
    -- Items for Invoice 8 (INV-2024-099) - Voided
    (
        'a8888888-8888-8888-8888-888888888888'::uuid,
        'Professional Plan - Monthly Subscription (VOIDED)',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly", "voided": true}'::jsonb
    ),
    -- Items for Invoice 9 (INV-2024-097)
    (
        'a9999999-9999-9999-9999-999999999999'::uuid,
        'Professional Plan - Monthly Subscription',
        'subscription',
        1.00,
        49.00,
        49.00,
        10.00,
        4.90,
        '{"plan": "pro", "billing_cycle": "monthly", "refund_issued": "15.00"}'::jsonb
    ),
    -- Items for Invoice 10 (INV-2025-007) - Free Trial
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        'Free Plan - Trial Period (14 days)',
        'subscription',
        1.00,
        0.00,
        0.00,
        0.00,
        0.00,
        '{"plan": "free", "trial": true, "trial_days": 14}'::jsonb
    );

-- ============================================================================
-- 5. INSERT SAMPLE USAGE RECORDS (Optional)
-- ============================================================================
-- Add some usage tracking data for the Enterprise subscription
INSERT INTO usage_records (
    tenant_id,
    subscription_id,
    usage_type,
    quantity,
    unit,
    period_start,
    period_end,
    metadata,
    recorded_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        '22222222-2222-2222-2222-222222222222'::uuid,
        'api_calls',
        127543.0000,
        'requests',
        CURRENT_TIMESTAMP - INTERVAL '7 days',
        CURRENT_TIMESTAMP,
        '{"endpoint": "/api/v1/billing/*", "method": "GET"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        '22222222-2222-2222-2222-222222222222'::uuid,
        'storage',
        387.5000,
        'GB',
        CURRENT_TIMESTAMP - INTERVAL '7 days',
        CURRENT_TIMESTAMP,
        '{"storage_type": "database", "location": "us-east-1"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        '11111111-1111-1111-1111-111111111111'::uuid,
        'api_calls',
        43289.0000,
        'requests',
        CURRENT_TIMESTAMP - INTERVAL '15 days',
        CURRENT_TIMESTAMP,
        '{"endpoint": "/api/v1/*", "method": "mixed"}'::jsonb,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        '11111111-1111-1111-1111-111111111111'::uuid,
        'bandwidth',
        523.2500,
        'GB',
        CURRENT_TIMESTAMP - INTERVAL '15 days',
        CURRENT_TIMESTAMP,
        '{"transfer_type": "egress", "region": "us-west-2"}'::jsonb,
        CURRENT_TIMESTAMP
    );

-- ============================================================================
-- 6. VERIFICATION & SUMMARY
-- ============================================================================
DO $$
DECLARE
    subscription_count INTEGER;
    invoice_count INTEGER;
    invoice_item_count INTEGER;
    usage_count INTEGER;
    total_revenue DECIMAL(10, 2);
    paid_invoice_count INTEGER;
    open_invoice_count INTEGER;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO subscription_count
    FROM tenant_subscriptions
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

    SELECT COUNT(*) INTO invoice_count
    FROM invoices
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

    SELECT COUNT(*) INTO invoice_item_count
    FROM invoice_items
    WHERE invoice_id IN (
        SELECT id FROM invoices WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    );

    SELECT COUNT(*) INTO usage_count
    FROM usage_records
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

    -- Calculate revenue
    SELECT COALESCE(SUM(total_amount), 0) INTO total_revenue
    FROM invoices
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'paid';

    -- Count by status
    SELECT COUNT(*) INTO paid_invoice_count
    FROM invoices
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'paid';

    SELECT COUNT(*) INTO open_invoice_count
    FROM invoices
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'open';

    -- Display summary
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Sample Data Seed Completed Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tenant ID: 00000000-0000-0000-0000-000000000001';
    RAISE NOTICE '';
    RAISE NOTICE 'Records Created:';
    RAISE NOTICE '  - Subscriptions: %', subscription_count;
    RAISE NOTICE '  - Invoices: %', invoice_count;
    RAISE NOTICE '  - Invoice Items: %', invoice_item_count;
    RAISE NOTICE '  - Usage Records: %', usage_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Invoice Breakdown:';
    RAISE NOTICE '  - Paid Invoices: %', paid_invoice_count;
    RAISE NOTICE '  - Open Invoices: %', open_invoice_count;
    RAISE NOTICE '  - Total Revenue (Paid): $%', total_revenue;
    RAISE NOTICE '';
    RAISE NOTICE 'Dashboard Ready: http://localhost:8080/api/billing/stats/dashboard';
    RAISE NOTICE '========================================';

    -- Verify minimum data exists
    IF invoice_count < 5 OR subscription_count < 3 THEN
        RAISE EXCEPTION 'Seed failed: Insufficient data created';
    END IF;
END $$;

-- ============================================================================
-- 7. DISPLAY SAMPLE DATA
-- ============================================================================
-- Show created subscriptions
SELECT
    '=== SUBSCRIPTIONS ===' as summary;

SELECT
    id,
    status,
    billing_cycle,
    current_price,
    is_trial,
    auto_renew,
    DATE(current_period_end) as period_end
FROM tenant_subscriptions
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC;

-- Show created invoices
SELECT
    '=== INVOICES ===' as summary;

SELECT
    invoice_number,
    status,
    total_amount,
    amount_due,
    DATE(due_date) as due_date,
    DATE(paid_at) as paid_at
FROM invoices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC;
