/**
 * Auth Service Unit Tests
 * Tests business logic for authentication operations
 */

import { AuthService } from '../../src/services/auth.service';
import { UserModel } from '../../src/models/user.model';
import { TenantModel } from '../../src/models/tenant.model';
import { UserRole, UserStatus } from '@shared/types';
import { AuthenticationError, ValidationError } from '@shared/middleware/error-handler';
import { generateTokens } from '@shared/middleware/auth.middleware';
import { authDatabase } from '../../src/config/database.config';

// Mock dependencies
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/tenant.model');
jest.mock('@shared/middleware/auth.middleware');
jest.mock('../../src/config/database.config');
jest.mock('@shared/utils/logger');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      tenantName: 'Test Company',
    };

    it('should register a new user successfully', async () => {
      const mockTenant = {
        id: 'tenant-id',
        name: validRegisterData.tenantName,
        billingEmail: validRegisterData.email,
        plan: 'FREE',
        status: 'TRIAL',
        maxUsers: 5,
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockUser = {
        id: 'user-id',
        email: validRegisterData.email,
        firstName: validRegisterData.firstName,
        lastName: validRegisterData.lastName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        tenantId: mockTenant.id,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresIn: 900,
      };

      // Setup mocks
      (authDatabase.transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback();
      });
      (TenantModel.create as jest.Mock).mockResolvedValue(mockTenant);
      (UserModel.create as jest.Mock).mockResolvedValue(mockUser);
      (generateTokens as jest.Mock).mockReturnValue(mockTokens);

      // Execute
      const result = await AuthService.register(validRegisterData);

      // Verify
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(validRegisterData.email);
      expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(result.tokens.tokenType).toBe('Bearer');
      expect(TenantModel.create).toHaveBeenCalled();
      expect(UserModel.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid email', async () => {
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email',
      };

      await expect(AuthService.register(invalidData)).rejects.toThrow();
    });

    it('should throw ValidationError for weak password', async () => {
      const invalidData = {
        ...validRegisterData,
        password: '123', // Too short
      };

      await expect(AuthService.register(invalidData)).rejects.toThrow();
    });

    it('should throw ValidationError for empty first name', async () => {
      const invalidData = {
        ...validRegisterData,
        firstName: '',
      };

      await expect(AuthService.register(invalidData)).rejects.toThrow();
    });

    it('should throw ValidationError for empty last name', async () => {
      const invalidData = {
        ...validRegisterData,
        lastName: '',
      };

      await expect(AuthService.register(invalidData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!',
    };
    const tenantId = 'tenant-id';

    it('should login user successfully', async () => {
      const mockPasswordHash = '$2b$10$hashedpassword';
      const mockUser = {
        id: 'user-id',
        email: validLoginData.email,
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        tenantId: tenantId,
        emailVerified: true,
        passwordHash: mockPasswordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresIn: 900,
      };

      (UserModel.findByEmailWithPassword as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.verifyPassword as jest.Mock).mockResolvedValue(true);
      (UserModel.updateLastLogin as jest.Mock).mockResolvedValue(mockUser);
      (generateTokens as jest.Mock).mockReturnValue(mockTokens);

      const result = await AuthService.login(validLoginData, tenantId);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(validLoginData.email);
      expect(UserModel.verifyPassword).toHaveBeenCalledWith(
        validLoginData.password,
        mockPasswordHash
      );
      expect(UserModel.updateLastLogin).toHaveBeenCalledWith(mockUser.id, tenantId);
    });

    it('should throw AuthenticationError if user not found', async () => {
      (UserModel.findByEmailWithPassword as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.login(validLoginData, tenantId)).rejects.toThrow(
        AuthenticationError
      );
      expect(UserModel.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError if password is incorrect', async () => {
      const mockPasswordHash = '$2b$10$hashedpassword';
      const mockUser = {
        id: 'user-id',
        email: validLoginData.email,
        status: UserStatus.ACTIVE,
        passwordHash: mockPasswordHash,
      };

      (UserModel.findByEmailWithPassword as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.verifyPassword as jest.Mock).mockResolvedValue(false);

      await expect(AuthService.login(validLoginData, tenantId)).rejects.toThrow(
        AuthenticationError
      );
      expect(UserModel.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError if user is inactive', async () => {
      const mockUser = {
        id: 'user-id',
        email: validLoginData.email,
        status: UserStatus.INACTIVE,
        passwordHash: '$2b$10$hashedpassword',
      };

      (UserModel.findByEmailWithPassword as jest.Mock).mockResolvedValue(mockUser);

      await expect(AuthService.login(validLoginData, tenantId)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw AuthenticationError if user is suspended', async () => {
      const mockUser = {
        id: 'user-id',
        email: validLoginData.email,
        status: UserStatus.SUSPENDED,
        passwordHash: '$2b$10$hashedpassword',
      };

      (UserModel.findByEmailWithPassword as jest.Mock).mockResolvedValue(mockUser);

      await expect(AuthService.login(validLoginData, tenantId)).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
      ];

      validEmails.forEach((email) => {
        expect(() => (AuthService as any).validateEmail(email)).not.toThrow();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'invalid@.com',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(() => (AuthService as any).validateEmail(email)).toThrow(ValidationError);
      });
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const validPasswords = [
        'Password123!',
        'StrongP@ssw0rd',
        'C0mpl3x!Pass',
      ];

      validPasswords.forEach((password) => {
        expect(() => (AuthService as any).validatePassword(password)).not.toThrow();
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        '123', // Too short
        'password', // No uppercase, no numbers, no special chars
        'PASSWORD', // No lowercase, no numbers, no special chars
        '12345678', // No letters, no special chars
      ];

      invalidPasswords.forEach((password) => {
        expect(() => (AuthService as any).validatePassword(password)).toThrow(ValidationError);
      });
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      const validNames = ['John', 'Mary-Jane', "O'Brien"];

      validNames.forEach((name) => {
        expect(() => (AuthService as any).validateName(name, 'Name')).not.toThrow();
      });
    });

    it('should reject invalid names', () => {
      const invalidNames = ['', 'A', '12345'];

      invalidNames.forEach((name) => {
        expect(() => (AuthService as any).validateName(name, 'Name')).toThrow(ValidationError);
      });
    });
  });
});
