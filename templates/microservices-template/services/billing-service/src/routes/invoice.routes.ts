/**
 * Invoice Routes
 * RESTful API endpoints for core invoice management
 * 
 * Base path: /api/v1/invoices
 */

import { Router, Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';
import { logger } from '@shared/utils/logger';
import { 
  NotFoundError, 
  ValidationError,
} from '@shared/middleware/error-handler';
import { 
  InvoiceStatus,
  InvoiceFilters,
  CreateInvoiceDTO,
} from '../models/invoice.model';
import {
  CreateInvoiceItemDTO,
} from '../models/invoice-item.model';

const router = Router();

// ============================================================================
// QUERY ROUTES
// ============================================================================

/**
 * GET /api/billing/invoices
 * Get all invoices for the authenticated tenant with optional filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenantId from tenant middleware (set by resolveTenant())
      const tenantId = (req as any).tenantId;

      if (!tenantId) {
        throw new ValidationError('Tenant ID not found in request context');
      }

      // Parse query filters
      const filters: InvoiceFilters = {};

      if (req.query.status) {
        filters.status = req.query.status as InvoiceStatus;
      }

      if (req.query.subscriptionId) {
        filters.subscriptionId = req.query.subscriptionId as string;
      }

      if (req.query.isOverdue === 'true') {
        filters.isOverdue = true;
      }

      if (req.query.isPaid === 'true') {
        filters.isPaid = true;
      }

      if (req.query.isDraft === 'true') {
        filters.isDraft = true;
      }

      if (req.query.periodStart) {
        filters.periodStart = new Date(req.query.periodStart as string);
      }

      if (req.query.periodEnd) {
        filters.periodEnd = new Date(req.query.periodEnd as string);
      }

      if (req.query.minAmount) {
        filters.minAmount = parseFloat(req.query.minAmount as string);
      }

      if (req.query.maxAmount) {
        filters.maxAmount = parseFloat(req.query.maxAmount as string);
      }

      // Parse limit and offset for pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

      let invoices = await invoiceService.getInvoicesByTenant(tenantId, filters);

      // Apply pagination if specified
      if (offset !== undefined) {
        invoices = invoices.slice(offset);
      }
      if (limit !== undefined) {
        invoices = invoices.slice(0, limit);
      }

      logger.info('Retrieved invoices for authenticated tenant', {
        tenantId,
        count: invoices.length,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/invoices/tenant/:tenantId
 * Get all invoices for a tenant with optional filters
 */
router.get(
  '/tenant/:tenantId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      
      if (!tenantId) {
        throw new ValidationError('tenantId is required');
      }
      
      // Parse query filters
      const filters: InvoiceFilters = {};
      
      if (req.query.status) {
        filters.status = req.query.status as InvoiceStatus;
      }
      
      if (req.query.subscriptionId) {
        filters.subscriptionId = req.query.subscriptionId as string;
      }
      
      if (req.query.isOverdue === 'true') {
        filters.isOverdue = true;
      }
      
      if (req.query.isPaid === 'true') {
        filters.isPaid = true;
      }
      
      if (req.query.isDraft === 'true') {
        filters.isDraft = true;
      }
      
      if (req.query.periodStart) {
        filters.periodStart = new Date(req.query.periodStart as string);
      }
      
      if (req.query.periodEnd) {
        filters.periodEnd = new Date(req.query.periodEnd as string);
      }
      
      if (req.query.minAmount) {
        filters.minAmount = parseFloat(req.query.minAmount as string);
      }
      
      if (req.query.maxAmount) {
        filters.maxAmount = parseFloat(req.query.maxAmount as string);
      }

      const invoices = await invoiceService.getInvoicesByTenant(tenantId, filters);

      logger.info('Retrieved invoices for tenant', {
        tenantId,
        count: invoices.length,
      });

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/invoices/:id
 * Get invoice by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const invoice = await invoiceService.getInvoiceById(id);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/invoices/:id/items
 * Get invoice with line items
 */
router.get(
  '/:id/items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const invoiceWithItems = await invoiceService.getInvoiceWithItems(id);

      res.json({
        success: true,
        data: invoiceWithItems,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/invoices/number/:invoiceNumber
 * Get invoice by invoice number
 */
router.get(
  '/number/:invoiceNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invoiceNumber } = req.params;
      
      if (!invoiceNumber) {
        throw new ValidationError('invoiceNumber is required');
      }
      
      const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber);

      if (!invoice) {
        throw new NotFoundError('Invoice');
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/invoices/tenant/:tenantId/overdue
 * Get overdue invoices for tenant
 */
router.get(
  '/tenant/:tenantId/overdue',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;
      
      if (!tenantId) {
        throw new ValidationError('tenantId is required');
      }
      
      const invoices = await invoiceService.getOverdueInvoices(tenantId);

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// CREATE ROUTES
// ============================================================================

/**
 * POST /api/v1/invoices
 * Create a new invoice
 */
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoiceData: CreateInvoiceDTO = req.body;

      // UUID validation regex
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Validate required fields
      if (!invoiceData.tenantId) {
        throw new ValidationError('tenantId is required');
      }

      // Validate tenantId format
      if (!uuidRegex.test(invoiceData.tenantId)) {
        throw new ValidationError('tenantId must be a valid UUID');
      }

      if (!invoiceData.periodStart) {
        throw new ValidationError('periodStart is required');
      }

      if (!invoiceData.periodEnd) {
        throw new ValidationError('periodEnd is required');
      }

      if (!invoiceData.dueDate) {
        throw new ValidationError('dueDate is required');
      }

      const invoice = await invoiceService.createInvoice(invoiceData);

      logger.info('Created invoice via API', {
        invoiceId: invoice.id,
        tenantId: invoiceData.tenantId,
      });

      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Invoice created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/invoices/:id/items
 * Add line item to invoice
 */
router.post(
  '/:id/items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const itemData: CreateInvoiceItemDTO = req.body;

      // Validate required fields
      if (!itemData.description) {
        throw new ValidationError('description is required');
      }

      if (!itemData.itemType) {
        throw new ValidationError('itemType is required');
      }

      if (itemData.quantity === undefined || itemData.quantity <= 0) {
        throw new ValidationError('quantity must be greater than 0');
      }

      if (itemData.unitPrice === undefined) {
        throw new ValidationError('unitPrice is required');
      }

      // Set invoiceId from URL param
      itemData.invoiceId = id;

      const item = await invoiceService.addInvoiceItem(id, itemData);

      logger.info('Added invoice item via API', {
        invoiceId: id,
        itemId: item.id,
      });

      res.status(201).json({
        success: true,
        data: item,
        message: 'Invoice item added successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

/**
 * POST /api/v1/invoices/:id/payment
 * Record a payment for an invoice
 */
router.post(
  '/:id/payment',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const { paymentAmount, paymentMethod, paymentReference } = req.body;

      if (!paymentAmount || paymentAmount <= 0) {
        throw new ValidationError('Valid payment amount is required');
      }

      const invoice = await invoiceService.recordPayment(
        id,
        paymentAmount,
        paymentMethod,
        paymentReference
      );

      const fullyPaid = invoice.amountDue === 0;

      logger.info('Recorded payment via API', {
        invoiceId: id,
        paymentAmount,
        fullyPaid,
      });

      res.json({
        success: true,
        data: invoice,
        message: fullyPaid 
          ? 'Payment recorded - Invoice paid in full' 
          : 'Partial payment recorded',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// LIFECYCLE ROUTES
// ============================================================================

/**
 * POST /api/v1/invoices/:id/finalize
 * Finalize a draft invoice
 */
router.post(
  '/:id/finalize',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const invoice = await invoiceService.finalizeInvoice(id);

      logger.info('Finalized invoice via API', {
        invoiceId: id,
      });

      res.json({
        success: true,
        data: invoice,
        message: 'Invoice finalized',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/invoices/:id/void
 * Void an invoice
 */
router.post(
  '/:id/void',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const invoice = await invoiceService.voidInvoice(id);

      logger.info('Voided invoice via API', {
        invoiceId: id,
      });

      res.json({
        success: true,
        data: invoice,
        message: 'Invoice voided',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/invoices/:id/uncollectible
 * Mark invoice as uncollectible
 */
router.post(
  '/:id/uncollectible',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('id is required');
      }
      const invoice = await invoiceService.markUncollectible(id);

      logger.info('Marked invoice as uncollectible via API', {
        invoiceId: id,
      });

      res.json({
        success: true,
        data: invoice,
        message: 'Invoice marked as uncollectible',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;