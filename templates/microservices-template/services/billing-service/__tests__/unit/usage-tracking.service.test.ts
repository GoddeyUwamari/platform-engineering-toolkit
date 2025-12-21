/**
 * Usage Tracking Service Unit Tests
 * Tests business logic for usage tracking and aggregation
 */

// Mock dependencies
jest.mock('../../src/repositories/usage.repository');
jest.mock('@shared/utils/logger');

// Import after mocks
import { UsageTrackingService } from '../../src/services/usage-tracking.service';
import { UsageRepository } from '../../src/repositories/usage.repository';

describe('Usage Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    const validUsageData = {
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
      usageType: 'api_calls',
      quantity: 100,
      unit: 'requests',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      recordedAt: new Date(),
      metadata: {},
    };

    const mockCreatedUsageRecord = {
      id: '123e4567-e89b-12d3-a456-426614174006',
      ...validUsageData,
      createdAt: new Date().toISOString(),
    };

    it('should record usage event successfully', async () => {
      (UsageRepository.create as jest.Mock).mockResolvedValue(mockCreatedUsageRecord);

      const result = await UsageTrackingService.recordUsage(validUsageData);

      expect(result).toEqual(mockCreatedUsageRecord);
      expect(UsageRepository.create).toHaveBeenCalledWith(validUsageData);
    });

    it('should log debug and info messages', async () => {
      (UsageRepository.create as jest.Mock).mockResolvedValue(mockCreatedUsageRecord);

      await UsageTrackingService.recordUsage(validUsageData);

      expect(UsageRepository.create).toHaveBeenCalled();
    });

    it('should throw error when repository fails', async () => {
      (UsageRepository.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(UsageTrackingService.recordUsage(validUsageData))
        .rejects.toThrow('Database error');
    });

    it('should handle different usage types', async () => {
      const storageUsageData = {
        ...validUsageData,
        usageType: 'storage',
        unit: 'GB',
        quantity: 10.5,
      };

      (UsageRepository.create as jest.Mock).mockResolvedValue({
        ...mockCreatedUsageRecord,
        ...storageUsageData,
      });

      const result = await UsageTrackingService.recordUsage(storageUsageData);

      expect(result.usageType).toBe('storage');
      expect(result.unit).toBe('GB');
      expect(result.quantity).toBe(10.5);
    });
  });

  describe('recordBatchUsage', () => {
    const batchUsageData = [
      {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
        usageType: 'api_calls',
        quantity: 100,
        unit: 'requests',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        recordedAt: new Date(),
        metadata: {},
      },
      {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
        usageType: 'storage',
        quantity: 50,
        unit: 'GB',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        recordedAt: new Date(),
        metadata: {},
      },
    ];

    const mockCreatedRecords = batchUsageData.map((data, index) => ({
      id: `123e4567-e89b-12d3-a456-42661417400${index + 6}`,
      ...data,
      createdAt: new Date().toISOString(),
    }));

    it('should record batch usage events successfully', async () => {
      (UsageRepository.createBatch as jest.Mock).mockResolvedValue(mockCreatedRecords);

      const result = await UsageTrackingService.recordBatchUsage(batchUsageData);

      expect(result).toEqual(mockCreatedRecords);
      expect(result).toHaveLength(2);
      expect(UsageRepository.createBatch).toHaveBeenCalledWith(batchUsageData);
    });

    it('should throw error when batch creation fails', async () => {
      (UsageRepository.createBatch as jest.Mock).mockRejectedValue(new Error('Batch error'));

      await expect(UsageTrackingService.recordBatchUsage(batchUsageData))
        .rejects.toThrow('Batch error');
    });

    it('should handle empty batch', async () => {
      (UsageRepository.createBatch as jest.Mock).mockResolvedValue([]);

      const result = await UsageTrackingService.recordBatchUsage([]);

      expect(result).toEqual([]);
    });
  });

  describe('getUsageRecords', () => {
    const filters = {
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      subscriptionId: '123e4567-e89b-12d3-a456-426614174003',
    };

    const pagination = {
      page: 1,
      limit: 10,
    };

    const mockPaginatedResult = {
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174006',
          tenantId: filters.tenantId,
          subscriptionId: filters.subscriptionId,
          usageType: 'api_calls',
          quantity: 100,
          unit: 'requests',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it('should retrieve paginated usage records successfully', async () => {
      (UsageRepository.findWithPagination as jest.Mock).mockResolvedValue(mockPaginatedResult);

      const result = await UsageTrackingService.getUsageRecords(filters, pagination);

      expect(result).toEqual(mockPaginatedResult);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(UsageRepository.findWithPagination).toHaveBeenCalledWith(filters, pagination);
    });

    it('should return empty results when no records found', async () => {
      const emptyResult = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      (UsageRepository.findWithPagination as jest.Mock).mockResolvedValue(emptyResult);

      const result = await UsageTrackingService.getUsageRecords(filters, pagination);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should throw error when repository fails', async () => {
      (UsageRepository.findWithPagination as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(UsageTrackingService.getUsageRecords(filters, pagination))
        .rejects.toThrow('Database error');
    });

    it('should handle different page numbers', async () => {
      const page2Result = {
        ...mockPaginatedResult,
        pagination: { page: 2, limit: 10, total: 20, totalPages: 2 },
      };
      (UsageRepository.findWithPagination as jest.Mock).mockResolvedValue(page2Result);

      const result = await UsageTrackingService.getUsageRecords(filters, { page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe('getUsageRecordById', () => {
    const usageRecordId = '123e4567-e89b-12d3-a456-426614174006';
    const tenantId = '123e4567-e89b-12d3-a456-426614174001';

    const mockUsageRecord = {
      id: usageRecordId,
      tenantId,
      usageType: 'api_calls',
      quantity: 100,
      unit: 'requests',
      createdAt: new Date().toISOString(),
    };

    it('should retrieve usage record by ID successfully', async () => {
      (UsageRepository.findById as jest.Mock).mockResolvedValue(mockUsageRecord);

      const result = await UsageTrackingService.getUsageRecordById(usageRecordId, tenantId);

      expect(result).toEqual(mockUsageRecord);
      expect(UsageRepository.findById).toHaveBeenCalledWith(usageRecordId, tenantId);
    });

    it('should return null when usage record does not exist', async () => {
      (UsageRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await UsageTrackingService.getUsageRecordById(usageRecordId, tenantId);

      expect(result).toBeNull();
    });

    it('should throw error when repository fails', async () => {
      (UsageRepository.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(UsageTrackingService.getUsageRecordById(usageRecordId, tenantId))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateUsageRecord', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174001';
    const usageRecordId = '123e4567-e89b-12d3-a456-426614174006';
    const updateData = {
      quantity: 150,
      metadata: { updated: true },
    };

    const mockUpdatedRecord = {
      id: usageRecordId,
      tenantId,
      usageType: 'api_calls',
      quantity: 150,
      unit: 'requests',
      metadata: { updated: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should update usage record successfully', async () => {
      (UsageRepository.update as jest.Mock).mockResolvedValue(mockUpdatedRecord);

      const result = await UsageTrackingService.updateUsageRecord(tenantId, usageRecordId, updateData);

      expect(result).toEqual(mockUpdatedRecord);
      expect(result?.quantity).toBe(150);
      expect(UsageRepository.update).toHaveBeenCalledWith(tenantId, usageRecordId, updateData);
    });

    it('should throw error when update fails', async () => {
      (UsageRepository.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(UsageTrackingService.updateUsageRecord(tenantId, usageRecordId, updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteUsageRecord', () => {
    const usageRecordId = '123e4567-e89b-12d3-a456-426614174006';
    const tenantId = '123e4567-e89b-12d3-a456-426614174001';

    it('should delete usage record successfully', async () => {
      (UsageRepository.delete as jest.Mock).mockResolvedValue(true);

      const result = await UsageTrackingService.deleteUsageRecord(usageRecordId, tenantId);

      expect(result).toBe(true);
      expect(UsageRepository.delete).toHaveBeenCalledWith(usageRecordId, tenantId);
    });

    it('should return false when record does not exist', async () => {
      (UsageRepository.delete as jest.Mock).mockResolvedValue(false);

      const result = await UsageTrackingService.deleteUsageRecord(usageRecordId, tenantId);

      expect(result).toBe(false);
    });

    it('should throw error when deletion fails', async () => {
      (UsageRepository.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      await expect(UsageTrackingService.deleteUsageRecord(usageRecordId, tenantId))
        .rejects.toThrow('Delete failed');
    });
  });
});
