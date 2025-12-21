import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ValidationError, asyncHandler } from '@shared/middleware/error-handler';
import { PaymentMethodService } from '../services/payment-method.service';
import { CreatePaymentMethodRequest, UpdatePaymentMethodRequest } from '../types/payment.types';

/**
 * Payment Method Controller
 * Handles HTTP requests for payment method endpoints
 */

export class PaymentMethodController {
  /**
   * Create a new payment method
   * POST /api/payments/methods
   */
  public static createPaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const { stripe_customer_id, type, card, billing_details, is_default } = req.body;

      // Validate required fields
      if (!stripe_customer_id) {
        throw new ValidationError('Stripe customer ID is required');
      }

      if (!type) {
        throw new ValidationError('Payment method type is required');
      }

      const data: CreatePaymentMethodRequest = {
        type,
        card,
        billing_details,
        is_default,
      };

      const paymentMethod = await PaymentMethodService.createPaymentMethod(
        tenantId,
        stripe_customer_id,
        data
      );

      logger.info('Payment method created via controller', {
        tenantId,
        paymentMethodId: paymentMethod.id,
        type,
      });

      res.status(201).json({
        success: true,
        data: paymentMethod,
        message: 'Payment method created successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get payment method by ID
   * GET /api/payments/methods/:id
   */
  public static getPaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentMethodId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentMethodId) {
        throw new ValidationError('Payment method ID is required');
      }

      const paymentMethod = await PaymentMethodService.getPaymentMethodById(
        tenantId,
        paymentMethodId
      );

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          message: 'Payment method not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: paymentMethod,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * List payment methods
   * GET /api/payments/methods
   */
  public static listPaymentMethods = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as any;
      const is_default = req.query.is_default === 'true' ? true : undefined;

      const paymentMethods = await PaymentMethodService.listPaymentMethods(tenantId, {
        limit,
        offset,
        type,
        is_default,
      });

      res.status(200).json({
        success: true,
        data: paymentMethods,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Update payment method
   * PATCH /api/payments/methods/:id
   */
  public static updatePaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentMethodId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentMethodId) {
        throw new ValidationError('Payment method ID is required');
      }

      const { billing_details, is_default } = req.body;

      const data: UpdatePaymentMethodRequest = {
        billing_details,
        is_default,
      };

      const paymentMethod = await PaymentMethodService.updatePaymentMethod(
        tenantId,
        paymentMethodId,
        data
      );

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          message: 'Payment method not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('Payment method updated via controller', {
        tenantId,
        paymentMethodId,
      });

      res.status(200).json({
        success: true,
        data: paymentMethod,
        message: 'Payment method updated successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Delete payment method
   * DELETE /api/payments/methods/:id
   */
  public static deletePaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentMethodId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentMethodId) {
        throw new ValidationError('Payment method ID is required');
      }

      const deleted = await PaymentMethodService.deletePaymentMethod(tenantId, paymentMethodId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Payment method not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('Payment method deleted via controller', {
        tenantId,
        paymentMethodId,
      });

      res.status(200).json({
        success: true,
        message: 'Payment method deleted successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Set payment method as default
   * POST /api/payments/methods/:id/default
   */
  public static setDefaultPaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentMethodId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentMethodId) {
        throw new ValidationError('Payment method ID is required');
      }

      const paymentMethod = await PaymentMethodService.setDefaultPaymentMethod(
        tenantId,
        paymentMethodId
      );

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          message: 'Payment method not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('Payment method set as default via controller', {
        tenantId,
        paymentMethodId,
      });

      res.status(200).json({
        success: true,
        data: paymentMethod,
        message: 'Payment method set as default successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get default payment method
   * GET /api/payments/methods/default
   */
  public static getDefaultPaymentMethod = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const paymentMethod = await PaymentMethodService.getDefaultPaymentMethod(tenantId);

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          message: 'No default payment method found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: paymentMethod,
        timestamp: new Date().toISOString(),
      });
    }
  );
}
