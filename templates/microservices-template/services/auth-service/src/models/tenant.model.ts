import { authDatabase } from '../config/database.config';
import { logger } from '@shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tenant Model
 * Handles database operations for tenants
 */

export interface CreateTenantInput {
  name: string;
  slug?: string;
  billingEmail: string;
  plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status?: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';
  maxUsers?: number;
  settings?: Record<string, any>;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  billingEmail: string;
  maxUsers: number;
  settings: Record<string, any>;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export class TenantModel {
  /**
   * Create a new tenant
   */
  static async create(input: CreateTenantInput): Promise<Tenant> {
    const {
      name,
      slug,
      billingEmail,
      plan = 'FREE',
      status = 'ACTIVE',
      maxUsers = 5,
      settings = {},
    } = input;

    try {
      // Generate slug from name if not provided
      const tenantSlug = slug || this.generateSlug(name);

      // Check if slug already exists
      const existingTenant = await this.findBySlug(tenantSlug);
      if (existingTenant) {
        // If slug exists, append random suffix
        const uniqueSlug = `${tenantSlug}-${uuidv4().slice(0, 6)}`;
        return this.create({
          ...input,
          slug: uniqueSlug,
        });
      }

      const result = await authDatabase.query<Tenant>(
        `INSERT INTO tenants (name, slug, billing_email, plan, status, max_users, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING
           id,
           name,
           slug,
           plan,
           status,
           billing_email as "billingEmail",
           max_users as "maxUsers",
           settings,
           trial_ends_at as "trialEndsAt",
           created_at as "createdAt",
           updated_at as "updatedAt",
           deleted_at as "deletedAt"`,
        [name, tenantSlug, billingEmail, plan, status, maxUsers, JSON.stringify(settings)]
      );

      if (!result || result.length === 0 || !result[0]) {
        throw new Error('Failed to create tenant');
      }

      const tenant = result[0];

      logger.info('Tenant created successfully', {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find tenant by ID
   */
  static async findById(id: string): Promise<Tenant | null> {
    try {
      const result = await authDatabase.queryOne<Tenant>(
        `SELECT
           id,
           name,
           slug,
           plan,
           status,
           billing_email as "billingEmail",
           max_users as "maxUsers",
           settings,
           trial_ends_at as "trialEndsAt",
           created_at as "createdAt",
           updated_at as "updatedAt",
           deleted_at as "deletedAt"
         FROM tenants
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      return result;
    } catch (error) {
      logger.error('Failed to find tenant by ID', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find tenant by slug
   */
  static async findBySlug(slug: string): Promise<Tenant | null> {
    try {
      const result = await authDatabase.queryOne<Tenant>(
        `SELECT
           id,
           name,
           slug,
           plan,
           status,
           billing_email as "billingEmail",
           max_users as "maxUsers",
           settings,
           trial_ends_at as "trialEndsAt",
           created_at as "createdAt",
           updated_at as "updatedAt",
           deleted_at as "deletedAt"
         FROM tenants
         WHERE slug = $1 AND deleted_at IS NULL`,
        [slug]
      );

      return result;
    } catch (error) {
      logger.error('Failed to find tenant by slug', {
        slug,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate URL-friendly slug from tenant name
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
}
