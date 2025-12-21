/**
 * Invoice Service Unit Tests
 * Tests business logic for invoice operations
 */

import { InvoiceStatus } from '../../src/models/invoice.model';
import { NotFoundError, ValidationError } from '@shared/middleware/error-handler';

// Mock dependencies
jest.mock('@shared/database/connection');
jest.mock('@shared/utils/logger');

// Import after mocks
import * as dbConnection from '@shared/database/connection';
import { InvoiceService } from '../../src/services/invoice.service';

describe('Invoice Service', () => {
  const mockQuery = dbConnection.query as jest.MockedFunction<typeof dbConnection.query>;
  const mockQueryOne = dbConnection.queryOne as jest.MockedFunction<typeof dbConnection.queryOne>;

  let invoiceService: InvoiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService = new InvoiceService();
  });

  describe('getInvoicesByTenant', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174001';
    const mockInvoices = [
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        tenantId,
        subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
        invoiceNumber: 'INV-20251028-0001',
        subtotal: 49.99,
        taxAmount: 5.00,
        totalAmount: 54.99,
        status: InvoiceStatus.OPEN,
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it('should retrieve all invoices for tenant', async () => {
      mockQuery.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoicesByTenant(tenantId);

      expect(result).toEqual(mockInvoices);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        [tenantId]
      );
    });

    it('should filter invoices by status', async () => {
      mockQuery.mockResolvedValue([mockInvoices[0]]);

      const result = await invoiceService.getInvoicesByTenant(tenantId, {
        status: InvoiceStatus.OPEN,
      });

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        [tenantId, InvoiceStatus.OPEN]
      );
    });

    it('should filter invoices by subscription ID', async () => {
      const subscriptionId = '123e4567-e89b-12d3-a456-426614174003';
      mockQuery.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoicesByTenant(tenantId, {
        subscriptionId,
      });

      expect(result).toEqual(mockInvoices);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND subscription_id'),
        expect.arrayContaining([tenantId, subscriptionId])
      );
    });

    it('should filter invoices by date range', async () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-12-31');
      mockQuery.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoicesByTenant(tenantId, {
        periodStart,
        periodEnd,
      });

      expect(result).toEqual(mockInvoices);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('period_start >='),
        expect.arrayContaining([tenantId, periodStart, periodEnd])
      );
    });

    it('should return empty array when no invoices found', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await invoiceService.getInvoicesByTenant(tenantId);

      expect(result).toEqual([]);
    });

    it('should throw error when database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(invoiceService.getInvoicesByTenant(tenantId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getInvoiceById', () => {
    const invoiceId = '123e4567-e89b-12d3-a456-426614174004';
    const mockInvoice = {
      id: invoiceId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      invoiceNumber: 'INV-20251028-0001',
      subtotal: 49.99,
      taxAmount: 5.00,
      totalAmount: 54.99,
      status: InvoiceStatus.OPEN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should retrieve invoice by ID successfully', async () => {
      mockQueryOne.mockResolvedValue(mockInvoice);

      const result = await invoiceService.getInvoiceById(invoiceId);

      expect(result).toEqual(mockInvoice);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM invoices WHERE id = $1'),
        [invoiceId]
      );
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(invoiceService.getInvoiceById(invoiceId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw error when database query fails', async () => {
      mockQueryOne.mockRejectedValue(new Error('Database error'));

      await expect(invoiceService.getInvoiceById(invoiceId))
        .rejects.toThrow();
    });
  });

  describe('createInvoice', () => {
    const validCreateData = {
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      notes: 'Test invoice',
    };

    const mockCreatedInvoice = {
      id: '123e4567-e89b-12d3-a456-426614174004',
      ...validCreateData,
      invoiceNumber: 'INV-20251028-0001',
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      amountDue: 0,
      amountPaid: 0,
      status: InvoiceStatus.DRAFT,
      issueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create invoice successfully', async () => {
      // Mock generateInvoiceNumber queryOne call
      mockQueryOne.mockResolvedValueOnce({ count: '0' });
      // Mock createInvoice INSERT queryOne call
      mockQueryOne.mockResolvedValueOnce(mockCreatedInvoice);

      const result = await invoiceService.createInvoice(validCreateData);

      expect(result).toEqual(mockCreatedInvoice);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices'),
        expect.any(Array)
      );
    });

    it('should generate sequential invoice number', async () => {
      // Mock generateInvoiceNumber queryOne call
      mockQueryOne.mockResolvedValueOnce({ count: '5' });
      // Mock createInvoice INSERT queryOne call
      mockQueryOne.mockResolvedValueOnce(mockCreatedInvoice);

      await invoiceService.createInvoice(validCreateData);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        expect.any(Array)
      );
    });

    it('should throw error when database insertion fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(invoiceService.createInvoice(validCreateData))
        .rejects.toThrow();
    });
  });

  describe('finalizeInvoice', () => {
    const invoiceId = '123e4567-e89b-12d3-a456-426614174004';
    const mockDraftInvoice = {
      id: invoiceId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
      invoiceNumber: 'INV-20251028-0001',
      subtotal: 49.99,
      taxAmount: 5.00,
      discountAmount: 0,
      totalAmount: 54.99,
      amountDue: 54.99,
      amountPaid: 0,
      currency: 'USD',
      status: InvoiceStatus.DRAFT,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should finalize draft invoice successfully', async () => {
      // Mock getInvoiceById queryOne call
      mockQueryOne.mockResolvedValueOnce(mockDraftInvoice);
      // Mock updateInvoice queryOne call
      mockQueryOne.mockResolvedValueOnce({
        ...mockDraftInvoice,
        status: InvoiceStatus.OPEN,
        updatedAt: new Date().toISOString()
      });

      const result = await invoiceService.finalizeInvoice(invoiceId);

      expect(result.status).toBe(InvoiceStatus.OPEN);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.any(Array)
      );
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(invoiceService.finalizeInvoice(invoiceId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when invoice is not draft', async () => {
      const paidInvoice = { ...mockDraftInvoice, status: InvoiceStatus.PAID };
      mockQueryOne.mockResolvedValue(paidInvoice);

      await expect(invoiceService.finalizeInvoice(invoiceId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('voidInvoice', () => {
    const invoiceId = '123e4567-e89b-12d3-a456-426614174004';
    const mockOpenInvoice = {
      id: invoiceId,
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
      invoiceNumber: 'INV-20251028-0001',
      subtotal: 49.99,
      taxAmount: 5.00,
      discountAmount: 0,
      totalAmount: 54.99,
      amountDue: 54.99,
      amountPaid: 0,
      currency: 'USD',
      status: InvoiceStatus.OPEN,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should void invoice successfully', async () => {
      // Mock getInvoiceById queryOne call
      mockQueryOne.mockResolvedValueOnce(mockOpenInvoice);
      // Mock updateInvoice queryOne call
      mockQueryOne.mockResolvedValueOnce({
        ...mockOpenInvoice,
        status: InvoiceStatus.VOID,
        updatedAt: new Date().toISOString()
      });

      const result = await invoiceService.voidInvoice(invoiceId);

      expect(result.status).toBe(InvoiceStatus.VOID);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        expect.any(Array)
      );
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(invoiceService.voidInvoice(invoiceId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when trying to void paid invoice', async () => {
      const paidInvoice = { ...mockOpenInvoice, status: InvoiceStatus.PAID };
      mockQueryOne.mockResolvedValue(paidInvoice);

      await expect(invoiceService.voidInvoice(invoiceId))
        .rejects.toThrow(ValidationError);
    });
  });
});
