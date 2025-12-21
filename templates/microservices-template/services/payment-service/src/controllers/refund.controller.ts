import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ValidationError, asyncHandler } from '@shared/middleware/error-handler';
import { RefundService } from '../services/refund.service';
import { CreateRefundRequest } from '../types/payment.types';

/**
 * Refund Controller
 * Handles HTTP requests for refund endpoints
 */

export class RefundController {
  /**
   * Create a new refund
   * POST /api/payments/refunds
   */
  public static createRefund = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const { payment_id, amount, reason, metadata } = req.body;

      // Validate required fields
      if (!payment_id) {
        throw new ValidationError('Payment ID is required');
      }

      const data: CreateRefundRequest = {
        payment_id,
        amount,
        reason,
        metadata,
      };

      const refund = await RefundService.createRefund(tenantId, data);

      logger.info('Refund created via controller', {
        tenantId,
        refundId: refund.id,
        paymentId: payment_id,
        amount: amount || 'full',
      });

      res.status(201).json({
        success: true,
        data: refund,
        message: 'Refund created successfully',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get refund by ID
   * GET /api/payments/refunds/:id
   */
  public static getRefund = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { id: refundId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!refundId) {
        throw new ValidationError('Refund ID is required');
      }

      const refund = await RefundService.getRefundById(tenantId, refundId);

      if (!refund) {
        res.status(404).json({
          success: false,
          message: 'Refund not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: refund,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * List refunds with filters
   * GET /api/payments/refunds
   */
  public static listRefunds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const payment_id = req.query.payment_id as string;
      const status = req.query.status as any;

      const refunds = await RefundService.listRefunds(tenantId, {
        limit,
        offset,
        payment_id,
        status,
      });

      res.status(200).json({
        success: true,
        data: refunds,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * List refunds for a specific payment
   * GET /api/payments/:paymentId/refunds
   */
  public static listRefundsForPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;
      const { paymentId } = req.params;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!paymentId) {
        throw new ValidationError('Payment ID is required');
      }

      const refunds = await RefundService.listRefundsForPayment(tenantId, paymentId);

      res.status(200).json({
        success: true,
        data: refunds,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Get refund statistics
   * GET /api/payments/refunds/stats
   */
  public static getRefundStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      const stats = await RefundService.getRefundStats(tenantId);

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    }
  );
}
