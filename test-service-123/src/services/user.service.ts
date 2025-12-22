import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { User, UserRole, UserStatus } from '../models/user.entity';
import { cacheService, CachePrefix, CacheTTL } from './cache.service';
import { PaginatedResult, PaginationOptions } from '../core/database/base.repository';

/**
 * User Service
 *
 * Handles business logic for user operations
 * Implements caching strategy for frequently accessed data
 * Provides password hashing and validation
 */

interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

interface UpdateUserDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
}

export class UserService {
  private userRepository: UserRepository;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Create new user with hashed password
   */
  async createUser(data: CreateUserDTO): Promise<User> {
    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

      // Create user
      const user = await this.userRepository.create({
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      // Cache the new user
      await cacheService.set(`${CachePrefix.USER}${user.id}`, user, CacheTTL.LONG);

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID with caching
   */
  async findById(id: string): Promise<User | null> {
    try {
      return await cacheService.getOrSet(
        `${CachePrefix.USER}${id}`,
        async () => {
          const user = await this.userRepository.findById(id);
          if (!user) {
            throw new Error(`User with id ${id} not found`);
          }
          return user;
        },
        CacheTTL.LONG
      );
    } catch (error) {
      console.error(`Error finding user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmail(email);
    } catch (error) {
      console.error(`Error finding user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   */
  async findAll(options: PaginationOptions<User> = {}): Promise<PaginatedResult<User>> {
    try {
      return await this.userRepository.findAll(options);
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, data: UpdateUserDTO): Promise<User> {
    try {
      // Check if user exists
      const user = await this.findById(id);
      if (!user) {
        throw new Error(`User with id ${id} not found`);
      }

      // If email is being updated, check for duplicates
      if (data.email && data.email !== user.email) {
        const isTaken = await this.userRepository.isEmailTaken(data.email, id);
        if (isTaken) {
          throw new Error('Email already in use');
        }
      }

      // Update user
      const updated = await this.userRepository.update(id, data);

      // Invalidate cache
      await cacheService.invalidateUserCache(id);

      return updated;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new Error(`User with id ${id} not found`);
      }

      // Verify old password
      const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await this.userRepository.updatePassword(id, passwordHash);

      // Invalidate cache
      await cacheService.invalidateUserCache(id);
    } catch (error) {
      console.error(`Error changing password for user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Verify user password (for authentication)
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return user;
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account (soft delete)
   */
  async deactivateUser(id: string): Promise<void> {
    try {
      await this.userRepository.deactivate(id);
      await cacheService.invalidateUserCache(id);
    } catch (error) {
      console.error(`Error deactivating user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await this.userRepository.softDelete(id);
      await cacheService.invalidateUserCache(id);
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get user with their tasks
   */
  async getUserWithTasks(id: string): Promise<User | null> {
    try {
      return await this.userRepository.findByIdWithTasks(id);
    } catch (error) {
      console.error(`Error finding user with tasks ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get active users count
   */
  async getActiveUsersCount(): Promise<number> {
    try {
      return await this.userRepository.getActiveUsersCount();
    } catch (error) {
      console.error('Error counting active users:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();
