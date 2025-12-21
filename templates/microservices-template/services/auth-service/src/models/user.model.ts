import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { authDatabase } from '../config/database.config';
import { logger } from '@shared/utils/logger';
import { UserRole, UserStatus, User, UUID } from '@shared/types';

/**
 * User Model
 * Handles all user-related database operations with multi-tenancy support
 */

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId: UUID;
  status?: UserStatus;
  emailVerified?: boolean;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  lastLoginAt?: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string | null;
}

export class UserModel {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TABLE_NAME = 'users';

  /**
   * Hash password using bcrypt
   */
  private static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      logger.error('Failed to hash password', {
        service: 'auth-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  public static async verifyPassword(
    password: string,
    passwordHash: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch (error) {
      logger.error('Failed to verify password', {
        service: 'auth-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Create a new user
   */
  public static async create(input: CreateUserInput): Promise<User> {
    const {
      email,
      password,
      firstName,
      lastName,
      role = UserRole.USER,
      tenantId,
      status = UserStatus.ACTIVE,
      emailVerified = false,
    } = input;

    try {
      // Set tenant context for RLS
      await authDatabase.setTenantContext(tenantId);

      // Hash password if provided
      const passwordHash = password ? await this.hashPassword(password) : null;

      const userId = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO ${this.TABLE_NAME} (
          id,
          email,
          password_hash,
          first_name,
          last_name,
          role,
          status,
          tenant_id,
          email_verified,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING 
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const params = [
        userId,
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role,
        status,
        tenantId,
        emailVerified,
        now,
        now,
      ];

      const result = await authDatabase.queryOne<User>(query, params);

      if (!result) {
        throw new Error('Failed to create user');
      }

      logger.info('User created successfully', {
        service: 'auth-service',
        userId: result.id,
        email: result.email,
        tenantId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create user', {
        service: 'auth-service',
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  public static async findById(
    userId: UUID,
    tenantId: UUID
  ): Promise<User | null> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        SELECT 
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ${this.TABLE_NAME}
        WHERE id = $1 AND tenant_id = $2
      `;

      return await authDatabase.queryOne<User>(query, [userId, tenantId]);
    } catch (error) {
      logger.error('Failed to find user by ID', {
        service: 'auth-service',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  public static async findByEmail(
    email: string,
    tenantId: UUID
  ): Promise<User | null> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        SELECT 
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ${this.TABLE_NAME}
        WHERE email = $1 AND tenant_id = $2
      `;

      return await authDatabase.queryOne<User>(query, [email.toLowerCase(), tenantId]);
    } catch (error) {
      logger.error('Failed to find user by email', {
        service: 'auth-service',
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find user by email with password hash (for authentication)
   */
  public static async findByEmailWithPassword(
    email: string,
    tenantId: UUID
  ): Promise<UserWithPassword | null> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        SELECT
          id,
          email,
          password_hash as "passwordHash",
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ${this.TABLE_NAME}
        WHERE email = $1 AND tenant_id = $2
      `;

      return await authDatabase.queryOne<UserWithPassword>(query, [email.toLowerCase(), tenantId]);
    } catch (error) {
      logger.error('Failed to find user by email with password', {
        service: 'auth-service',
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  public static async update(
    userId: UUID,
    tenantId: UUID,
    updates: UpdateUserInput
  ): Promise<User | null> {
    try {
      await authDatabase.setTenantContext(tenantId);

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.firstName !== undefined) {
        updateFields.push(`first_name = $${paramIndex++}`);
        values.push(updates.firstName);
      }
      if (updates.lastName !== undefined) {
        updateFields.push(`last_name = $${paramIndex++}`);
        values.push(updates.lastName);
      }
      if (updates.email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        values.push(updates.email.toLowerCase());
      }
      if (updates.role !== undefined) {
        updateFields.push(`role = $${paramIndex++}`);
        values.push(updates.role);
      }
      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.emailVerified !== undefined) {
        updateFields.push(`email_verified = $${paramIndex++}`);
        values.push(updates.emailVerified);
      }
      if (updates.lastLoginAt !== undefined) {
        updateFields.push(`last_login_at = $${paramIndex++}`);
        values.push(updates.lastLoginAt);
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      // Add userId and tenantId for WHERE clause
      values.push(userId, tenantId);

      const query = `
        UPDATE ${this.TABLE_NAME}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
        RETURNING 
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await authDatabase.queryOne<User>(query, values);

      if (result) {
        logger.info('User updated successfully', {
          service: 'auth-service',
          userId,
          tenantId,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to update user', {
        service: 'auth-service',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user password
   */
  public static async updatePassword(
    userId: UUID,
    tenantId: UUID,
    newPassword: string
  ): Promise<boolean> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const passwordHash = await this.hashPassword(newPassword);

      const query = `
        UPDATE ${this.TABLE_NAME}
        SET password_hash = $1, updated_at = $2
        WHERE id = $3 AND tenant_id = $4
      `;

      const result = await authDatabase.query(query, [
        passwordHash,
        new Date(),
        userId,
        tenantId,
      ]);

      const success = result.length > 0;

      if (success) {
        logger.info('User password updated successfully', {
          service: 'auth-service',
          userId,
          tenantId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to update user password', {
        service: 'auth-service',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  public static async updateLastLogin(
    userId: UUID,
    tenantId: UUID
  ): Promise<void> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE ${this.TABLE_NAME}
        SET last_login_at = $1
        WHERE id = $2 AND tenant_id = $3
      `;

      await authDatabase.query(query, [new Date(), userId, tenantId]);

      logger.debug('User last login updated', {
        service: 'auth-service',
        userId,
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to update last login', {
        service: 'auth-service',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Soft delete user (deactivate)
   */
  public static async softDelete(
    userId: UUID,
    tenantId: UUID
  ): Promise<boolean> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        UPDATE ${this.TABLE_NAME}
        SET status = $1, updated_at = $2
        WHERE id = $3 AND tenant_id = $4
      `;

      const result = await authDatabase.query(query, [
        UserStatus.INACTIVE,
        new Date(),
        userId,
        tenantId,
      ]);

      const success = result.length > 0;

      if (success) {
        logger.info('User deactivated successfully', {
          service: 'auth-service',
          userId,
          tenantId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to deactivate user', {
        service: 'auth-service',
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if user exists by email
   */
  public static async existsByEmail(
    email: string,
    tenantId: UUID
  ): Promise<boolean> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${this.TABLE_NAME}
          WHERE email = $1 AND tenant_id = $2
        ) as exists
      `;

      const result = await authDatabase.queryOne<{ exists: boolean }>(
        query,
        [email.toLowerCase(), tenantId]
      );

      return result?.exists || false;
    } catch (error) {
      logger.error('Failed to check if user exists', {
        service: 'auth-service',
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List users with pagination
   */
  public static async list(
    tenantId: UUID,
    options: {
      limit?: number;
      offset?: number;
      role?: UserRole;
      status?: UserStatus;
    } = {}
  ): Promise<{ users: User[]; total: number }> {
    try {
      await authDatabase.setTenantContext(tenantId);

      const { limit = 20, offset = 0, role, status } = options;

      // Build WHERE clause
      const conditions = ['tenant_id = $1'];
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (role !== undefined) {
        conditions.push(`role = $${paramIndex++}`);
        params.push(role);
      }
      if (status !== undefined) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.TABLE_NAME}
        WHERE ${whereClause}
      `;

      const countResult = await authDatabase.queryOne<{ total: string }>(
        countQuery,
        params
      );
      const total = parseInt(countResult?.total || '0', 10);

      // Get paginated results
      const query = `
        SELECT 
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          role,
          status,
          tenant_id as "tenantId",
          email_verified as "emailVerified",
          last_login_at as "lastLoginAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM ${this.TABLE_NAME}
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const users = await authDatabase.query<User>(
        query,
        [...params, limit, offset]
      );

      return { users, total };
    } catch (error) {
      logger.error('Failed to list users', {
        service: 'auth-service',
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}