/**
 * Payment Method Service Unit Tests
 * Tests business logic for payment method operations with mocked Stripe
 */

// Mock dependencies
jest.mock('../../src/config/stripe.config');
jest.mock('../../src/repositories/payment-method.repository');
jest.mock('@shared/utils/logger');

import { PaymentMethodService } from '../../src/services/payment-method.service';
import { PaymentMethodRepository } from '../../src/repositories/payment-method.repository';
import { stripeConfig } from '../../src/config/stripe.config';
import { mockStripe, mockPaymentMethod } from '../helpers/mocks';
import { PaymentMethodType } from '../../src/types/payment.types';

describe('PaymentMethod Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (stripeConfig.getClient as jest.Mock).mockReturnValue(mockStripe);
  });

  describe('createPaymentMethod', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const stripeCustomerId = 'cus_mock_123';
    const validPaymentMethodData = {
      type: PaymentMethodType.CARD,
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
      },
      billing_details: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      is_default: false,
    };

    it('should create payment method successfully', async () => {
      (PaymentMethodRepository.create as jest.Mock).mockResolvedValue(mockPaymentMethod);

      const result = await PaymentMethodService.createPaymentMethod(
        tenantId,
        stripeCustomerId,
        validPaymentMethodData
      );

      expect(result).toHaveProperty('id');
      expect(result.type).toBe(PaymentMethodType.CARD);
      expect(mockStripe.paymentMethods.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'card',
          billing_details: validPaymentMethodData.billing_details,
        })
      );
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith(
        expect.any(String),
        { customer: stripeCustomerId }
      );
      expect(PaymentMethodRepository.create).toHaveBeenCalled();
    });

    it('should create payment method as default', async () => {
      const existingDefault = { ...mockPaymentMethod, id: 'existing-default-id' };
      (PaymentMethodRepository.findDefault as jest.Mock).mockResolvedValue(existingDefault);
      (PaymentMethodRepository.update as jest.Mock).mockResolvedValue(true);
      (PaymentMethodRepository.create as jest.Mock).mockResolvedValue({
        ...mockPaymentMethod,
        is_default: true,
      });

      const dataWithDefault = {
        ...validPaymentMethodData,
        is_default: true,
      };

      await PaymentMethodService.createPaymentMethod(
        tenantId,
        stripeCustomerId,
        dataWithDefault
      );

      expect(mockStripe.customers.update).toHaveBeenCalledWith(
        stripeCustomerId,
        expect.objectContaining({
          invoice_settings: {
            default_payment_method: expect.any(String),
          },
        })
      );
      expect(PaymentMethodRepository.update).toHaveBeenCalledWith(
        existingDefault.id,
        tenantId,
        { is_default: false }
      );
    });

    it('should create payment method without existing default', async () => {
      (PaymentMethodRepository.findDefault as jest.Mock).mockResolvedValue(null);
      (PaymentMethodRepository.create as jest.Mock).mockResolvedValue({
        ...mockPaymentMethod,
        is_default: true,
      });

      const dataWithDefault = {
        ...validPaymentMethodData,
        is_default: true,
      };

      await PaymentMethodService.createPaymentMethod(
        tenantId,
        stripeCustomerId,
        dataWithDefault
      );

      expect(mockStripe.customers.update).toHaveBeenCalled();
      expect(PaymentMethodRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when Stripe fails', async () => {
      mockStripe.paymentMethods.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentMethodService.createPaymentMethod(
          tenantId,
          stripeCustomerId,
          validPaymentMethodData
        )
      ).rejects.toThrow('Stripe error');
    });

    it('should include card details in Stripe request', async () => {
      (PaymentMethodRepository.create as jest.Mock).mockResolvedValue(mockPaymentMethod);

      await PaymentMethodService.createPaymentMethod(
        tenantId,
        stripeCustomerId,
        validPaymentMethodData
      );

      expect(mockStripe.paymentMethods.create).toHaveBeenCalledWith(
        expect.objectContaining({
          card: validPaymentMethodData.card,
        })
      );
    });
  });

  describe('getPaymentMethodById', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentMethodId = '123e4567-e89b-12d3-a456-426614174006';

    it('should retrieve payment method successfully', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);

      const result = await PaymentMethodService.getPaymentMethodById(tenantId, paymentMethodId);

      expect(result).toEqual(mockPaymentMethod);
      expect(PaymentMethodRepository.findById).toHaveBeenCalledWith(paymentMethodId, tenantId);
    });

    it('should return null when payment method not found', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await PaymentMethodService.getPaymentMethodById(tenantId, paymentMethodId);

      expect(result).toBeNull();
    });

    it('should throw error when repository fails', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentMethodService.getPaymentMethodById(tenantId, paymentMethodId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('listPaymentMethods', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should list payment methods without filters', async () => {
      const mockPaymentMethods = [mockPaymentMethod, { ...mockPaymentMethod, id: 'another-id' }];
      (PaymentMethodRepository.findAll as jest.Mock).mockResolvedValue(mockPaymentMethods);

      const result = await PaymentMethodService.listPaymentMethods(tenantId);

      expect(result).toEqual(mockPaymentMethods);
      expect(PaymentMethodRepository.findAll).toHaveBeenCalledWith(tenantId, {});
    });

    it('should list payment methods with filters', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      (PaymentMethodRepository.findAll as jest.Mock).mockResolvedValue(mockPaymentMethods);

      const filters = {
        type: PaymentMethodType.CARD,
        is_default: true,
      };

      const result = await PaymentMethodService.listPaymentMethods(tenantId, filters);

      expect(result).toEqual(mockPaymentMethods);
      expect(PaymentMethodRepository.findAll).toHaveBeenCalledWith(tenantId, filters);
    });

    it('should throw error when repository fails', async () => {
      (PaymentMethodRepository.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentMethodService.listPaymentMethods(tenantId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updatePaymentMethod', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentMethodId = '123e4567-e89b-12d3-a456-426614174006';

    it('should update payment method billing details', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      (PaymentMethodRepository.update as jest.Mock).mockResolvedValue({
        ...mockPaymentMethod,
        billing_details: { name: 'Jane Doe' },
      });

      const updateData = {
        billing_details: { name: 'Jane Doe' },
      };

      const result = await PaymentMethodService.updatePaymentMethod(
        tenantId,
        paymentMethodId,
        updateData
      );

      expect(result).toBeDefined();
      expect(mockStripe.paymentMethods.update).toHaveBeenCalledWith(
        mockPaymentMethod.stripe_payment_method_id,
        { billing_details: updateData.billing_details }
      );
    });

    it('should set payment method as default', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      (PaymentMethodRepository.setDefault as jest.Mock).mockResolvedValue(true);
      (PaymentMethodRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockPaymentMethod)
        .mockResolvedValueOnce({ ...mockPaymentMethod, is_default: true });

      const updateData = { is_default: true };

      const result = await PaymentMethodService.updatePaymentMethod(
        tenantId,
        paymentMethodId,
        updateData
      );

      expect(result).toBeDefined();
      expect(PaymentMethodRepository.setDefault).toHaveBeenCalledWith(paymentMethodId, tenantId);
      expect(mockStripe.customers.update).toHaveBeenCalled();
    });

    it('should return null when payment method not found', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(null);

      const updateData = { billing_details: { name: 'Jane Doe' } };

      const result = await PaymentMethodService.updatePaymentMethod(
        tenantId,
        paymentMethodId,
        updateData
      );

      expect(result).toBeNull();
    });

    it('should throw error when Stripe fails', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      mockStripe.paymentMethods.update.mockRejectedValue(new Error('Stripe error'));

      const updateData = { billing_details: { name: 'Jane Doe' } };

      await expect(
        PaymentMethodService.updatePaymentMethod(tenantId, paymentMethodId, updateData)
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('deletePaymentMethod', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentMethodId = '123e4567-e89b-12d3-a456-426614174006';

    it('should delete payment method successfully', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      (PaymentMethodRepository.delete as jest.Mock).mockResolvedValue(true);

      const result = await PaymentMethodService.deletePaymentMethod(tenantId, paymentMethodId);

      expect(result).toBe(true);
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith(
        mockPaymentMethod.stripe_payment_method_id
      );
      expect(PaymentMethodRepository.delete).toHaveBeenCalledWith(paymentMethodId, tenantId);
    });

    it('should return false when payment method not found', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await PaymentMethodService.deletePaymentMethod(tenantId, paymentMethodId);

      expect(result).toBe(false);
      expect(mockStripe.paymentMethods.detach).not.toHaveBeenCalled();
    });

    it('should throw error when Stripe fails', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      mockStripe.paymentMethods.detach.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentMethodService.deletePaymentMethod(tenantId, paymentMethodId)
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('setDefaultPaymentMethod', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';
    const paymentMethodId = '123e4567-e89b-12d3-a456-426614174006';

    it('should set payment method as default successfully', async () => {
      (PaymentMethodRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockPaymentMethod)
        .mockResolvedValueOnce({ ...mockPaymentMethod, is_default: true });
      (PaymentMethodRepository.setDefault as jest.Mock).mockResolvedValue(true);

      const result = await PaymentMethodService.setDefaultPaymentMethod(tenantId, paymentMethodId);

      expect(result).toBeDefined();
      expect(result?.is_default).toBe(true);
      expect(PaymentMethodRepository.setDefault).toHaveBeenCalledWith(paymentMethodId, tenantId);
      expect(mockStripe.customers.update).toHaveBeenCalledWith(
        mockPaymentMethod.stripe_customer_id,
        expect.objectContaining({
          invoice_settings: {
            default_payment_method: mockPaymentMethod.stripe_payment_method_id,
          },
        })
      );
    });

    it('should return null when payment method not found', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await PaymentMethodService.setDefaultPaymentMethod(tenantId, paymentMethodId);

      expect(result).toBeNull();
      expect(PaymentMethodRepository.setDefault).not.toHaveBeenCalled();
    });

    it('should throw error when Stripe fails', async () => {
      (PaymentMethodRepository.findById as jest.Mock).mockResolvedValue(mockPaymentMethod);
      (PaymentMethodRepository.setDefault as jest.Mock).mockResolvedValue(true);
      mockStripe.customers.update.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentMethodService.setDefaultPaymentMethod(tenantId, paymentMethodId)
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('getDefaultPaymentMethod', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174002';

    it('should retrieve default payment method', async () => {
      const defaultPaymentMethod = { ...mockPaymentMethod, is_default: true };
      (PaymentMethodRepository.findDefault as jest.Mock).mockResolvedValue(defaultPaymentMethod);

      const result = await PaymentMethodService.getDefaultPaymentMethod(tenantId);

      expect(result).toEqual(defaultPaymentMethod);
      expect(PaymentMethodRepository.findDefault).toHaveBeenCalledWith(tenantId);
    });

    it('should return null when no default payment method exists', async () => {
      (PaymentMethodRepository.findDefault as jest.Mock).mockResolvedValue(null);

      const result = await PaymentMethodService.getDefaultPaymentMethod(tenantId);

      expect(result).toBeNull();
    });

    it('should throw error when repository fails', async () => {
      (PaymentMethodRepository.findDefault as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentMethodService.getDefaultPaymentMethod(tenantId)
      ).rejects.toThrow('Database error');
    });
  });
});
