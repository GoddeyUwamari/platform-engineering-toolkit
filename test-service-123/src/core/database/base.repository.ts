import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
  ObjectLiteral,
  FindOptionsOrder,
} from 'typeorm';
import { AppDataSource } from './data-source';

/**
 * Base Repository Interface
 * Defines common data access operations for all repositories
 */
export interface IBaseRepository<T extends ObjectLiteral> {
  findById(id: string): Promise<T | null>;
  findAll(options?: PaginationOptions<T>): Promise<PaginatedResult<T>>;
  create(data: DeepPartial<T>): Promise<T>;
  update(id: string, data: DeepPartial<T>): Promise<T>;
  softDelete(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
  exists(id: string): Promise<boolean>;
}

/**
 * Pagination Options
 */
export interface PaginationOptions<T> {
  page?: number;
  limit?: number;
  where?: FindOptionsWhere<T>;
  order?: FindOptionsOrder<T>;
  relations?: string[];
}

/**
 * Paginated Result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Base Repository Implementation
 *
 * Generic repository class providing common CRUD operations
 * Follows the Repository Pattern for data access abstraction
 *
 * @template T - Entity type extending ObjectLiteral
 */
export abstract class BaseRepository<T extends ObjectLiteral> implements IBaseRepository<T> {
  protected repository: Repository<T>;

  constructor(entity: new () => T) {
    this.repository = AppDataSource.getRepository(entity);
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const entity = await this.repository.findOne({
        where: { id } as unknown as FindOptionsWhere<T>,
      });
      return entity;
    } catch (error) {
      console.error(`Error finding entity by id ${id}:`, error);
      throw new Error(`Failed to find entity: ${(error as Error).message}`);
    }
  }

  /**
   * Find all entities with pagination and filtering
   */
  async findAll(options: PaginationOptions<T> = {}): Promise<PaginatedResult<T>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const findOptions: FindManyOptions<T> = {
        where: options.where,
        order: options.order,
        relations: options.relations,
        skip,
        take: limit,
      };

      const [data, total] = await this.repository.findAndCount(findOptions);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error) {
      console.error('Error finding entities:', error);
      throw new Error(`Failed to find entities: ${(error as Error).message}`);
    }
  }

  /**
   * Create new entity
   */
  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      console.error('Error creating entity:', error);
      throw new Error(`Failed to create entity: ${(error as Error).message}`);
    }
  }

  /**
   * Update existing entity
   */
  async update(id: string, data: DeepPartial<T>): Promise<T> {
    try {
      const entity = await this.findById(id);
      if (!entity) {
        throw new Error(`Entity with id ${id} not found`);
      }

      const updated = this.repository.merge(entity, data);
      return await this.repository.save(updated);
    } catch (error) {
      console.error(`Error updating entity ${id}:`, error);
      throw new Error(`Failed to update entity: ${(error as Error).message}`);
    }
  }

  /**
   * Soft delete entity (sets deletedAt timestamp)
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.softDelete(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      console.error(`Error soft deleting entity ${id}:`, error);
      throw new Error(`Failed to soft delete entity: ${(error as Error).message}`);
    }
  }

  /**
   * Hard delete entity (permanent removal)
   */
  async hardDelete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      console.error(`Error hard deleting entity ${id}:`, error);
      throw new Error(`Failed to hard delete entity: ${(error as Error).message}`);
    }
  }

  /**
   * Restore soft-deleted entity
   */
  async restore(id: string): Promise<boolean> {
    try {
      const result = await this.repository.restore(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      console.error(`Error restoring entity ${id}:`, error);
      throw new Error(`Failed to restore entity: ${(error as Error).message}`);
    }
  }

  /**
   * Count entities matching criteria
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    try {
      return await this.repository.count({ where });
    } catch (error) {
      console.error('Error counting entities:', error);
      throw new Error(`Failed to count entities: ${(error as Error).message}`);
    }
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { id } as unknown as FindOptionsWhere<T>,
      });
      return count > 0;
    } catch (error) {
      console.error(`Error checking entity existence ${id}:`, error);
      throw new Error(`Failed to check entity existence: ${(error as Error).message}`);
    }
  }
}
