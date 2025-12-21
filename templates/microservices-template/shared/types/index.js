"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthStatus = exports.EventType = exports.NotificationStatus = exports.NotificationType = exports.PaymentStatus = exports.PaymentMethod = exports.InvoiceStatus = exports.BillingCycle = exports.TenantPlan = exports.TenantStatus = exports.UserStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["BILLING_ADMIN"] = "BILLING_ADMIN";
    UserRole["USER"] = "USER";
    UserRole["VIEWER"] = "VIEWER";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING"] = "PENDING";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "ACTIVE";
    TenantStatus["SUSPENDED"] = "SUSPENDED";
    TenantStatus["TRIAL"] = "TRIAL";
    TenantStatus["CANCELLED"] = "CANCELLED";
})(TenantStatus || (exports.TenantStatus = TenantStatus = {}));
var TenantPlan;
(function (TenantPlan) {
    TenantPlan["FREE"] = "FREE";
    TenantPlan["STARTER"] = "STARTER";
    TenantPlan["PROFESSIONAL"] = "PROFESSIONAL";
    TenantPlan["ENTERPRISE"] = "ENTERPRISE";
})(TenantPlan || (exports.TenantPlan = TenantPlan = {}));
var BillingCycle;
(function (BillingCycle) {
    BillingCycle["MONTHLY"] = "MONTHLY";
    BillingCycle["QUARTERLY"] = "QUARTERLY";
    BillingCycle["YEARLY"] = "YEARLY";
})(BillingCycle || (exports.BillingCycle = BillingCycle = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["PENDING"] = "PENDING";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
    InvoiceStatus["REFUNDED"] = "REFUNDED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CREDIT_CARD"] = "CREDIT_CARD";
    PaymentMethod["DEBIT_CARD"] = "DEBIT_CARD";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["PAYPAL"] = "PAYPAL";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["PROCESSING"] = "PROCESSING";
    PaymentStatus["SUCCEEDED"] = "SUCCEEDED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["EMAIL"] = "EMAIL";
    NotificationType["SMS"] = "SMS";
    NotificationType["WEBHOOK"] = "WEBHOOK";
    NotificationType["IN_APP"] = "IN_APP";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "PENDING";
    NotificationStatus["SENT"] = "SENT";
    NotificationStatus["FAILED"] = "FAILED";
    NotificationStatus["DELIVERED"] = "DELIVERED";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var EventType;
(function (EventType) {
    EventType["USER_CREATED"] = "USER_CREATED";
    EventType["USER_UPDATED"] = "USER_UPDATED";
    EventType["USER_DELETED"] = "USER_DELETED";
    EventType["USER_LOGIN"] = "USER_LOGIN";
    EventType["TENANT_CREATED"] = "TENANT_CREATED";
    EventType["TENANT_UPDATED"] = "TENANT_UPDATED";
    EventType["TENANT_SUSPENDED"] = "TENANT_SUSPENDED";
    EventType["INVOICE_CREATED"] = "INVOICE_CREATED";
    EventType["INVOICE_PAID"] = "INVOICE_PAID";
    EventType["INVOICE_OVERDUE"] = "INVOICE_OVERDUE";
    EventType["USAGE_RECORDED"] = "USAGE_RECORDED";
    EventType["PAYMENT_INITIATED"] = "PAYMENT_INITIATED";
    EventType["PAYMENT_SUCCEEDED"] = "PAYMENT_SUCCEEDED";
    EventType["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    EventType["PAYMENT_REFUNDED"] = "PAYMENT_REFUNDED";
    EventType["NOTIFICATION_SENT"] = "NOTIFICATION_SENT";
    EventType["NOTIFICATION_FAILED"] = "NOTIFICATION_FAILED";
})(EventType || (exports.EventType = EventType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "HEALTHY";
    HealthStatus["DEGRADED"] = "DEGRADED";
    HealthStatus["UNHEALTHY"] = "UNHEALTHY";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
//# sourceMappingURL=index.js.map