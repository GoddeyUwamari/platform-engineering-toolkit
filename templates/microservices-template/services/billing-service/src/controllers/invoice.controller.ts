import { Request, Response } from 'express';
import { logger } from '@shared/utils/logger';
import { ApiResponse } from '@shared/types';
import {
  ValidationError,
  NotFoundError,
  asyncHandler,
} from '@shared/middleware/error-handler';
import { invoiceService } from '../services/invoice.service';
import { pdfGeneratorService } from '../services/pdf-generator.service';
import {
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  InvoiceFilters,
  InvoiceStatus,
} from '../models/invoice.model';
import {
  CreateInvoiceItemDTO,
  InvoiceItemType,
} from '../models/invoice-item.model';
// Import express type augmentation
import '../types/express-augmentation';

/**
 * Invoice Controller
 * Handles HTTP requests for invoice endpoints
 */

export class InvoiceController {
  /**
   * Create a new invoice
   * POST /api/billing/invoices
   */
  public static createInvoice = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { subscriptionId, periodStart, periodEnd, dueDate, currency, notes } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      // Validate authentication
      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      // Validate required fields
      if (!periodStart || !periodEnd || !dueDate) {
        throw new ValidationError('Missing required fields', {
          periodStart: !periodStart ? 'Period start is required' : undefined,
          periodEnd: !periodEnd ? 'Period end is required' : undefined,
          dueDate: !dueDate ? 'Due date is required' : undefined,
        });
      }

      // Validate period
      if (new Date(periodEnd) <= new Date(periodStart)) {
        throw new ValidationError('Period end must be after period start');
      }

      // Create invoice DTO
      const invoiceData: CreateInvoiceDTO = {
        tenantId,
        subscriptionId,
        periodStart,
        periodEnd,
        dueDate,
        currency,
        notes,
      };

      // Create invoice
      const invoice = await invoiceService.createInvoice(invoiceData);

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Invoice created successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice created', {
        invoiceId: invoice.id,
        tenantId,
        userId,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Get invoices for the tenant
   * GET /api/billing/invoices
   */
  public static getInvoices = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Parse filters from query
      const filters: InvoiceFilters = {
        status: req.query.status as InvoiceStatus,
        subscriptionId: req.query.subscriptionId as string,
        periodStart: req.query.periodStart as string,
        periodEnd: req.query.periodEnd as string,
        isOverdue: req.query.isOverdue === 'true',
        isPaid: req.query.isPaid === 'true',
        isDraft: req.query.isDraft === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      // Get invoices
      const invoices = await invoiceService.getInvoicesByTenant(tenantId, filters);

      const response: ApiResponse = {
        success: true,
        data: {
          invoices,
          count: invoices.length,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoices retrieved', {
        tenantId,
        count: invoices.length,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get a specific invoice by ID
   * GET /api/billing/invoices/:id
   */
  public static getInvoiceById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice
      const invoice = await invoiceService.getInvoiceById(id);

      // Verify tenant ownership
      if (invoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice retrieved', {
        invoiceId: id,
        tenantId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get invoice with line items
   * GET /api/billing/invoices/:id/items
   */
  public static getInvoiceWithItems = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice with items
      const invoice = await invoiceService.getInvoiceWithItems(id);

      // Verify tenant ownership
      if (invoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice with items retrieved', {
        invoiceId: id,
        tenantId,
        itemCount: invoice.items.length,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Update an invoice
   * PATCH /api/billing/invoices/:id
   */
  public static updateInvoice = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updates = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Validate at least one field to update
      if (Object.keys(updates).length === 0) {
        throw new ValidationError('At least one field is required to update');
      }

      // Create update DTO
      const updateData: UpdateInvoiceDTO = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.discountAmount !== undefined) updateData.discountAmount = updates.discountAmount;

      // Update invoice
      const invoice = await invoiceService.updateInvoice(id, updateData);

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Invoice updated successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice updated', {
        invoiceId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Add an item to an invoice
   * POST /api/billing/invoices/:id/items
   */
  public static addInvoiceItem = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { description, itemType, quantity, unitPrice, taxRate, metadata } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Validate required fields
      if (!description || !itemType || quantity === undefined || unitPrice === undefined) {
        throw new ValidationError('Missing required fields', {
          description: !description ? 'Description is required' : undefined,
          itemType: !itemType ? 'Item type is required' : undefined,
          quantity: quantity === undefined ? 'Quantity is required' : undefined,
          unitPrice: unitPrice === undefined ? 'Unit price is required' : undefined,
        });
      }

      // Validate item type
      if (!Object.values(InvoiceItemType).includes(itemType)) {
        throw new ValidationError('Invalid item type');
      }

      // Validate quantity and price
      if (quantity <= 0) {
        throw new ValidationError('Quantity must be greater than zero');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Create item DTO
      const itemData: CreateInvoiceItemDTO = {
        invoiceId: id,
        description,
        itemType,
        quantity,
        unitPrice,
        taxRate: taxRate || 0,
        metadata,
      };

      // Add item to invoice
      const item = await invoiceService.addInvoiceItem(id, itemData);

      // Get updated invoice
      const invoice = await invoiceService.getInvoiceById(id);

      const response: ApiResponse = {
        success: true,
        data: { item, invoice },
        message: 'Invoice item added successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice item added', {
        invoiceId: id,
        itemId: item.id,
        tenantId,
        userId,
      });

      res.status(201).json(response);
    }
  );

  /**
   * Finalize a draft invoice
   * POST /api/billing/invoices/:id/finalize
   */
  public static finalizeInvoice = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Finalize invoice
      const invoice = await invoiceService.finalizeInvoice(id);

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Invoice finalized successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice finalized', {
        invoiceId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Record a payment for an invoice
   * POST /api/billing/invoices/:id/payment
   */
  public static recordPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { amount, paymentMethod, paymentReference } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      if (!amount || amount <= 0) {
        throw new ValidationError('Valid payment amount is required');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Record payment
      const invoice = await invoiceService.recordPayment(
        id,
        amount,
        paymentMethod,
        paymentReference
      );

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Payment recorded successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Payment recorded', {
        invoiceId: id,
        amount,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Void an invoice
   * POST /api/billing/invoices/:id/void
   */
  public static voidInvoice = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Void invoice
      const invoice = await invoiceService.voidInvoice(id);

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Invoice voided successfully',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice voided', {
        invoiceId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Mark an invoice as uncollectible
   * POST /api/billing/invoices/:id/uncollectible
   */
  public static markUncollectible = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId || !userId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice to verify ownership
      const existingInvoice = await invoiceService.getInvoiceById(id);
      if (existingInvoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Mark uncollectible
      const invoice = await invoiceService.markUncollectible(id);

      const response: ApiResponse = {
        success: true,
        data: { invoice },
        message: 'Invoice marked as uncollectible',
        timestamp: new Date().toISOString(),
      };

      logger.info('Invoice marked uncollectible', {
        invoiceId: id,
        tenantId,
        userId,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Get overdue invoices for the tenant
   * GET /api/billing/invoices/overdue
   */
  public static getOverdueInvoices = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      // Get overdue invoices
      const invoices = await invoiceService.getOverdueInvoices(tenantId);

      const response: ApiResponse = {
        success: true,
        data: {
          invoices,
          count: invoices.length,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Overdue invoices retrieved', {
        tenantId,
        count: invoices.length,
      });

      res.status(200).json(response);
    }
  );

  /**
   * Generate PDF for an invoice
   * GET /api/billing/invoices/:id/pdf
   */
  public static generateInvoicePdf = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new ValidationError('User not authenticated');
      }

      if (!id) {
        throw new ValidationError('Invoice ID is required');
      }

      // Get invoice with items
      const invoice = await invoiceService.getInvoiceWithItems(id);

      // Verify tenant ownership
      if (invoice.tenantId !== tenantId) {
        throw new NotFoundError('Invoice');
      }

      // Generate PDF
      const includeWatermark = invoice.status === InvoiceStatus.DRAFT;
      const pdfBuffer = await pdfGeneratorService.generateInvoicePdf(invoice, {
        includeWatermark,
        watermarkText: invoice.status.toUpperCase(),
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
      );

      logger.info('Invoice PDF generated', {
        invoiceId: id,
        tenantId,
      });

      res.status(200).send(pdfBuffer);
    }
  );

  /**
   * Health check endpoint
   * GET /api/billing/invoices/health
   */
  public static healthCheck = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const response: ApiResponse = {
        success: true,
        data: {
          service: 'billing-service',
          endpoint: 'invoices',
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    }
  );
}
