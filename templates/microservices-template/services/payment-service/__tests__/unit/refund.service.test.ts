/**
 * Refund Service Unit Tests
 * Tests business logic for refund operations with mocked Stripe
 */

// Mock dependencies
jest.mock('../../src/config/stripe.config');
jest.mock('../../src/repositories/refund.repository');
jest.mock('../../src/repositories/payment.repository');
jest.mock('@shared/utils/logger');

import { RefundService } from '../../src/services/refund.service';
import { RefundRepository } from '../../src/repositories/refund.repository';
import { PaymentRepository } from '../../src/repositories/payment.repository';
import { stripeConfig } from '../../src/config/stripe.config';
import { mockStripe, mockPayment, mockRefund } from '../helpers/mocks';
import { RefundStatus } from '../../src/types/payment.types';

describe('Refund Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (stripeConfig.getClient as jest.Mock).mockReturnValue(mockStripe);
  });

  describe('createRefund', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const refundData = {
      payment_id: '123e4567-e89b-12d3-a456-426614174001',
      amount: 25.00,
      reason: 'requested_by_customer' as const,
    };

    it('should create refund successfully', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(0);
      (RefundRepository.create as jest.Mock).mockResolvedValue(mockRefund);

      const result = await RefundService.createRefund(tenantId, refundData);

      expect(result).toHaveProperty('id');
      expect(result.amount).toBe(25.00);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: mockPayment.stripe_payment_intent_id,
          amount: 2500, // Converted to cents
          reason: 'requested_by_customer',
        })
      );
      expect(RefundRepository.create).toHaveBeenCalled();
    });

    it('should create full refund when amount not specified', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(0);
      (RefundRepository.create as jest.Mock).mockResolvedValue({
        ...mockRefund,
        amount: mockPayment.amount,
      });

      const refundDataWithoutAmount = {
        payment_id: refundData.payment_id,
        reason: 'requested_by_customer' as const,
      };

      await RefundService.createRefund(tenantId, refundDataWithoutAmount);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: Number(mockPayment.amount) * 100,
        })
      );
    });

    it('should throw error when payment not found', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        RefundService.createRefund(tenantId, refundData)
      ).rejects.toThrow('Payment not found');
    });

    it('should throw error when refund exceeds available amount', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(40);

      const refundData = {
        payment_id: mockPayment.id,
        amount: 20,
        reason: 'requested_by_customer' as const,
      };

      await expect(
        RefundService.createRefund(tenantId, refundData)
      ).rejects.toThrow('exceeds available amount');
    });

    it('should calculate remaining refundable amount correctly', async () => {
      const paymentAmount = 100;
      const alreadyRefunded = 30;
      const refundAmount = 40;

      (PaymentRepository.findById as jest.Mock).mockResolvedValue({
        ...mockPayment,
        amount: paymentAmount,
      });
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(alreadyRefunded);
      (RefundRepository.create as jest.Mock).mockResolvedValue(mockRefund);

      const refundData = {
        payment_id: mockPayment.id,
        amount: refundAmount,
        reason: 'requested_by_customer' as const,
      };

      await RefundService.createRefund(tenantId, refundData);

      expect(RefundRepository.create).toHaveBeenCalled();
    });

    it('should throw error when exact refund limit is exceeded', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue({
        ...mockPayment,
        amount: 50,
      });
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(50);

      const refundData = {
        payment_id: mockPayment.id,
        amount: 1,
        reason: 'requested_by_customer' as const,
      };

      await expect(
        RefundService.createRefund(tenantId, refundData)
      ).rejects.toThrow('exceeds available amount');
    });

    it('should include metadata in refund', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(0);
      (RefundRepository.create as jest.Mock).mockResolvedValue(mockRefund);

      const refundDataWithMetadata = {
        ...refundData,
        metadata: { custom_field: 'custom_value' },
      };

      await RefundService.createRefund(tenantId, refundDataWithMetadata);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tenant_id: tenantId,
            payment_id: refundData.payment_id,
            custom_field: 'custom_value',
          }),
        })
      );
    });

    it('should throw error when Stripe fails', async () => {
      (PaymentRepository.findById as jest.Mock).mockResolvedValue(mockPayment);
      (RefundRepository.getTotalRefundedAmount as jest.Mock).mockResolvedValue(0);
      mockStripe.refunds.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        RefundService.createRefund(tenantId, refundData)
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('getRefundById', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const refundId = '123e4567-e89b-12d3-a456-426614174005';

    it('should retrieve refund successfully', async () => {
      (RefundRepository.findById as jest.Mock).mockResolvedValue(mockRefund);

      const result = await RefundService.getRefundById(tenantId, refundId);

      expect(result).toEqual(mockRefund);
      expect(RefundRepository.findById).toHaveBeenCalledWith(refundId, tenantId);
    });

    it('should return null when refund not found', async () => {
      (RefundRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await RefundService.getRefundById(tenantId, refundId);

      expect(result).toBeNull();
    });

    it('should throw error when repository fails', async () => {
      (RefundRepository.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        RefundService.getRefundById(tenantId, refundId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('listRefunds', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should list refunds without filters', async () => {
      const mockRefunds = [mockRefund, { ...mockRefund, id: 'another-id' }];
      (RefundRepository.findAll as jest.Mock).mockResolvedValue(mockRefunds);

      const result = await RefundService.listRefunds(tenantId);

      expect(result).toEqual(mockRefunds);
      expect(RefundRepository.findAll).toHaveBeenCalledWith(tenantId, {});
    });

    it('should list refunds with filters', async () => {
      const mockRefunds = [mockRefund];
      (RefundRepository.findAll as jest.Mock).mockResolvedValue(mockRefunds);

      const filters = {
        status: RefundStatus.SUCCEEDED,
        limit: 10,
        offset: 0,
      };

      const result = await RefundService.listRefunds(tenantId, filters);

      expect(result).toEqual(mockRefunds);
      expect(RefundRepository.findAll).toHaveBeenCalledWith(tenantId, filters);
    });

    it('should throw error when repository fails', async () => {
      (RefundRepository.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        RefundService.listRefunds(tenantId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('listRefundsForPayment', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentId = '123e4567-e89b-12d3-a456-426614174001';

    it('should list refunds for specific payment', async () => {
      const mockRefunds = [mockRefund, { ...mockRefund, id: 'another-refund' }];
      (RefundRepository.findByPaymentId as jest.Mock).mockResolvedValue(mockRefunds);

      const result = await RefundService.listRefundsForPayment(tenantId, paymentId);

      expect(result).toEqual(mockRefunds);
      expect(RefundRepository.findByPaymentId).toHaveBeenCalledWith(paymentId, tenantId);
    });

    it('should return empty array when no refunds exist', async () => {
      (RefundRepository.findByPaymentId as jest.Mock).mockResolvedValue([]);

      const result = await RefundService.listRefundsForPayment(tenantId, paymentId);

      expect(result).toEqual([]);
    });

    it('should throw error when repository fails', async () => {
      (RefundRepository.findByPaymentId as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        RefundService.listRefundsForPayment(tenantId, paymentId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getRefundStats', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should retrieve refund statistics', async () => {
      const mockStats = {
        total: 50,
        succeeded: 45,
        pending: 3,
        failed: 2,
        totalAmount: '2500.00',
      };
      (RefundRepository.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await RefundService.getRefundStats(tenantId);

      expect(result).toEqual(mockStats);
      expect(RefundRepository.getStats).toHaveBeenCalledWith(tenantId);
    });

    it('should throw error when repository fails', async () => {
      (RefundRepository.getStats as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        RefundService.getRefundStats(tenantId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateRefundStatus', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const stripeRefundId = 're_mock_id_123456';

    it('should update refund status successfully', async () => {
      (RefundRepository.findByStripeRefundId as jest.Mock).mockResolvedValue(mockRefund);
      (RefundRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...mockRefund,
        status: RefundStatus.SUCCEEDED,
      });

      const result = await RefundService.updateRefundStatus(
        tenantId,
        stripeRefundId,
        RefundStatus.SUCCEEDED
      );

      expect(result).toBeDefined();
      expect(RefundRepository.updateStatus).toHaveBeenCalledWith(
        mockRefund.id,
        tenantId,
        RefundStatus.SUCCEEDED,
        undefined
      );
    });

    it('should update refund status with failure reason', async () => {
      (RefundRepository.findByStripeRefundId as jest.Mock).mockResolvedValue(mockRefund);
      (RefundRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...mockRefund,
        status: RefundStatus.FAILED,
        failure_reason: 'Insufficient funds',
      });

      const result = await RefundService.updateRefundStatus(
        tenantId,
        stripeRefundId,
        RefundStatus.FAILED,
        'Insufficient funds'
      );

      expect(result).toBeDefined();
      expect(RefundRepository.updateStatus).toHaveBeenCalledWith(
        mockRefund.id,
        tenantId,
        RefundStatus.FAILED,
        'Insufficient funds'
      );
    });

    it('should return null when refund not found', async () => {
      (RefundRepository.findByStripeRefundId as jest.Mock).mockResolvedValue(null);

      const result = await RefundService.updateRefundStatus(
        tenantId,
        stripeRefundId,
        RefundStatus.SUCCEEDED
      );

      expect(result).toBeNull();
      expect(RefundRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw error when repository fails', async () => {
      (RefundRepository.findByStripeRefundId as jest.Mock).mockResolvedValue(mockRefund);
      (RefundRepository.updateStatus as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        RefundService.updateRefundStatus(tenantId, stripeRefundId, RefundStatus.SUCCEEDED)
      ).rejects.toThrow('Database error');
    });
  });
});
