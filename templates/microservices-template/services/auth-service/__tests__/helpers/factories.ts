/**
 * Test Data Factories
 * Generate realistic test data using @faker-js/faker
 */

import { faker } from '@faker-js/faker';
import { User, UserRole, UserStatus, UUID } from '@shared/types';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// ============================================================================
// User Factory
// ============================================================================

export interface CreateUserOptions {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  tenantId?: UUID;
  emailVerified?: boolean;
}

export function generateUser(options: CreateUserOptions = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password?: string } {
  return {
    email: options.email || faker.internet.email(),
    firstName: options.firstName || faker.person.firstName(),
    lastName: options.lastName || faker.person.lastName(),
    role: options.role || UserRole.USER,
    status: options.status || UserStatus.ACTIVE,
    tenantId: options.tenantId || faker.string.uuid(),
    emailVerified: options.emailVerified ?? true,
    lastLoginAt: faker.date.recent().toISOString(),
    password: options.password || 'Password123!',
  };
}

export async function createUser(
  pool: Pool,
  options: CreateUserOptions = {}
): Promise<User> {
  const userData = generateUser(options);
  const password = options.password || userData.password || 'Password123!';
  // Use 12 rounds to match UserModel.SALT_ROUNDS
  const hashedPassword = await bcrypt.hash(password, 12);

  // Lowercase email to match UserModel behavior
  const email = userData.email.toLowerCase();

  const result = await pool.query<User>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, status, tenant_id, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, first_name as "firstName", last_name as "lastName",
               role, status, tenant_id as "tenantId", email_verified as "emailVerified",
               last_login_at as "lastLoginAt", created_at as "createdAt", updated_at as "updatedAt"`,
    [
      email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.role,
      userData.status,
      userData.tenantId,
      userData.emailVerified,
    ]
  );

  if (!result.rows[0]) throw new Error('Failed to create user');
  return result.rows[0];
}

// ============================================================================
// Tenant Factory
// ============================================================================

export interface CreateTenantOptions {
  name?: string;
  slug?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings?: Record<string, any>;
}

export function generateTenant(options: CreateTenantOptions = {}) {
  const companyName = options.name || faker.company.name();
  return {
    name: companyName,
    slug: options.slug || faker.helpers.slugify(companyName).toLowerCase(),
    billing_email: faker.internet.email(),
    status: options.status || 'ACTIVE',
    settings: options.settings || {},
  };
}

export async function createTenant(
  pool: Pool,
  options: CreateTenantOptions = {}
): Promise<any> {
  const tenantData = generateTenant(options);

  const result = await pool.query(
    `INSERT INTO tenants (name, slug, billing_email, status, settings)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, slug, billing_email as "billingEmail", status, settings,
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      tenantData.name,
      tenantData.slug,
      tenantData.billing_email,
      tenantData.status,
      JSON.stringify(tenantData.settings),
    ]
  );

  return result.rows[0];
}

// ============================================================================
// Authentication Factory
// ============================================================================

export interface CreateAuthDataOptions {
  user?: CreateUserOptions;
  tenant?: CreateTenantOptions;
}

/**
 * Creates a complete auth setup (tenant + user) for testing
 */
export async function createAuthData(
  pool: Pool,
  options: CreateAuthDataOptions = {}
): Promise<{ user: User; tenant: any }> {
  // Create tenant first
  const tenant = await createTenant(pool, options.tenant);

  // Create user with tenant ID
  const user = await createUser(pool, {
    ...options.user,
    tenantId: tenant.id,
  });

  return { user, tenant };
}

// ============================================================================
// Refresh Token Factory
// ============================================================================

export async function createRefreshToken(
  pool: Pool,
  userId: UUID,
  token: string = faker.string.alphanumeric(64),
  expiresAt: Date = faker.date.future()
): Promise<any> {
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id as "userId", token, expires_at as "expiresAt",
               created_at as "createdAt"`,
    [userId, token, expiresAt]
  );

  return result.rows[0];
}

// ============================================================================
// Registration Request Factory
// ============================================================================

export function generateRegisterRequest(options: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  tenantName?: string;
} = {}) {
  return {
    email: options.email || faker.internet.email(),
    password: options.password || 'Password123!',
    firstName: options.firstName || faker.person.firstName(),
    lastName: options.lastName || faker.person.lastName(),
    tenantName: options.tenantName || faker.company.name(),
  };
}

// ============================================================================
// Login Request Factory
// ============================================================================

export function generateLoginRequest(options: {
  email?: string;
  password?: string;
} = {}) {
  return {
    email: options.email || faker.internet.email(),
    password: options.password || 'Password123!',
  };
}

// ============================================================================
// Batch User Factory
// ============================================================================

/**
 * Create multiple users for testing pagination, search, etc.
 */
export async function createMultipleUsers(
  pool: Pool,
  count: number,
  tenantId: UUID,
  options: CreateUserOptions = {}
): Promise<User[]> {
  const users: User[] = [];

  for (let i = 0; i < count; i++) {
    const user = await createUser(pool, {
      ...options,
      tenantId,
      email: faker.internet.email(),
    });
    users.push(user);
  }

  return users;
}
