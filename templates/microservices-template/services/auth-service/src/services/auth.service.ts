import { v4 as uuidv4 } from 'uuid';
import { logger } from '@shared/utils/logger';
import { 
  User, 
  UserRole, 
  UserStatus, 
  UUID,
  AuthTokens,
  LoginCredentials,
  RegisterData,
} from '@shared/types';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from '@shared/middleware/error-handler';
import {
  generateTokens,
  verifyRefreshToken
} from '@shared/middleware/auth.middleware';
import { UserModel } from '../models/user.model';
import { TenantModel } from '../models/tenant.model';
import { authDatabase } from '../config/database.config';

/**
 * Authentication Service
 * Handles all authentication and user management operations
 */

interface RegisterInput extends RegisterData {
  role?: UserRole;
}

interface VerifyEmailInput {
  userId: UUID;
  tenantId: UUID;
  verificationToken: string;
}

interface ResetPasswordInput {
  email: string;
  tenantId: UUID;
  resetToken: string;
  newPassword: string;
}

interface ChangePasswordInput {
  userId: UUID;
  tenantId: UUID;
  currentPassword: string;
  newPassword: string;
}

interface RefreshTokenInput {
  refreshToken: string;
}

interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export class AuthService {
  /**
   * Register a new user
   */
  public static async register(input: RegisterInput): Promise<LoginResponse> {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      tenantName: _tenantName,
      role = UserRole.USER 
    } = input;

    try {
      // Validate input
      this.validateEmail(email);
      this.validatePassword(password);
      this.validateName(firstName, 'First name');
      this.validateName(lastName, 'Last name');

      // Note: Email uniqueness is enforced per tenant by database constraint
      // Same email can exist in different tenants (multi-tenant design)

      // Create tenant and user in transaction
      const user = await authDatabase.transaction(async (_client) => {
        // Create tenant first
        const tenant = await TenantModel.create({
          name: _tenantName,
          billingEmail: email, // Use user's email as billing email
          plan: 'FREE',
          status: 'TRIAL',
          maxUsers: 5,
          settings: {},
        });

        logger.info('Tenant created for new registration', {
          tenantId: tenant.id,
          tenantName: tenant.name,
        });

        // Create user with the new tenant ID
        const newUser = await UserModel.create({
          email,
          password,
          firstName,
          lastName,
          role,
          tenantId: tenant.id,
          status: UserStatus.ACTIVE,
          emailVerified: false,
        });

        // TODO: Send verification email
        logger.info('Verification email should be sent', {
          userId: newUser.id,
          email: newUser.email,
        });

        return newUser;
      });

      // Generate tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
      });

      return {
        user,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.accessTokenExpiresIn,
          tokenType: 'Bearer',
        },
      };
    } catch (error) {
      logger.error('User registration failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  public static async login(credentials: LoginCredentials, tenantId: UUID): Promise<LoginResponse> {
    const { email, password } = credentials;

    try {
      // Validate input
      this.validateEmail(email);
      if (!password) {
        throw new ValidationError('Password is required');
      }

      // Find user with password hash
      const user = await UserModel.findByEmailWithPassword(email, tenantId);

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthenticationError('Account is not active. Please contact support.');
      }

      // Verify password
      if (!user.passwordHash) {
        throw new AuthenticationError('Password authentication not available for this account');
      }

      const isPasswordValid = await UserModel.verifyPassword(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login timestamp
      await UserModel.updateLastLogin(user.id, tenantId);

      // Generate tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        tenantId,
      });

      return {
        user: userWithoutPassword,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.accessTokenExpiresIn,
          tokenType: 'Bearer',
        },
      };
    } catch (error) {
      logger.error('User login failed', {
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public static async refreshToken(input: RefreshTokenInput): Promise<AuthTokens> {
    const { refreshToken } = input;

    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Fetch user to ensure they still exist and are active
      const user = await UserModel.findById(decoded.userId, decoded.tenantId);

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthenticationError('Account is not active');
      }

      // Generate new tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      logger.info('Access token refreshed', {
        userId: user.id,
        tenantId: user.tenantId,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.accessTokenExpiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify user email
   */
  public static async verifyEmail(input: VerifyEmailInput): Promise<User> {
    const { userId, tenantId, verificationToken: _verificationToken } = input;

    try {
      // TODO: Implement token-based verification
      // For now, just mark email as verified
      
      const user = await UserModel.findById(userId, tenantId);

      if (!user) {
        throw new NotFoundError('User');
      }

      if (user.emailVerified) {
        logger.info('Email already verified', { userId, tenantId });
        return user;
      }

      // Update user email verification status
      const updatedUser = await UserModel.update(userId, tenantId, {
        emailVerified: true,
      });

      if (!updatedUser) {
        throw new Error('Failed to verify email');
      }

      logger.info('Email verified successfully', {
        userId,
        email: updatedUser.email,
        tenantId,
      });

      return updatedUser;
    } catch (error) {
      logger.error('Email verification failed', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  public static async requestPasswordReset(email: string, tenantId: UUID): Promise<void> {
    try {
      this.validateEmail(email);

      const user = await UserModel.findByEmail(email, tenantId);

      // Don't reveal if user exists or not (security best practice)
      if (!user) {
        logger.info('Password reset requested for non-existent user', {
          email,
          tenantId,
        });
        return;
      }

      // TODO: Generate reset token and store in database
      // TODO: Send password reset email with token
      const resetToken = uuidv4();

      logger.info('Password reset email should be sent', {
        userId: user.id,
        email: user.email,
        resetToken, // In production, hash this before storing
      });

      logger.info('Password reset requested', {
        userId: user.id,
        email,
        tenantId,
      });
    } catch (error) {
      logger.error('Password reset request failed', {
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  public static async resetPassword(input: ResetPasswordInput): Promise<void> {
    const { email, tenantId, resetToken: _resetToken, newPassword } = input;

    try {
      this.validateEmail(email);
      this.validatePassword(newPassword);

      // TODO: Verify reset token from database
      // For now, skip token verification

      const user = await UserModel.findByEmail(email, tenantId);

      if (!user) {
        throw new NotFoundError('User');
      }

      // Update password
      const success = await UserModel.updatePassword(user.id, tenantId, newPassword);

      if (!success) {
        throw new Error('Failed to reset password');
      }

      // TODO: Invalidate all existing tokens for this user
      // TODO: Send password change confirmation email

      logger.info('Password reset successfully', {
        userId: user.id,
        email,
        tenantId,
      });
    } catch (error) {
      logger.error('Password reset failed', {
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Change user password (requires current password)
   */
  public static async changePassword(input: ChangePasswordInput): Promise<void> {
    const { userId, tenantId, currentPassword, newPassword } = input;

    try {
      this.validatePassword(newPassword);

      // Fetch user with password
      const user = await UserModel.findByEmailWithPassword(
        (await UserModel.findById(userId, tenantId))?.email || '',
        tenantId
      );

      if (!user || !user.passwordHash) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Verify current password
      const isPasswordValid = await UserModel.verifyPassword(
        currentPassword,
        user.passwordHash
      );

      if (!isPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Ensure new password is different
      const isSamePassword = await UserModel.verifyPassword(
        newPassword,
        user.passwordHash
      );

      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Update password
      const success = await UserModel.updatePassword(userId, tenantId, newPassword);

      if (!success) {
        throw new Error('Failed to change password');
      }

      // TODO: Invalidate all existing tokens except current session
      // TODO: Send password change notification email

      logger.info('Password changed successfully', {
        userId,
        tenantId,
      });
    } catch (error) {
      logger.error('Password change failed', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  public static async logout(userId: UUID, tenantId: UUID): Promise<void> {
    try {
      // TODO: Implement token blacklisting or invalidation
      // Options:
      // 1. Store tokens in Redis with expiry
      // 2. Maintain a blacklist of invalidated tokens
      // 3. Use token versioning in database

      logger.info('User logged out', {
        userId,
        tenantId,
      });
    } catch (error) {
      logger.error('Logout failed', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user profile
   */
  public static async getProfile(userId: UUID, tenantId: UUID): Promise<User> {
    try {
      const user = await UserModel.findById(userId, tenantId);

      if (!user) {
        throw new NotFoundError('User');
      }

      return user;
    } catch (error) {
      logger.error('Failed to get user profile', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  public static async updateProfile(
    userId: UUID,
    tenantId: UUID,
    updates: {
      firstName?: string;
      lastName?: string;
    }
  ): Promise<User> {
    try {
      if (updates.firstName) {
        this.validateName(updates.firstName, 'First name');
      }
      if (updates.lastName) {
        this.validateName(updates.lastName, 'Last name');
      }

      const user = await UserModel.update(userId, tenantId, updates);

      if (!user) {
        throw new NotFoundError('User');
      }

      logger.info('User profile updated', {
        userId,
        tenantId,
      });

      return user;
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Validate email format
   */
  private static validateEmail(email: string): void {
    if (!email) {
      throw new ValidationError('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  /**
   * Validate password strength
   */
  private static validatePassword(password: string): void {
    if (!password) {
      throw new ValidationError('Password is required');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      throw new ValidationError('Password must not exceed 128 characters');
    }

    // Check for at least one uppercase, one lowercase, one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      );
    }
  }

  /**
   * Validate name fields
   */
  private static validateName(name: string, field: string): void {
    if (!name) {
      throw new ValidationError(`${field} is required`);
    }

    if (name.length < 2) {
      throw new ValidationError(`${field} must be at least 2 characters long`);
    }

    if (name.length > 50) {
      throw new ValidationError(`${field} must not exceed 50 characters`);
    }

    // Allow only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name)) {
      throw new ValidationError(
        `${field} can only contain letters, spaces, hyphens, and apostrophes`
      );
    }
  }
}