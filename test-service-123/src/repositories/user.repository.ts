import { FindOptionsWhere } from 'typeorm';
import {
  BaseRepository,
  PaginatedResult,
  PaginationOptions,
} from '../core/database/base.repository';
import { User, UserRole, UserStatus } from '../models/user.entity';

/**
 * User Repository
 *
 * Handles all database operations for User entities
 * Extends BaseRepository for common CRUD operations
 * Adds user-specific query methods
 */
export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  /**
   * Find user by email address
   * Commonly used for authentication and validation
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.repository.findOne({
        where: { email: email.toLowerCase().trim() },
      });
      return user;
    } catch (error) {
      console.error(`Error finding user by email ${email}:`, error);
      throw new Error(`Failed to find user by email: ${(error as Error).message}`);
    }
  }

  /**
   * Find all users by role
   */
  async findByRole(
    role: UserRole,
    options: PaginationOptions<User> = {}
  ): Promise<PaginatedResult<User>> {
    try {
      return await this.findAll({
        ...options,
        where: { role } as FindOptionsWhere<User>,
      });
    } catch (error) {
      console.error(`Error finding users by role ${role}:`, error);
      throw new Error(`Failed to find users by role: ${(error as Error).message}`);
    }
  }

  /**
   * Find all users by status
   */
  async findByStatus(
    status: UserStatus,
    options: PaginationOptions<User> = {}
  ): Promise<PaginatedResult<User>> {
    try {
      return await this.findAll({
        ...options,
        where: { status } as FindOptionsWhere<User>,
      });
    } catch (error) {
      console.error(`Error finding users by status ${status}:`, error);
      throw new Error(`Failed to find users by status: ${(error as Error).message}`);
    }
  }

  /**
   * Update user password hash
   * Used for password change operations
   */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new Error(`User with id ${id} not found`);
      }

      user.passwordHash = passwordHash;
      return await this.repository.save(user);
    } catch (error) {
      console.error(`Error updating password for user ${id}:`, error);
      throw new Error(`Failed to update password: ${(error as Error).message}`);
    }
  }

  /**
   * Activate user account
   */
  async activate(id: string): Promise<User> {
    try {
      return await this.update(id, { status: UserStatus.ACTIVE });
    } catch (error) {
      console.error(`Error activating user ${id}:`, error);
      throw new Error(`Failed to activate user: ${(error as Error).message}`);
    }
  }

  /**
   * Deactivate user account
   */
  async deactivate(id: string): Promise<User> {
    try {
      return await this.update(id, { status: UserStatus.INACTIVE });
    } catch (error) {
      console.error(`Error deactivating user ${id}:`, error);
      throw new Error(`Failed to deactivate user: ${(error as Error).message}`);
    }
  }

  /**
   * Suspend user account
   */
  async suspend(id: string): Promise<User> {
    try {
      return await this.update(id, { status: UserStatus.SUSPENDED });
    } catch (error) {
      console.error(`Error suspending user ${id}:`, error);
      throw new Error(`Failed to suspend user: ${(error as Error).message}`);
    }
  }

  /**
   * Check if email is already taken
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    try {
      const where: FindOptionsWhere<User> = {
        email: email.toLowerCase().trim(),
      };

      // Exclude specific user ID when checking (useful for updates)
      if (excludeUserId) {
        const users = await this.repository.find({ where });
        return users.some((user) => user.id !== excludeUserId);
      }

      const count = await this.repository.count({ where });
      return count > 0;
    } catch (error) {
      console.error(`Error checking email availability ${email}:`, error);
      throw new Error(`Failed to check email availability: ${(error as Error).message}`);
    }
  }

  /**
   * Find user with their tasks
   */
  async findByIdWithTasks(id: string): Promise<User | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['assignedTasks', 'createdTasks'],
      });
    } catch (error) {
      console.error(`Error finding user with tasks ${id}:`, error);
      throw new Error(`Failed to find user with tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Get active users count
   */
  async getActiveUsersCount(): Promise<number> {
    try {
      return await this.count({ status: UserStatus.ACTIVE } as FindOptionsWhere<User>);
    } catch (error) {
      console.error('Error counting active users:', error);
      throw new Error(`Failed to count active users: ${(error as Error).message}`);
    }
  }
}
