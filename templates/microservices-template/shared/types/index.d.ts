export type UUID = string;
export type Timestamp = Date | string;
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: ErrorResponse;
    timestamp: Timestamp;
}
export interface ErrorResponse {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    ADMIN = "ADMIN",
    BILLING_ADMIN = "BILLING_ADMIN",
    USER = "USER",
    VIEWER = "VIEWER"
}
export declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    PENDING = "PENDING"
}
export interface User {
    id: UUID;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    tenantId: UUID;
    emailVerified: boolean;
    lastLoginAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}
export interface JwtPayload {
    userId: UUID;
    email: string;
    role: UserRole;
    tenantId: UUID;
    iat: number;
    exp: number;
}
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantName: string;
}
export declare enum TenantStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    TRIAL = "TRIAL",
    CANCELLED = "CANCELLED"
}
export declare enum TenantPlan {
    FREE = "FREE",
    STARTER = "STARTER",
    PROFESSIONAL = "PROFESSIONAL",
    ENTERPRISE = "ENTERPRISE"
}
export interface Tenant {
    id: UUID;
    name: string;
    slug: string;
    plan: TenantPlan;
    status: TenantStatus;
    billingEmail: string;
    maxUsers: number;
    settings: TenantSettings;
    trialEndsAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface TenantSettings {
    currency: string;
    timezone: string;
    dateFormat: string;
    logoUrl?: string;
    primaryColor?: string;
}
export declare enum BillingCycle {
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    YEARLY = "YEARLY"
}
export declare enum InvoiceStatus {
    DRAFT = "DRAFT",
    PENDING = "PENDING",
    PAID = "PAID",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}
export interface Invoice {
    id: UUID;
    invoiceNumber: string;
    tenantId: UUID;
    customerId: UUID;
    status: InvoiceStatus;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    billingCycle: BillingCycle;
    items: InvoiceItem[];
    dueDate: Timestamp;
    paidAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface InvoiceItem {
    id: UUID;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    metadata?: Record<string, unknown>;
}
export interface UsageRecord {
    id: UUID;
    tenantId: UUID;
    resourceType: string;
    resourceId: UUID;
    quantity: number;
    unit: string;
    timestamp: Timestamp;
    metadata?: Record<string, unknown>;
}
export declare enum PaymentMethod {
    CREDIT_CARD = "CREDIT_CARD",
    DEBIT_CARD = "DEBIT_CARD",
    BANK_TRANSFER = "BANK_TRANSFER",
    PAYPAL = "PAYPAL"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}
export interface Payment {
    id: UUID;
    invoiceId: UUID;
    tenantId: UUID;
    amount: number;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    providerTransactionId?: string;
    providerResponse?: Record<string, unknown>;
    failureReason?: string;
    processedAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface PaymentIntent {
    id: UUID;
    amount: number;
    currency: string;
    method: PaymentMethod;
    clientSecret?: string;
    metadata?: Record<string, unknown>;
}
export declare enum NotificationType {
    EMAIL = "EMAIL",
    SMS = "SMS",
    WEBHOOK = "WEBHOOK",
    IN_APP = "IN_APP"
}
export declare enum NotificationStatus {
    PENDING = "PENDING",
    SENT = "SENT",
    FAILED = "FAILED",
    DELIVERED = "DELIVERED"
}
export interface Notification {
    id: UUID;
    tenantId: UUID;
    userId?: UUID;
    type: NotificationType;
    status: NotificationStatus;
    subject?: string;
    body: string;
    recipient: string;
    metadata?: Record<string, unknown>;
    sentAt?: Timestamp;
    deliveredAt?: Timestamp;
    failureReason?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export declare enum EventType {
    USER_CREATED = "USER_CREATED",
    USER_UPDATED = "USER_UPDATED",
    USER_DELETED = "USER_DELETED",
    USER_LOGIN = "USER_LOGIN",
    TENANT_CREATED = "TENANT_CREATED",
    TENANT_UPDATED = "TENANT_UPDATED",
    TENANT_SUSPENDED = "TENANT_SUSPENDED",
    INVOICE_CREATED = "INVOICE_CREATED",
    INVOICE_PAID = "INVOICE_PAID",
    INVOICE_OVERDUE = "INVOICE_OVERDUE",
    USAGE_RECORDED = "USAGE_RECORDED",
    PAYMENT_INITIATED = "PAYMENT_INITIATED",
    PAYMENT_SUCCEEDED = "PAYMENT_SUCCEEDED",
    PAYMENT_FAILED = "PAYMENT_FAILED",
    PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
    NOTIFICATION_SENT = "NOTIFICATION_SENT",
    NOTIFICATION_FAILED = "NOTIFICATION_FAILED"
}
export interface BaseEvent<T = unknown> {
    id: UUID;
    type: EventType;
    timestamp: Timestamp;
    version: string;
    payload: T;
    metadata?: {
        correlationId?: UUID;
        causationId?: UUID;
        userId?: UUID;
        tenantId?: UUID;
    };
}
export interface BaseEntity {
    id: UUID;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    deletedAt?: Timestamp;
}
export interface RequestContext {
    userId: UUID;
    tenantId: UUID;
    role: UserRole;
    ip?: string;
    userAgent?: string;
}
export interface AuthenticatedUser {
    userId: UUID;
    email: string;
    role: UserRole;
    tenantId: UUID;
    userAgent?: string;
}
export interface DateRangeFilter {
    startDate?: Timestamp;
    endDate?: Timestamp;
}
export interface SearchFilter {
    query?: string;
    fields?: string[];
}
export declare enum HealthStatus {
    HEALTHY = "HEALTHY",
    DEGRADED = "DEGRADED",
    UNHEALTHY = "UNHEALTHY"
}
export interface HealthCheck {
    status: HealthStatus;
    service: string;
    timestamp: Timestamp;
    version: string;
    dependencies: DependencyHealth[];
}
export interface DependencyHealth {
    name: string;
    status: HealthStatus;
    responseTime?: number;
    message?: string;
}
//# sourceMappingURL=index.d.ts.map