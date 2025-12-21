/**
 * Mock implementations for Payment Service
 */

// ============================================================================
// Stripe Mock
// ============================================================================

export const mockStripe = {
  paymentIntents: {
    create: jest.fn<any, any>(() => Promise.resolve({
      id: 'pi_mock_id_123456',
      client_secret: 'pi_mock_id_123456_secret_mock',
      status: 'succeeded',
      amount: 5000,
      currency: 'usd',
      payment_method: 'pm_mock_123',
      description: 'Test payment',
      metadata: {},
      next_action: null,
      created: Math.floor(Date.now() / 1000),
    })),
    retrieve: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      status: 'succeeded',
      amount: 5000,
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
    })),
    confirm: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      status: 'succeeded',
      amount: 5000,
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
    })),
    cancel: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      status: 'canceled',
      amount: 5000,
      currency: 'usd',
      created: Math.floor(Date.now() / 1000),
    })),
  },
  refunds: {
    create: jest.fn<any, any>(() => Promise.resolve({
      id: 're_mock_id_123456',
      amount: 2500,
      currency: 'usd',
      status: 'succeeded',
      payment_intent: 'pi_mock_id_123456',
      reason: 'requested_by_customer',
      metadata: {},
      created: Math.floor(Date.now() / 1000),
    })),
    retrieve: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      amount: 2500,
      currency: 'usd',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
    })),
    list: jest.fn<any, any>(() => Promise.resolve({
      data: [],
      has_more: false,
    })),
  },
  paymentMethods: {
    create: jest.fn<any, any>(() => Promise.resolve({
      id: 'pm_mock_123',
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
    })),
    attach: jest.fn<any, any>((id: string, params: any) => Promise.resolve({
      id,
      customer: params.customer,
      type: 'card',
    })),
    detach: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      customer: null,
    })),
    list: jest.fn<any, any>(() => Promise.resolve({
      data: [],
      has_more: false,
    })),
    update: jest.fn<any, any>(() => Promise.resolve({})),
  },
  customers: {
    create: jest.fn<any, any>(() => Promise.resolve({
      id: 'cus_mock_123',
      email: 'test@example.com',
      metadata: {},
    })),
    retrieve: jest.fn<any, any>((id: string) => Promise.resolve({
      id,
      email: 'test@example.com',
      metadata: {},
    })),
    update: jest.fn<any, any>(() => Promise.resolve({})),
    del: jest.fn<any, any>(() => Promise.resolve({})),
  },
};

// ============================================================================
// Payment Repository Mock
// ============================================================================

export const mockPaymentRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// ============================================================================
// Refund Repository Mock
// ============================================================================

export const mockRefundRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByPayment: jest.fn(),
  getTotalRefundedAmount: jest.fn(() => Promise.resolve(0)),
};

// ============================================================================
// Logger Mock
// ============================================================================

export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// ============================================================================
// Mock Data
// ============================================================================

export const mockPayment = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  tenant_id: '123e4567-e89b-12d3-a456-426614174002',
  invoice_id: '123e4567-e89b-12d3-a456-426614174003',
  subscription_id: '123e4567-e89b-12d3-a456-426614174004',
  stripe_payment_intent_id: 'pi_mock_id_123456',
  amount: 50.00,
  currency: 'usd',
  status: 'succeeded',
  payment_method_id: 'pm_mock_123',
  description: 'Test payment',
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockRefund = {
  id: '123e4567-e89b-12d3-a456-426614174005',
  tenant_id: '123e4567-e89b-12d3-a456-426614174002',
  payment_id: '123e4567-e89b-12d3-a456-426614174001',
  stripe_refund_id: 're_mock_id_123456',
  amount: 25.00,
  currency: 'usd',
  status: 'succeeded',
  reason: 'requested_by_customer',
  metadata: {},
  created_at: new Date().toISOString(),
};

export const mockPaymentMethod = {
  id: '123e4567-e89b-12d3-a456-426614174006',
  tenant_id: '123e4567-e89b-12d3-a456-426614174002',
  user_id: '123e4567-e89b-12d3-a456-426614174007',
  stripe_payment_method_id: 'pm_mock_123',
  stripe_customer_id: 'cus_mock_123',
  type: 'card',
  last4: '4242',
  brand: 'visa',
  exp_month: 12,
  exp_year: 2025,
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ============================================================================
// Mock Reset Helper
// ============================================================================

export function resetAllMocks(): void {
  jest.clearAllMocks();

  // Reset and re-implement Stripe mocks
  mockStripe.paymentIntents.create.mockReset().mockImplementation(() => Promise.resolve({
    id: 'pi_mock_id_123456',
    client_secret: 'pi_mock_id_123456_secret_mock',
    status: 'succeeded',
    amount: 5000,
    currency: 'usd',
    payment_method: 'pm_mock_123',
    description: 'Test payment',
    metadata: {},
    next_action: null,
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.paymentIntents.retrieve.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    status: 'succeeded',
    amount: 5000,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.paymentIntents.confirm.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    status: 'succeeded',
    amount: 5000,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.paymentIntents.cancel.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    status: 'canceled',
    amount: 5000,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.refunds.create.mockReset().mockImplementation(() => Promise.resolve({
    id: 're_mock_id_123456',
    amount: 2500,
    currency: 'usd',
    status: 'succeeded',
    payment_intent: 'pi_mock_id_123456',
    reason: 'requested_by_customer',
    metadata: {},
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.refunds.retrieve.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    amount: 2500,
    currency: 'usd',
    status: 'succeeded',
    created: Math.floor(Date.now() / 1000),
  }));
  mockStripe.paymentMethods.create.mockReset().mockImplementation(() => Promise.resolve({
    id: 'pm_mock_123',
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2025,
    },
  }));
  mockStripe.paymentMethods.attach.mockReset().mockImplementation((id: string, params: any) => Promise.resolve({
    id,
    customer: params.customer,
    type: 'card',
  }));
  mockStripe.paymentMethods.detach.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    customer: null,
  }));
  mockStripe.customers.create.mockReset().mockImplementation(() => Promise.resolve({
    id: 'cus_mock_123',
    email: 'test@example.com',
    metadata: {},
  }));
  mockStripe.customers.retrieve.mockReset().mockImplementation((id: string) => Promise.resolve({
    id,
    email: 'test@example.com',
    metadata: {},
  }));
  mockStripe.paymentMethods.update.mockReset().mockImplementation(() => Promise.resolve({}));
  mockStripe.customers.update.mockReset().mockImplementation(() => Promise.resolve({}));
  mockStripe.customers.del.mockReset().mockImplementation(() => Promise.resolve({}));
  mockStripe.paymentMethods.list.mockReset().mockImplementation(() => Promise.resolve({
    data: [],
    has_more: false,
  }));
  mockStripe.refunds.list.mockReset().mockImplementation(() => Promise.resolve({
    data: [],
    has_more: false,
  }));

  // Reset repository mocks
  mockPaymentRepository.create.mockReset();
  mockPaymentRepository.findById.mockReset();
  mockPaymentRepository.findByTenant.mockReset();
  mockRefundRepository.create.mockReset();
  mockRefundRepository.findById.mockReset();
  mockRefundRepository.getTotalRefundedAmount.mockReset().mockImplementation(() => Promise.resolve(0));

  // Reset logger mocks
  mockLogger.info.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.debug.mockReset();
}

beforeEach(() => {
  resetAllMocks();
});
