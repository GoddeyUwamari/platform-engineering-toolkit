/**
 * Invoice Service - Core CRUD only
 * Matches YOUR exact models
 */

import { query, queryOne } from '@shared/database/connection';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ValidationError } from '@shared/middleware/error-handler';
import {
  Invoice,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  InvoiceFilters,
  InvoiceStatus,
  INVOICE_COLUMNS,
  canBeVoided,
  isPaid,
  isDraft,
} from '../models/invoice.model';
import {
  InvoiceItem,
  CreateInvoiceItemDTO,
  INVOICE_ITEM_COLUMNS,
  buildInvoiceItem,
  calculateSubtotal,
  calculateTotalTax,
  calculateGrandTotal,
} from '../models/invoice-item.model';

// ============================================================================
// Types
// ============================================================================

interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

// ============================================================================
// Invoice Service
// ============================================================================

export class InvoiceService {
  
  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get invoices for tenant with filters
   */
  async getInvoicesByTenant(
    tenantId: string,
    filters?: InvoiceFilters
  ): Promise<Invoice[]> {
    try {
      let sql = `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE tenant_id = $1`;
      const params: any[] = [tenantId];
      let paramCount = 2;

      if (filters?.status) {
        sql += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters?.subscriptionId) {
        sql += ` AND subscription_id = $${paramCount}`;
        params.push(filters.subscriptionId);
        paramCount++;
      }

      if (filters?.periodStart) {
        sql += ` AND period_start >= $${paramCount}`;
        params.push(filters.periodStart);
        paramCount++;
      }

      if (filters?.periodEnd) {
        sql += ` AND period_end <= $${paramCount}`;
        params.push(filters.periodEnd);
        paramCount++;
      }

      if (filters?.isOverdue) {
        sql += ` AND due_date < CURRENT_TIMESTAMP AND status = 'open'`;
      }

      if (filters?.isPaid) {
        sql += ` AND status = 'paid'`;
      }

      if (filters?.isDraft) {
        sql += ` AND status = 'draft'`;
      }

      if (filters?.minAmount !== undefined) {
        sql += ` AND total_amount >= $${paramCount}`;
        params.push(filters.minAmount);
        paramCount++;
      }

      if (filters?.maxAmount !== undefined) {
        sql += ` AND total_amount <= $${paramCount}`;
        params.push(filters.maxAmount);
        paramCount++;
      }

      sql += ` ORDER BY issue_date DESC`;

      const invoices = await query<Invoice>(sql, params);

      logger.info('Fetched invoices for tenant', {
        tenantId,
        count: invoices.length,
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to fetch invoices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<Invoice> {
    try {
      const invoice = await queryOne<Invoice>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = $1`,
        [id]
      );

      if (!invoice) {
        throw new NotFoundError('Invoice');
      }

      return invoice;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      
      logger.error('Failed to fetch invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId: id,
      });
      throw error;
    }
  }

  /**
   * Get invoice with items
   */
  async getInvoiceWithItems(invoiceId: string): Promise<InvoiceWithItems> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      const items = await this.getInvoiceItems(invoiceId);

      return {
        ...invoice,
        items,
      };
    } catch (error) {
      logger.error('Failed to fetch invoice with items', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Get invoice items
   */
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    try {
      const items = await query<InvoiceItem>(
        `SELECT ${INVOICE_ITEM_COLUMNS} 
         FROM invoice_items 
         WHERE invoice_id = $1 
         ORDER BY created_at ASC`,
        [invoiceId]
      );

      return items;
    } catch (error) {
      logger.error('Failed to fetch invoice items', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    try {
      const invoice = await queryOne<Invoice>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE invoice_number = $1`,
        [invoiceNumber]
      );

      return invoice || null;
    } catch (error) {
      logger.error('Failed to fetch invoice by number', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceNumber,
      });
      throw error;
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(tenantId: string): Promise<Invoice[]> {
    return this.getInvoicesByTenant(tenantId, { isOverdue: true });
  }

  // ==========================================================================
  // CREATE METHODS
  // ==========================================================================

  /**
   * Create invoice
   */
  async createInvoice(data: CreateInvoiceDTO): Promise<Invoice> {
    try {
      const invoiceNumber = await this.generateInvoiceNumber(data.tenantId);
      const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();

      const invoice = await queryOne<Invoice>(
        `INSERT INTO invoices (
          tenant_id,
          subscription_id,
          invoice_number,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          amount_due,
          amount_paid,
          currency,
          status,
          period_start,
          period_end,
          issue_date,
          due_date,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING ${INVOICE_COLUMNS}`,
        [
          data.tenantId,
          data.subscriptionId || null,
          invoiceNumber,
          0, // Will be updated after adding items
          0,
          0,
          0,
          0,
          0,
          data.currency || 'USD',
          InvoiceStatus.DRAFT,
          data.periodStart,
          data.periodEnd,
          issueDate.toISOString(),
          new Date(data.dueDate).toISOString(),
          data.notes || null,
        ]
      );

      if (!invoice) {
        throw new Error('Failed to create invoice');
      }

      logger.info('Created invoice', {
        invoiceId: invoice.id,
        invoiceNumber,
        tenantId: data.tenantId,
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  /**
   * Add item to invoice and recalculate totals
   */
  async addInvoiceItem(
    invoiceId: string,
    itemData: CreateInvoiceItemDTO
  ): Promise<InvoiceItem> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      if (!isDraft(invoice)) {
        throw new ValidationError('Can only add items to draft invoices');
      }

      // Build item with calculations
      const itemToCreate = buildInvoiceItem(itemData);

      // Insert item
      const item = await queryOne<InvoiceItem>(
        `INSERT INTO invoice_items (
          invoice_id,
          description,
          item_type,
          quantity,
          unit_price,
          amount,
          tax_rate,
          tax_amount,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${INVOICE_ITEM_COLUMNS}`,
        [
          itemToCreate.invoiceId,
          itemToCreate.description,
          itemToCreate.itemType,
          itemToCreate.quantity,
          itemToCreate.unitPrice,
          itemToCreate.amount,
          itemToCreate.taxRate,
          itemToCreate.taxAmount,
          JSON.stringify(itemToCreate.metadata || {}),
        ]
      );

      if (!item) {
        throw new Error('Failed to create invoice item');
      }

      // Recalculate invoice totals
      await this.recalculateInvoiceTotals(invoiceId);

      logger.info('Added invoice item', {
        invoiceId,
        itemId: item.id,
      });

      return item;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to add invoice item', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Recalculate invoice totals from items
   */
  async recalculateInvoiceTotals(invoiceId: string): Promise<Invoice> {
    try {
      const items = await this.getInvoiceItems(invoiceId);

      const subtotal = calculateSubtotal(items);
      const taxAmount = calculateTotalTax(items);
      const totalAmount = calculateGrandTotal(items);

      return this.updateInvoice(invoiceId, {
        subtotal,
        taxAmount,
        totalAmount,
        amountDue: totalAmount,
      });
    } catch (error) {
      logger.error('Failed to recalculate invoice totals', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // UPDATE METHODS
  // ==========================================================================

  /**
   * Update invoice
   */
  async updateInvoice(
    invoiceId: string,
    updates: UpdateInvoiceDTO
  ): Promise<Invoice> {
    try {
      const fields: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${paramCount}`);
        params.push(updates.status);
        paramCount++;
      }

      if (updates.subtotal !== undefined) {
        fields.push(`subtotal = $${paramCount}`);
        params.push(updates.subtotal);
        paramCount++;
      }

      if (updates.taxAmount !== undefined) {
        fields.push(`tax_amount = $${paramCount}`);
        params.push(updates.taxAmount);
        paramCount++;
      }

      if (updates.discountAmount !== undefined) {
        fields.push(`discount_amount = $${paramCount}`);
        params.push(updates.discountAmount);
        paramCount++;
      }

      if (updates.totalAmount !== undefined) {
        fields.push(`total_amount = $${paramCount}`);
        params.push(updates.totalAmount);
        paramCount++;
      }

      if (updates.amountPaid !== undefined) {
        fields.push(`amount_paid = $${paramCount}`);
        params.push(updates.amountPaid);
        paramCount++;
      }

      if (updates.amountDue !== undefined) {
        fields.push(`amount_due = $${paramCount}`);
        params.push(updates.amountDue);
        paramCount++;
      }

      if (updates.dueDate !== undefined) {
        fields.push(`due_date = $${paramCount}`);
        params.push(new Date(updates.dueDate).toISOString());
        paramCount++;
      }

      if (updates.paidAt !== undefined) {
        fields.push(`paid_at = $${paramCount}`);
        params.push(updates.paidAt ? new Date(updates.paidAt).toISOString() : null);
        paramCount++;
      }

      if (updates.paymentMethod !== undefined) {
        fields.push(`payment_method = $${paramCount}`);
        params.push(updates.paymentMethod);
        paramCount++;
      }

      if (updates.paymentReference !== undefined) {
        fields.push(`payment_reference = $${paramCount}`);
        params.push(updates.paymentReference);
        paramCount++;
      }

      if (updates.notes !== undefined) {
        fields.push(`notes = $${paramCount}`);
        params.push(updates.notes);
        paramCount++;
      }

      if (updates.pdfUrl !== undefined) {
        fields.push(`pdf_url = $${paramCount}`);
        params.push(updates.pdfUrl);
        paramCount++;
      }

      if (updates.pdfGeneratedAt !== undefined) {
        fields.push(`pdf_generated_at = $${paramCount}`);
        params.push(updates.pdfGeneratedAt ? new Date(updates.pdfGeneratedAt).toISOString() : null);
        paramCount++;
      }

      if (fields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(invoiceId);

      const invoice = await queryOne<Invoice>(
        `UPDATE invoices 
         SET ${fields.join(', ')} 
         WHERE id = $${paramCount}
         RETURNING ${INVOICE_COLUMNS}`,
        params
      );

      if (!invoice) {
        throw new Error('Failed to update invoice');
      }

      return invoice;
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      logger.error('Failed to update invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Finalize draft invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ValidationError('Only draft invoices can be finalized');
      }

      const updated = await this.updateInvoice(invoiceId, {
        status: InvoiceStatus.OPEN,
      });

      logger.info('Finalized invoice', { invoiceId });

      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to finalize invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Record payment
   */
  async recordPayment(
    invoiceId: string,
    paymentAmount: number,
    paymentMethod?: string,
    paymentReference?: string
  ): Promise<Invoice> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      if (isPaid(invoice)) {
        throw new ValidationError('Invoice is already paid');
      }

      const newAmountPaid = invoice.amountPaid + paymentAmount;
      const newAmountDue = Math.max(0, invoice.totalAmount - newAmountPaid);
      const fullyPaid = newAmountDue === 0;

      const updates: UpdateInvoiceDTO = {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: fullyPaid ? InvoiceStatus.PAID : invoice.status,
      };

      if (fullyPaid) {
        updates.paidAt = new Date().toISOString();
      }

      if (paymentMethod) {
        updates.paymentMethod = paymentMethod;
      }

      if (paymentReference) {
        updates.paymentReference = paymentReference;
      }

      const updated = await this.updateInvoice(invoiceId, updates);

      logger.info('Recorded payment', {
        invoiceId,
        paymentAmount,
        fullyPaid,
      });

      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to record payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Void invoice
   */
  async voidInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      if (!canBeVoided(invoice)) {
        throw new ValidationError('Invoice cannot be voided');
      }

      const updated = await this.updateInvoice(invoiceId, {
        status: InvoiceStatus.VOID,
      });

      logger.info('Voided invoice', { invoiceId });

      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to void invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Mark invoice as uncollectible
   */
  async markUncollectible(invoiceId: string): Promise<Invoice> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      if (isPaid(invoice)) {
        throw new ValidationError('Paid invoices cannot be marked uncollectible');
      }

      const updated = await this.updateInvoice(invoiceId, {
        status: InvoiceStatus.UNCOLLECTIBLE,
      });

      logger.info('Marked invoice uncollectible', { invoiceId });

      return updated;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to mark invoice uncollectible', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');

    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM invoices
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM issue_date) = $2
         AND EXTRACT(MONTH FROM issue_date) = $3`,
      [tenantId, year, parseInt(month)]
    );

    const count = parseInt(result?.count || '0') + 1;
    const sequence = String(count).padStart(4, '0');

    return `INV-${year}${month}${day}-${sequence}`;
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const invoiceService = new InvoiceService();