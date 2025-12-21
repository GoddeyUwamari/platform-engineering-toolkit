import { UUID, Timestamp, NotificationType } from '@shared/types';

/**
 * Notification Template Model and Types
 * Defines interfaces for notification templates, DTOs, and filters
 */

// ============================================================================
// Database Model
// ============================================================================

export interface NotificationTemplateModel {
  id: UUID;
  tenant_id: UUID;
  name: string;
  slug: string;
  type: NotificationType;
  subject: string | null;
  body: string;
  description: string | null;
  variables: string[] | null;
  is_active: boolean;
  language: string;
  metadata: Record<string, any> | null;
  created_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}

// ============================================================================
// Domain Model (Mapped from Database)
// ============================================================================

export interface NotificationTemplate {
  id: UUID;
  tenantId: UUID;
  name: string;
  slug: string;
  type: NotificationType;
  subject: string | null;
  body: string;
  description: string | null;
  variables: string[];
  isActive: boolean;
  language: string;
  metadata: Record<string, any> | null;
  createdBy: UUID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

export interface CreateTemplateDTO {
  tenantId: UUID;
  name: string;
  slug: string;
  type: NotificationType;
  subject?: string;
  body: string;
  description?: string;
  variables?: string[];
  language?: string;
  metadata?: Record<string, any>;
  createdBy?: UUID;
}

export interface UpdateTemplateDTO {
  name?: string;
  subject?: string;
  body?: string;
  description?: string;
  variables?: string[];
  isActive?: boolean;
  language?: string;
  metadata?: Record<string, any>;
}

export interface RenderTemplateDTO {
  templateId?: UUID;
  templateSlug?: string;
  variables: Record<string, any>;
  language?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface TemplateFilters {
  type?: NotificationType;
  isActive?: boolean;
  language?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TemplateResponse {
  template: NotificationTemplate;
}

export interface TemplateListResponse {
  templates: NotificationTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export interface RenderedTemplate {
  subject: string | null;
  body: string;
  variables: Record<string, any>;
  missingVariables: string[];
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map database model to domain model
 */
export function mapTemplateFromDB(dbTemplate: NotificationTemplateModel): NotificationTemplate {
  return {
    id: dbTemplate.id,
    tenantId: dbTemplate.tenant_id,
    name: dbTemplate.name,
    slug: dbTemplate.slug,
    type: dbTemplate.type,
    subject: dbTemplate.subject,
    body: dbTemplate.body,
    description: dbTemplate.description,
    variables: dbTemplate.variables || [],
    isActive: dbTemplate.is_active,
    language: dbTemplate.language,
    metadata: dbTemplate.metadata,
    createdBy: dbTemplate.created_by,
    createdAt: dbTemplate.created_at,
    updatedAt: dbTemplate.updated_at,
  };
}

/**
 * Map array of database models to domain models
 */
export function mapTemplatesFromDB(dbTemplates: NotificationTemplateModel[]): NotificationTemplate[] {
  return dbTemplates.map(mapTemplateFromDB);
}

// ============================================================================
// Template Variable Functions
// ============================================================================

/**
 * Extract variable names from template content
 * Matches patterns like {{variableName}}
 */
export function extractTemplateVariables(content: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();

  const matches = content.matchAll(variablePattern);
  for (const match of matches) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Validate that all required variables are provided
 */
export function validateTemplateVariables(
  template: NotificationTemplate,
  providedVariables: Record<string, any>
): { isValid: boolean; missingVariables: string[] } {
  const requiredVariables = template.variables || [];
  const providedKeys = Object.keys(providedVariables);
  const missingVariables = requiredVariables.filter(
    (variable) => !providedKeys.includes(variable)
  );

  return {
    isValid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Render template by replacing variables
 */
export function renderTemplate(
  content: string,
  variables: Record<string, any>,
  options: { escapeHtml?: boolean; defaultValue?: string } = {}
): string {
  const { escapeHtml = false, defaultValue = '' } = options;

  return content.replace(/\{\{(\w+)\}\}/g, (_match, variableName) => {
    const value = variables[variableName];

    if (value === undefined || value === null) {
      return defaultValue;
    }

    const stringValue = String(value);

    if (escapeHtml) {
      return escapeHtmlChars(stringValue);
    }

    return stringValue;
  });
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtmlChars(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Generate slug from template name
 */
export function generateTemplateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate template content
 */
export function validateTemplateContent(
  type: NotificationType,
  subject: string | null,
  body: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Email templates require subject
  if (type === NotificationType.EMAIL && !subject) {
    errors.push('Email templates must have a subject');
  }

  // Body is always required
  if (!body || body.trim().length === 0) {
    errors.push('Template body is required');
  }

  // Check for balanced variable placeholders
  const openBraces = (body.match(/\{\{/g) || []).length;
  const closeBraces = (body.match(/\}\}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push('Template has unbalanced variable placeholders');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'];
export const DEFAULT_LANGUAGE = 'en';

export const TEMPLATE_VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;
export const MAX_TEMPLATE_VARIABLES = 100;
export const MAX_TEMPLATE_BODY_LENGTH = 50000; // 50KB

// Common template variable names
export const COMMON_VARIABLES = {
  // User variables
  USER_NAME: 'userName',
  USER_EMAIL: 'userEmail',
  USER_FIRST_NAME: 'userFirstName',
  USER_LAST_NAME: 'userLastName',

  // Tenant variables
  TENANT_NAME: 'tenantName',
  COMPANY_NAME: 'companyName',

  // System variables
  CURRENT_DATE: 'currentDate',
  CURRENT_YEAR: 'currentYear',

  // Action variables
  ACTION_URL: 'actionUrl',
  ACTION_BUTTON_TEXT: 'actionButtonText',
  CONFIRMATION_CODE: 'confirmationCode',

  // Invoice variables
  INVOICE_NUMBER: 'invoiceNumber',
  INVOICE_AMOUNT: 'invoiceAmount',
  INVOICE_DUE_DATE: 'invoiceDueDate',
};
