import { UUID, Timestamp, NotificationType, NotificationStatus } from '@shared/types';

/**
 * Notification Model and Types
 * Defines interfaces for notifications, DTOs, and filters
 */

// ============================================================================
// Database Model
// ============================================================================

export interface NotificationModel {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID | null;
  type: NotificationType;
  status: NotificationStatus;
  subject: string | null;
  body: string;
  recipient: string;
  template_id: UUID | null;
  metadata: Record<string, any> | null;
  sent_at: Timestamp | null;
  delivered_at: Timestamp | null;
  failure_reason: string | null;
  retry_count: number;
  max_retries: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}

// ============================================================================
// Domain Model (Mapped from Database)
// ============================================================================

export interface Notification {
  id: UUID;
  tenantId: UUID;
  userId: UUID | null;
  type: NotificationType;
  status: NotificationStatus;
  subject: string | null;
  body: string;
  recipient: string;
  templateId: UUID | null;
  metadata: Record<string, any> | null;
  sentAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

export interface CreateNotificationDTO {
  tenantId: UUID;
  userId?: UUID | null;
  type: NotificationType;
  subject?: string;
  body: string;
  recipient: string;
  templateId?: UUID;
  metadata?: Record<string, any>;
  maxRetries?: number;
}

export interface UpdateNotificationDTO {
  status?: NotificationStatus;
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  failureReason?: string;
  retryCount?: number;
}

export interface SendEmailDTO {
  recipient: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  templateId?: UUID;
  templateVariables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SendSMSDTO {
  recipient: string;
  body: string;
  templateId?: UUID;
  templateVariables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SendWebhookDTO {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface NotificationFilters {
  type?: NotificationType;
  status?: NotificationStatus;
  userId?: UUID;
  templateId?: UUID;
  startDate?: Timestamp;
  endDate?: Timestamp;
  recipient?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface NotificationResponse {
  notification: Notification;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationStatsResponse {
  total: number;
  byType: Record<NotificationType, number>;
  byStatus: Record<NotificationStatus, number>;
  sentLast24h: number;
  failedLast24h: number;
  averageDeliveryTime: number; // in milliseconds
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map database model to domain model
 */
export function mapNotificationFromDB(dbNotification: NotificationModel): Notification {
  return {
    id: dbNotification.id,
    tenantId: dbNotification.tenant_id,
    userId: dbNotification.user_id,
    type: dbNotification.type,
    status: dbNotification.status,
    subject: dbNotification.subject,
    body: dbNotification.body,
    recipient: dbNotification.recipient,
    templateId: dbNotification.template_id,
    metadata: dbNotification.metadata,
    sentAt: dbNotification.sent_at,
    deliveredAt: dbNotification.delivered_at,
    failureReason: dbNotification.failure_reason,
    retryCount: dbNotification.retry_count,
    maxRetries: dbNotification.max_retries,
    createdAt: dbNotification.created_at,
    updatedAt: dbNotification.updated_at,
  };
}

/**
 * Map array of database models to domain models
 */
export function mapNotificationsFromDB(dbNotifications: NotificationModel[]): Notification[] {
  return dbNotifications.map(mapNotificationFromDB);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (basic validation)
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Basic validation: should start with + and contain 10-15 digits
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''));
}

/**
 * Validate webhook URL
 */
export function isValidWebhookURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate notification recipient based on type
 */
export function validateRecipient(type: NotificationType, recipient: string): boolean {
  switch (type) {
    case NotificationType.EMAIL:
      return isValidEmail(recipient);
    case NotificationType.SMS:
      return isValidPhoneNumber(recipient);
    case NotificationType.WEBHOOK:
      return isValidWebhookURL(recipient);
    case NotificationType.IN_APP:
      return true; // In-app notifications use user IDs
    default:
      return false;
  }
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 5000; // 5 seconds

export const NOTIFICATION_STATUSES = Object.values(NotificationStatus);
export const NOTIFICATION_TYPES = Object.values(NotificationType);
