import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ValidationError, asyncHandler } from '@shared/middleware/error-handler';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentIntentRequest, ConfirmPaymentRequest } from '../types/payment.types';

/**
 * Payment Controller
 * Handles HTTP requests for payment endpoints
 */

export class PaymentController {
  /**
   * Create a new payment intent
   * POST /api/payments/intents
   */
  public static createPaymentIntent = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const { amount, currency, invoice_id, subscription_id, payment_method_id, description, metadata, automatic_payment_methods } = req.body;

      // Validate required fields
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new ValidationError('Valid amount is required');
      }

      const data: CreatePaymentIntentRequest = {
        amount,
        currency: currency || 'usd',
        invoice_id,
        subscription_id,
        payment_method_id,
        description,
        metadata,
        automatic_payment_methods,
      };

      const paymentIntent = await PaymentService.createPaymentIntent(tenantId, data);

      logger.info('Payment intent created via controller', {
        tenantId,
        paymentIntentId: paymentIntent.id,
        amount,
      });

      res.status(201).json({
        success: true,
        data: paymentIntent,
        message: 'Payment intent created successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Confirm a payment intent
   * POST /api/payments/intents/:id/confirm
   */
  public static confirmPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentIntentId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentIntentId) {
        throw new ValidationError('Payment intent ID is required');
      }

      const { payment_method_id, return_url } = req.body;

      const data: ConfirmPaymentRequest = {
        payment_intent_id: paymentIntentId,
        payment_method_id,
        return_url,
      };

      const paymentIntent = await PaymentService.confirmPayment(tenantId, data);

      logger.info('Payment intent confirmed via controller', {
        tenantId,
        paymentIntentId,
      });

      res.status(200).json({
        success: true,
        data: paymentIntent,
        message: 'Payment confirmed successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Cancel a payment intent
   * POST /api/payments/intents/:id/cancel
   */
  public static cancelPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentIntentId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentIntentId) {
        throw new ValidationError('Payment intent ID is required');
      }

      const paymentIntent = await PaymentService.cancelPayment(tenantId, paymentIntentId);

      logger.info('Payment intent cancelled via controller', {
        tenantId,
        paymentIntentId,
      });

      res.status(200).json({
        success: true,
        data: paymentIntent,
        message: 'Payment cancelled successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get payment by ID
   * GET /api/payments/:id
   */
  public static getPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: paymentId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentId) {
        throw new ValidationError('Payment ID is required');
      }

      const payment = await PaymentService.getPaymentById(tenantId, paymentId);

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payment,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * List payments with filters
   * GET /api/payments
   */
  public static listPayments = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as any;
      const invoice_id = req.query.invoice_id as string;
      const subscription_id = req.query.subscription_id as string;

      const payments = await PaymentService.listPayments(tenantId, {
        limit,
        offset,
        status,
        invoice_id,
        subscription_id,
      });

      res.status(200).json({
        success: true,
        data: payments,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get payment statistics
   * GET /api/payments/stats
   */
  public static getPaymentStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const stats = await PaymentService.getPaymentStats(tenantId);

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    }
  );
}
