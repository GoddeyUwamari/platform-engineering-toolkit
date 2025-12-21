/**
 * Payment Service Unit Tests
 * Tests business logic for payment operations with mocked Stripe
 */

// Mock dependencies
jest.mock('../../src/config/stripe.config');
jest.mock('../../src/repositories/payment.repository');
jest.mock('@shared/utils/logger');

import { PaymentService } from '../../src/services/payment.service';
import { PaymentRepository } from '../../src/repositories/payment.repository';
import { stripeConfig } from '../../src/config/stripe.config';
import { mockStripe, mockPayment } from '../helpers/mocks';
import { PaymentStatus } from '../../src/types/payment.types';

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (stripeConfig.getClient as jest.Mock).mockReturnValue(mockStripe);
  });

  describe('createPaymentIntent', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const validPaymentData = {
      amount: 50.00,
      currency: 'usd',
      description: 'Test payment',
      invoice_id: '123e4567-e89b-12d3-a456-426614174003',
      payment_method_id: 'pm_mock_123',
    };

    it('should create payment intent successfully', async () => {
      (PaymentRepository.create as jest.Mock).mockResolvedValue(mockPayment);

      const result = await PaymentService.createPaymentIntent(tenantId, validPaymentData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('client_secret');
      expect(result.amount).toBe(50);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000, // Converted to cents
          currency: 'usd',
          description: 'Test payment',
        })
      );
      expect(PaymentRepository.create).toHaveBeenCalled();
    });

    it('should create payment intent with automatic payment methods', async () => {
      (PaymentRepository.create as jest.Mock).mockResolvedValue(mockPayment);

      const dataWithAuto = {
        ...validPaymentData,
        automatic_payment_methods: true,
      };

      await PaymentService.createPaymentIntent(tenantId, dataWithAuto);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          automatic_payment_methods: { enabled: true },
        })
      );
    });

    it('should create payment intent without payment method', async () => {
      (PaymentRepository.create as jest.Mock).mockResolvedValue(mockPayment);

      const dataWithoutPM = {
        amount: 50.00,
        currency: 'usd',
        description: 'Test payment',
      };

      await PaymentService.createPaymentIntent(tenantId, dataWithoutPM);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          payment_method: expect.anything(),
        })
      );
    });

    it('should throw error when Stripe fails', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentService.createPaymentIntent(tenantId, validPaymentData)
      ).rejects.toThrow('Stripe error');
    });

    it('should include metadata in payment intent', async () => {
      (PaymentRepository.create as jest.Mock).mockResolvedValue(mockPayment);

      const dataWithMetadata = {
        ...validPaymentData,
        metadata: { custom_field: 'custom_value' },
      };

      await PaymentService.createPaymentIntent(tenantId, dataWithMetadata);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tenant_id: tenantId,
            custom_field: 'custom_value',
          }),
        })
      );
    });
  });

  describe('confirmPayment', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const confirmData = {
      payment_intent_id: 'pi_mock_id_123456',
      payment_method_id: 'pm_mock_123',
      return_url: 'https://example.com/return',
    };

    it('should confirm payment intent successfully', async () => {
      (PaymentRepository.updateStatus as jest.Mock).mockResolvedValue(mockPayment);

      const result = await PaymentService.confirmPayment(tenantId, confirmData);

      expect(result).toHaveProperty('id', 'pi_mock_id_123456');
      expect(result.status).toBe('succeeded');
      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith(
        confirmData.payment_intent_id,
        expect.objectContaining({
          payment_method: confirmData.payment_method_id,
          return_url: confirmData.return_url,
        })
      );
      expect(PaymentRepository.updateStatus).toHaveBeenCalled();
    });

    it('should throw error when confirmation fails', async () => {
      mockStripe.paymentIntents.confirm.mockRejectedValue(new Error('Confirmation failed'));

      await expect(
        PaymentService.confirmPayment(tenantId, confirmData)
      ).rejects.toThrow('Confirmation failed');
    });

    it('should update database with charge ID after confirmation', async () => {
      const mockPI = {
        ...mockStripe.paymentIntents.confirm(),
        latest_charge: 'ch_mock_charge_123',
      };
      mockStripe.paymentIntents.confirm.mockResolvedValue(mockPI);
      (PaymentRepository.updateStatus as jest.Mock).mockResolvedValue(mockPayment);

      await PaymentService.confirmPayment(tenantId, confirmData);

      expect(PaymentRepository.updateStatus).toHaveBeenCalledWith(
        confirmData.payment_intent_id,
        tenantId,
        expect.any(String),
        expect.objectContaining({
          stripe_charge_id: 'ch_mock_charge_123',
        })
      );
    });
  });

  describe('cancelPayment', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentIntentId = 'pi_mock_id_123456';

    it('should cancel payment intent successfully', async () => {
      (PaymentRepository.updateStatus as jest.Mock).mockResolvedValue(mockPayment);

      const result = await PaymentService.cancelPayment(tenantId, paymentIntentId);

      expect(result).toHaveProperty('id', paymentIntentId);
      expect(result.status).toBe('canceled');
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith(paymentIntentId);
      expect(PaymentRepository.updateStatus).toHaveBeenCalledWith(
        paymentIntentId,
        tenantId,
        PaymentStatus.CANCELLED
      );
    });

    it('should throw error when cancellation fails', async () => {
      mockStripe.paymentIntents.cancel.mockRejectedValue(new Error('Cancellation failed'));

      await expect(
        PaymentService.cancelPayment(tenantId, paymentIntentId)
      ).rejects.toThrow('Cancellation failed');
    });
  });

  describe('getPaymentById', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should retrieve payment successfully', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);

      const result = await PaymentService.getPaymentById(tenantId, paymentId);

      expect(result).toEqual(mockPayment);
      expect(PaymentRepository.findById).toHaveBeenCalledWith(paymentId, tenantId);
    });

    it('should return null when payment not found', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await PaymentService.getPaymentById(tenantId, paymentId);

      expect(result).toBeNull();
    });

    it('should throw error when repository fails', async () => {
      (PaymentRepository.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentService.getPaymentById(tenantId, paymentId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('listPayments', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should list payments without filters', async () => {
      const mockPayments = [mockPayment, { ...mockPayment, id: 'another-id' }];
      (PaymentRepository.findAll as jest.Mock).mockResolvedValue(mockPayments);

      const result = await PaymentService.listPayments(tenantId);

      expect(result).toEqual(mockPayments);
      expect(PaymentRepository.findAll).toHaveBeenCalledWith(tenantId, {});
    });

    it('should list payments with filters', async () => {
      const mockPayments = [mockPayment];
      (PaymentRepository.findAll as jest.Mock).mockResolvedValue(mockPayments);

      const filters = {
        status: PaymentStatus.SUCCEEDED,
        limit: 10,
        offset: 0,
      };

      const result = await PaymentService.listPayments(tenantId, filters);

      expect(result).toEqual(mockPayments);
      expect(PaymentRepository.findAll).toHaveBeenCalledWith(tenantId, filters);
    });

    it('should throw error when repository fails', async () => {
      (PaymentRepository.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentService.listPayments(tenantId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPaymentStats', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should retrieve payment statistics', async () => {
      const mockStats = {
        total: 100,
        succeeded: 80,
        failed: 15,
        pending: 5,
        totalAmount: '5000.00',
      };
      (PaymentRepository.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await PaymentService.getPaymentStats(tenantId);

      expect(result).toEqual(mockStats);
      expect(PaymentRepository.getStats).toHaveBeenCalledWith(tenantId);
    });

    it('should throw error when repository fails', async () => {
      (PaymentRepository.getStats as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentService.getPaymentStats(tenantId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('retrievePaymentIntent', () => {
    const paymentIntentId = 'pi_mock_id_123456';

    it('should retrieve payment intent from Stripe', async () => {
      const mockPI = await mockStripe.paymentIntents.retrieve(paymentIntentId);

      const result = await PaymentService.retrievePaymentIntent(paymentIntentId);

      expect(result).toEqual(mockPI);
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId);
    });

    it('should throw error when Stripe fails', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentService.retrievePaymentIntent(paymentIntentId)
      ).rejects.toThrow('Stripe error');
    });
  });
});
