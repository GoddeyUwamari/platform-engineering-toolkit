import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean, details?: Record<string, unknown>);
}
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class DatabaseError extends AppError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class ExternalServiceError extends AppError {
    constructor(service: string, message?: string);
}
export declare const errorHandler: (err: Error, req: Request, res: Response, _next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, _res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const parseValidationError: (error: any) => ValidationError;
export declare const parseDatabaseError: (error: any) => AppError;
export declare const handleUncaughtException: () => void;
export declare const handleUnhandledRejection: () => void;
export declare const setupErrorHandlers: () => void;
export declare class BusinessRuleError extends AppError {
    constructor(message?: string);
}
declare const _default: {
    errorHandler: (err: Error, req: Request, res: Response, _next: NextFunction) => void;
    notFoundHandler: (req: Request, _res: Response, next: NextFunction) => void;
    asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
    AppError: typeof AppError;
    ValidationError: typeof ValidationError;
    AuthenticationError: typeof AuthenticationError;
    AuthorizationError: typeof AuthorizationError;
    NotFoundError: typeof NotFoundError;
    ConflictError: typeof ConflictError;
    BusinessRuleError: typeof BusinessRuleError;
    RateLimitError: typeof RateLimitError;
    DatabaseError: typeof DatabaseError;
    ExternalServiceError: typeof ExternalServiceError;
    parseValidationError: (error: any) => ValidationError;
    parseDatabaseError: (error: any) => AppError;
    setupErrorHandlers: () => void;
};
export default _default;
//# sourceMappingURL=error-handler.d.ts.map