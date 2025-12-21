-- ============================================================================
-- Migration 011: Create Payment Tables
-- Description: Payment processing tables for Stripe integration, including
--              payment methods, payments, refunds, and transaction logs
-- Author: CloudBill Team
-- Date: 2025-10-28
-- ============================================================================

-- ============================================================================
-- 1. PAYMENT METHODS TABLE
-- Stores customer payment methods (credit cards, bank accounts, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) UNIQUE,
    type VARCHAR(50) NOT NULL,
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_fingerprint VARCHAR(255),
    bank_account_last4 VARCHAR(4),
    bank_name VARCHAR(255),
    is_default BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    billing_details JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_payment_method_type CHECK (type IN ('card', 'bank_account', 'paypal', 'other')),
    CONSTRAINT valid_payment_method_status CHECK (status IN ('active', 'inactive', 'expired', 'deleted')),
    CONSTRAINT valid_card_exp_month CHECK (card_exp_month IS NULL OR (card_exp_month >= 1 AND card_exp_month <= 12))
);

CREATE INDEX idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);
CREATE UNIQUE INDEX idx_tenant_default_payment_method ON payment_methods(tenant_id) WHERE is_default = true;

-- ============================================================================
-- 2. PAYMENTS TABLE
-- Records all payment attempts and transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    amount_refunded DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    failure_code VARCHAR(100),
    failure_message TEXT,
    receipt_url TEXT,
    description TEXT,
    statement_descriptor VARCHAR(255),
    provider_response JSONB,
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_payment_method CHECK (method IN ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'PAYPAL')),
    CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
    CONSTRAINT valid_payment_amounts CHECK (amount >= 0 AND amount_refunded >= 0 AND amount_refunded <= amount)
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_payment_method ON payments(payment_method_id);
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================================================
-- 3. REFUNDS TABLE
-- Tracks refunds issued for payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    stripe_refund_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    reason VARCHAR(100),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    receipt_number VARCHAR(255),
    provider_response JSONB,
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_refund_reason CHECK (reason IS NULL OR reason IN ('duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge', 'other')),
    CONSTRAINT valid_refund_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT valid_refund_amount CHECK (amount > 0)
);

CREATE INDEX idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_invoice ON refunds(invoice_id);
CREATE INDEX idx_refunds_stripe ON refunds(stripe_refund_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);

-- ============================================================================
-- 4. TRANSACTIONS TABLE
-- General transaction log for audit trail and reconciliation
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    description TEXT,
    reference_id VARCHAR(255),
    external_id VARCHAR(255),
    provider VARCHAR(50),
    provider_response JSONB,
    balance_before DECIMAL(10, 2),
    balance_after DECIMAL(10, 2),
    metadata JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('payment', 'refund', 'charge', 'credit', 'adjustment', 'fee', 'payout', 'transfer')),
    CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'reversed'))
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_payment ON transactions(payment_id);
CREATE INDEX idx_transactions_refund ON transactions(refund_id);
CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_reference ON transactions(reference_id);
CREATE INDEX idx_transactions_external ON transactions(external_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE payment_methods IS 'Customer payment methods (cards, bank accounts)';
COMMENT ON TABLE payments IS 'Payment records and transaction history';
COMMENT ON TABLE refunds IS 'Refund records linked to payments';
COMMENT ON TABLE transactions IS 'General transaction log for audit trail';

COMMENT ON COLUMN payment_methods.stripe_payment_method_id IS 'Stripe PaymentMethod ID';
COMMENT ON COLUMN payments.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payments.stripe_charge_id IS 'Stripe Charge ID';
COMMENT ON COLUMN refunds.stripe_refund_id IS 'Stripe Refund ID';

DO $$
BEGIN
    RAISE NOTICE '✓ Migration 011 completed - Created 4 payment tables with indexes';
END $$;
