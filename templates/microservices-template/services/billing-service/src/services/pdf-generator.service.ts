/**
 * PDF Generator Service
 * Generates professional invoice PDFs using PDFKit
 */

import PDFDocument from 'pdfkit';
import { logger } from '@shared/utils/logger';
import { NotFoundError } from '@shared/middleware/error-handler';
import { Invoice } from '../models/invoice.model';
import { InvoiceItem, InvoiceItemType } from '../models/invoice-item.model';
import { queryOne } from '@shared/database/connection';

// ============================================================================
// Types
// ============================================================================

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface TenantBranding {
  name: string;
  logoUrl?: string;
  billingEmail: string;
  address?: string;
  phone?: string;
  website?: string;
}

export interface PdfGeneratorOptions {
  includeLogo?: boolean;
  includeWatermark?: boolean;
  watermarkText?: string;
}

// ============================================================================
// PDF Generator Service
// ============================================================================

export class PdfGeneratorService {

  /**
   * Generate invoice PDF and return as Buffer
   */
  async generateInvoicePdf(
    invoice: InvoiceWithItems,
    options: PdfGeneratorOptions = {}
  ): Promise<Buffer> {
    try {
      logger.info('Generating PDF for invoice', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });

      // Fetch tenant branding information
      const tenantBranding = await this.fetchTenantBranding(invoice.tenantId);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: tenantBranding.name,
          Subject: `Invoice for ${this.formatDate(invoice.periodStart)} - ${this.formatDate(invoice.periodEnd)}`,
          Creator: 'CloudBill',
          Producer: 'CloudBill Billing Service',
        },
      });

      // Collect PDF data in buffer
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));

      // Generate PDF content
      this.generateHeader(doc, tenantBranding, invoice);
      this.generateInvoiceDetails(doc, invoice);
      this.generateLineItems(doc, invoice.items);
      this.generateTotals(doc, invoice);
      this.generatePaymentInfo(doc, invoice);
      this.generateFooter(doc, tenantBranding);

      // Add watermark if needed
      if (options.includeWatermark) {
        this.addWatermark(doc, options.watermarkText || invoice.status.toUpperCase());
      }

      // Finalize PDF
      doc.end();

      // Wait for PDF generation to complete
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => {
          const buffer = Buffer.concat(buffers);
          resolve(buffer);
        });
        doc.on('error', reject);
      });

      logger.info('Successfully generated PDF', {
        invoiceId: invoice.id,
        size: pdfBuffer.length,
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Failed to generate PDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
        invoiceId: invoice.id,
      });
      throw error;
    }
  }

  // ==========================================================================
  // PDF Generation Sections
  // ==========================================================================

  /**
   * Generate PDF header with company branding
   */
  private generateHeader(
    doc: PDFKit.PDFDocument,
    branding: TenantBranding,
    invoice: Invoice
  ): void {
    const pageWidth = doc.page.width - 100; // Account for margins

    // Company name (left side)
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(branding.name, 50, 50, { width: pageWidth / 2 });

    // Company contact info (left side)
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(branding.billingEmail, 50, 85);

    if (branding.phone) {
      doc.text(branding.phone, 50, 100);
    }

    if (branding.website) {
      doc.text(branding.website, 50, 115);
    }

    // "INVOICE" title (right side)
    doc
      .fontSize(32)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, 50, {
        width: pageWidth,
        align: 'right',
      });

    // Invoice number (right side)
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(invoice.invoiceNumber, 50, 95, {
        width: pageWidth,
        align: 'right',
      });

    // Status badge (right side, colored)
    const statusColor = this.getStatusColor(invoice.status);
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(statusColor)
      .text(invoice.status.toUpperCase(), 50, 115, {
        width: pageWidth,
        align: 'right',
      })
      .fillColor('#000000'); // Reset to black

    // Divider line
    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(50, 150)
      .lineTo(doc.page.width - 50, 150)
      .stroke();
  }

  /**
   * Generate invoice details section
   */
  private generateInvoiceDetails(
    doc: PDFKit.PDFDocument,
    invoice: Invoice
  ): void {
    const yPosition = 180;

    // Left column - Dates
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Issue Date:', 50, yPosition);
    doc
      .font('Helvetica')
      .text(this.formatDate(invoice.issueDate), 120, yPosition);

    doc
      .font('Helvetica-Bold')
      .text('Due Date:', 50, yPosition + 20);
    doc
      .font('Helvetica')
      .text(this.formatDate(invoice.dueDate), 120, yPosition + 20);

    if (invoice.paidAt) {
      doc
        .font('Helvetica-Bold')
        .text('Paid Date:', 50, yPosition + 40);
      doc
        .font('Helvetica')
        .text(this.formatDate(invoice.paidAt), 120, yPosition + 40);
    }

    // Right column - Billing Period
    const pageWidth = doc.page.width - 100;
    doc
      .font('Helvetica-Bold')
      .text('Billing Period:', 50, yPosition, {
        width: pageWidth,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .text(
        `${this.formatDate(invoice.periodStart)} - ${this.formatDate(invoice.periodEnd)}`,
        50,
        yPosition + 20,
        {
          width: pageWidth,
          align: 'right',
        }
      );

    // Currency
    doc
      .font('Helvetica-Bold')
      .text('Currency:', 50, yPosition + 40, {
        width: pageWidth,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .text(invoice.currency.toUpperCase(), 50, yPosition + 60, {
        width: pageWidth,
        align: 'right',
      });
  }

  /**
   * Generate line items table
   */
  private generateLineItems(
    doc: PDFKit.PDFDocument,
    items: InvoiceItem[]
  ): void {
    const tableTop = 280;

    // Table header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#333333');

    // Column headers
    doc.text('Description', 50, tableTop);
    doc.text('Qty', 350, tableTop, { width: 50, align: 'right' });
    doc.text('Unit Price', 410, tableTop, { width: 70, align: 'right' });
    doc.text('Amount', 490, tableTop, { width: 70, align: 'right' });

    // Header line
    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(doc.page.width - 50, tableTop + 15)
      .stroke();

    // Table rows
    let yPosition = tableTop + 25;
    doc.font('Helvetica').fillColor('#000000');

    items.forEach((item) => {
      // Check if we need a new page
      if (yPosition > doc.page.height - 200) {
        doc.addPage();
        yPosition = 50;
      }

      // Item description with type badge
      const typeLabel = this.getItemTypeLabel(item.itemType);
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text(`[${typeLabel}]`, 50, yPosition);

      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(item.description, 110, yPosition, { width: 230 });

      // Quantity
      doc.text(
        item.quantity.toString(),
        350,
        yPosition,
        { width: 50, align: 'right' }
      );

      // Unit price
      doc.text(
        this.formatCurrency(item.unitPrice, 'USD'),
        410,
        yPosition,
        { width: 70, align: 'right' }
      );

      // Amount
      doc.text(
        this.formatCurrency(item.amount, 'USD'),
        490,
        yPosition,
        { width: 70, align: 'right' }
      );

      // Show tax if applicable
      if (item.taxRate > 0) {
        yPosition += 15;
        doc
          .fontSize(8)
          .fillColor('#666666')
          .text(
            `Tax (${item.taxRate.toFixed(2)}%): ${this.formatCurrency(item.taxAmount, 'USD')}`,
            110,
            yPosition
          )
          .fillColor('#000000');
      }

      yPosition += 25;
    });

    // Bottom line
    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(50, yPosition)
      .lineTo(doc.page.width - 50, yPosition)
      .stroke();
  }

  /**
   * Generate totals section
   */
  private generateTotals(
    doc: PDFKit.PDFDocument,
    invoice: Invoice
  ): void {
    const pageHeight = doc.page.height;

    // Position totals at bottom right
    let yPosition = pageHeight - 250;

    doc.fontSize(10).font('Helvetica');

    // Subtotal
    doc.text('Subtotal:', 400, yPosition, { width: 90, align: 'right' });
    doc.text(
      this.formatCurrency(invoice.subtotal, invoice.currency),
      490,
      yPosition,
      { width: 70, align: 'right' }
    );

    // Tax
    yPosition += 20;
    doc.text('Tax:', 400, yPosition, { width: 90, align: 'right' });
    doc.text(
      this.formatCurrency(invoice.taxAmount, invoice.currency),
      490,
      yPosition,
      { width: 70, align: 'right' }
    );

    // Discount (if any)
    if (invoice.discountAmount > 0) {
      yPosition += 20;
      doc
        .fillColor('#ff0000')
        .text('Discount:', 400, yPosition, { width: 90, align: 'right' });
      doc.text(
        `-${this.formatCurrency(invoice.discountAmount, invoice.currency)}`,
        490,
        yPosition,
        { width: 70, align: 'right' }
      )
        .fillColor('#000000');
    }

    // Total line
    yPosition += 10;
    doc
      .strokeColor('#000000')
      .lineWidth(2)
      .moveTo(400, yPosition)
      .lineTo(doc.page.width - 50, yPosition)
      .stroke();

    // Total amount
    yPosition += 15;
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Total:', 400, yPosition, { width: 90, align: 'right' });
    doc.text(
      this.formatCurrency(invoice.totalAmount, invoice.currency),
      490,
      yPosition,
      { width: 70, align: 'right' }
    );

    // Amount paid (if any)
    if (invoice.amountPaid > 0) {
      yPosition += 25;
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#00aa00')
        .text('Amount Paid:', 400, yPosition, { width: 90, align: 'right' });
      doc.text(
        this.formatCurrency(invoice.amountPaid, invoice.currency),
        490,
        yPosition,
        { width: 70, align: 'right' }
      )
        .fillColor('#000000');

      // Amount due
      yPosition += 20;
      doc
        .font('Helvetica-Bold')
        .fillColor(invoice.amountDue > 0 ? '#ff0000' : '#00aa00')
        .text('Amount Due:', 400, yPosition, { width: 90, align: 'right' });
      doc.text(
        this.formatCurrency(invoice.amountDue, invoice.currency),
        490,
        yPosition,
        { width: 70, align: 'right' }
      )
        .fillColor('#000000');
    }
  }

  /**
   * Generate payment information section
   */
  private generatePaymentInfo(
    doc: PDFKit.PDFDocument,
    invoice: Invoice
  ): void {
    const pageHeight = doc.page.height;
    let yPosition = pageHeight - 150;

    // Payment method
    if (invoice.paymentMethod) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Payment Method:', 50, yPosition);
      doc
        .font('Helvetica')
        .text(this.formatPaymentMethod(invoice.paymentMethod), 150, yPosition);
      yPosition += 20;
    }

    // Payment reference
    if (invoice.paymentReference) {
      doc
        .font('Helvetica-Bold')
        .text('Payment Reference:', 50, yPosition);
      doc.font('Helvetica').text(invoice.paymentReference, 150, yPosition);
      yPosition += 20;
    }

    // Notes
    if (invoice.notes) {
      yPosition += 10;
      doc
        .font('Helvetica-Bold')
        .text('Notes:', 50, yPosition);
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(invoice.notes, 50, yPosition + 15, {
          width: 500,
          align: 'left',
        });
    }
  }

  /**
   * Generate footer with metadata
   */
  private generateFooter(
    doc: PDFKit.PDFDocument,
    branding: TenantBranding
  ): void {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width - 100;

    // Footer line
    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(50, pageHeight - 80)
      .lineTo(doc.page.width - 50, pageHeight - 80)
      .stroke();

    // Footer text
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        `Generated on ${this.formatDateTime(new Date())} | ${branding.name}`,
        50,
        pageHeight - 65,
        {
          width: pageWidth,
          align: 'center',
        }
      );

    // Contact info
    doc.text(
      `Questions? Contact us at ${branding.billingEmail}`,
      50,
      pageHeight - 50,
      {
        width: pageWidth,
        align: 'center',
      }
    );

    // Page number
    const currentPage = (doc as any)._pageBuffer.length;
    doc.text(
      `Page ${currentPage}`,
      50,
      pageHeight - 30,
      {
        width: pageWidth,
        align: 'center',
      }
    )
      .fillColor('#000000');
  }

  /**
   * Add watermark to PDF
   */
  private addWatermark(doc: PDFKit.PDFDocument, text: string): void {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    doc
      .save()
      .fontSize(80)
      .font('Helvetica-Bold')
      .fillColor('#eeeeee')
      .opacity(0.3)
      .rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] })
      .text(text, 0, pageHeight / 2 - 40, {
        width: pageWidth,
        align: 'center',
      })
      .restore();
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Fetch tenant branding information
   */
  private async fetchTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      const result = await queryOne<{
        name: string;
        billingEmail: string;
        settings: any;
      }>(
        `SELECT name, billing_email as "billingEmail", settings
         FROM tenants
         WHERE id = $1`,
        [tenantId]
      );

      if (!result) {
        throw new NotFoundError('Tenant');
      }

      return {
        name: result.name,
        billingEmail: result.billingEmail,
        logoUrl: result.settings?.logoUrl,
        address: result.settings?.address,
        phone: result.settings?.phone,
        website: result.settings?.website,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;

      logger.error('Failed to fetch tenant branding', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
      });

      // Return default branding if tenant fetch fails
      return {
        name: 'CloudBill',
        billingEmail: 'billing@cloudbill.com',
      };
    }
  }

  /**
   * Get color for invoice status
   */
  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'paid':
        return '#00aa00';
      case 'open':
        return '#0066cc';
      case 'draft':
        return '#666666';
      case 'void':
        return '#999999';
      case 'uncollectible':
        return '#ff0000';
      default:
        return '#000000';
    }
  }

  /**
   * Get label for invoice item type
   */
  private getItemTypeLabel(itemType: string): string {
    switch (itemType.toLowerCase()) {
      case InvoiceItemType.SUBSCRIPTION:
        return 'Subscription';
      case InvoiceItemType.USAGE:
        return 'Usage';
      case InvoiceItemType.CREDIT:
        return 'Credit';
      case InvoiceItemType.FEE:
        return 'Fee';
      case InvoiceItemType.DISCOUNT:
        return 'Discount';
      default:
        return 'Item';
    }
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);
    } catch {
      return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Format date
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format date and time
   */
  private formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const pdfGeneratorService = new PdfGeneratorService();
