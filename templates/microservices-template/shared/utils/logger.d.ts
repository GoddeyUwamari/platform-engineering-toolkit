import winston from 'winston';
export interface LogMetadata {
    service?: string;
    correlationId?: string;
    tenantId?: string;
    userId?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    duration?: number;
    ip?: string;
    userAgent?: string;
    error?: unknown;
    [key: string]: unknown;
}
export declare const logger: {
    error: (message: string, meta?: LogMetadata) => void;
    warn: (message: string, meta?: LogMetadata) => void;
    info: (message: string, meta?: LogMetadata) => void;
    http: (message: string, meta?: LogMetadata) => void;
    debug: (message: string, meta?: LogMetadata) => void;
    child: (defaultMeta: LogMetadata) => winston.Logger;
};
export declare function generateCorrelationId(): string;
export declare function createServiceLogger(serviceName: string): {
    error: (message: string, meta?: LogMetadata) => void;
    warn: (message: string, meta?: LogMetadata) => void;
    info: (message: string, meta?: LogMetadata) => void;
    http: (message: string, meta?: LogMetadata) => void;
    debug: (message: string, meta?: LogMetadata) => void;
};
export declare function logPerformance(operation: string, startTime: number, meta?: LogMetadata): void;
export default logger;
//# sourceMappingURL=logger.d.ts.map