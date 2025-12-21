"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRuleError = exports.setupErrorHandlers = exports.handleUnhandledRejection = exports.handleUncaughtException = exports.parseDatabaseError = exports.parseValidationError = exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = exports.ExternalServiceError = exports.DatabaseError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    code;
    isOperational;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(message, 400, 'VALIDATION_ERROR', true, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR', true);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR', true);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND', true);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT_ERROR', true);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', details) {
        super(message, 500, 'DATABASE_ERROR', true, details);
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
exports.DatabaseError = DatabaseError;
class ExternalServiceError extends AppError {
    constructor(service, message = 'External service unavailable') {
        super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true);
        Object.setPrototypeOf(this, ExternalServiceError.prototype);
    }
}
exports.ExternalServiceError = ExternalServiceError;
const formatErrorResponse = (error, code) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse = {
        code,
        message: error.message || 'An unexpected error occurred',
    };
    if (error instanceof AppError && error.details) {
        errorResponse.details = error.details;
    }
    if (isDevelopment && error.stack) {
        errorResponse.stack = error.stack;
    }
    return errorResponse;
};
const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        logger_1.logger.warn('Operational error occurred', {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
            details: err.details,
        });
    }
    else {
        logger_1.logger.error('Unexpected error occurred', {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
        });
    }
    const errorResponse = formatErrorResponse(err, code);
    const response = {
        success: false,
        error: errorResponse,
        timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, _res, next) => {
    const error = new NotFoundError(`Route ${req.method} ${req.path}`);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const parseValidationError = (error) => {
    const details = {};
    if (error.name === 'ZodError' && error.errors) {
        error.errors.forEach((err) => {
            const path = err.path.join('.');
            details[path] = err.message;
        });
        return new ValidationError('Validation failed', details);
    }
    if (error.isJoi && error.details) {
        error.details.forEach((err) => {
            const path = err.path.join('.');
            details[path] = err.message;
        });
        return new ValidationError('Validation failed', details);
    }
    return new ValidationError(error.message);
};
exports.parseValidationError = parseValidationError;
const parseDatabaseError = (error) => {
    if (error.code === '23505') {
        return new ConflictError('A record with this value already exists');
    }
    if (error.code === '23503') {
        return new ValidationError('Referenced record does not exist');
    }
    if (error.code === '23502') {
        return new ValidationError('Required field is missing');
    }
    if (error.code === '23514') {
        return new ValidationError('Invalid value provided');
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new DatabaseError('Database connection failed');
    }
    return new DatabaseError('Database operation failed', {
        code: error.code,
        detail: error.detail,
    });
};
exports.parseDatabaseError = parseDatabaseError;
const handleUncaughtException = () => {
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    });
};
exports.handleUncaughtException = handleUncaughtException;
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('UNHANDLED REJECTION! Shutting down...', {
            reason: reason instanceof Error ? reason.message : reason,
            stack: reason instanceof Error ? reason.stack : undefined,
        });
        process.exit(1);
    });
};
exports.handleUnhandledRejection = handleUnhandledRejection;
const setupErrorHandlers = () => {
    (0, exports.handleUncaughtException)();
    (0, exports.handleUnhandledRejection)();
    logger_1.logger.info('Error handlers initialized');
};
exports.setupErrorHandlers = setupErrorHandlers;
class BusinessRuleError extends AppError {
    constructor(message = 'Business rule violation') {
        super(message, 422, 'BUSINESS_RULE_ERROR', true);
        Object.setPrototypeOf(this, BusinessRuleError.prototype);
    }
}
exports.BusinessRuleError = BusinessRuleError;
exports.default = {
    errorHandler: exports.errorHandler,
    notFoundHandler: exports.notFoundHandler,
    asyncHandler: exports.asyncHandler,
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    BusinessRuleError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    parseValidationError: exports.parseValidationError,
    parseDatabaseError: exports.parseDatabaseError,
    setupErrorHandlers: exports.setupErrorHandlers,
};
//# sourceMappingURL=error-handler.js.map