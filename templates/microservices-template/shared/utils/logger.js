"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.generateCorrelationId = generateCorrelationId;
exports.createServiceLogger = createServiceLogger;
exports.logPerformance = logPerformance;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
winston_1.default.addColors(colors);
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, service, correlationId, tenantId, duration, error, ...rest } = info;
    let log = `${timestamp} [${level}]`;
    if (service) {
        log += ` [${service}]`;
    }
    if (correlationId && typeof correlationId === 'string') {
        log += ` [${correlationId.substring(0, 8)}]`;
    }
    if (tenantId && typeof tenantId === 'string') {
        log += ` [tenant:${tenantId.substring(0, 8)}]`;
    }
    log += `: ${message}`;
    if (duration !== undefined) {
        log += ` (${duration}ms)`;
    }
    const metadata = Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '';
    if (metadata) {
        log += `\n${metadata}`;
    }
    if (error && typeof error === 'object' && error.stack) {
        log += `\n${error.stack}`;
    }
    return log;
}));
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const transports = [
    new winston_1.default.transports.Console({
        format: isDevelopment ? developmentFormat : productionFormat,
        level: LOG_LEVEL,
    }),
];
if (NODE_ENV !== 'test') {
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: LOG_LEVEL,
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
        level: 'error',
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path.join(logsDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format: fileFormat,
        level: 'http',
    }));
}
const Logger = winston_1.default.createLogger({
    level: LOG_LEVEL,
    levels,
    transports,
    exitOnError: false,
    exceptionHandlers: NODE_ENV !== 'test' ? [
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: fileFormat,
        })
    ] : [],
    rejectionHandlers: NODE_ENV !== 'test' ? [
        new winston_1.default.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: fileFormat,
        })
    ] : [],
});
exports.logger = {
    error: (message, meta) => {
        const metadata = formatMetadata(meta);
        Logger.error(message, metadata);
    },
    warn: (message, meta) => {
        const metadata = formatMetadata(meta);
        Logger.warn(message, metadata);
    },
    info: (message, meta) => {
        const metadata = formatMetadata(meta);
        Logger.info(message, metadata);
    },
    http: (message, meta) => {
        const metadata = formatMetadata(meta);
        Logger.http(message, metadata);
    },
    debug: (message, meta) => {
        const metadata = formatMetadata(meta);
        Logger.debug(message, metadata);
    },
    child: (defaultMeta) => {
        return Logger.child({ ...formatMetadata(defaultMeta) });
    },
};
function formatMetadata(meta) {
    if (!meta)
        return {};
    const formatted = { ...meta };
    if (meta.error !== undefined && meta.error !== null) {
        if (meta.error instanceof Error) {
            formatted.error = {
                message: meta.error.message,
                stack: meta.error.stack,
                code: meta.error.code,
                name: meta.error.name,
            };
        }
        else if (typeof meta.error === 'string') {
            formatted.error = {
                message: meta.error,
            };
        }
        else if (typeof meta.error === 'object') {
            const errorObj = meta.error;
            formatted.error = {
                message: errorObj.message || JSON.stringify(meta.error),
                stack: errorObj.stack,
                code: errorObj.code,
                name: errorObj.name,
            };
        }
        else {
            formatted.error = {
                message: String(meta.error),
            };
        }
    }
    if (meta.duration !== undefined) {
        formatted.duration = meta.duration;
    }
    return formatted;
}
function generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
function createServiceLogger(serviceName) {
    return {
        error: (message, meta) => exports.logger.error(message, { ...meta, service: serviceName }),
        warn: (message, meta) => exports.logger.warn(message, { ...meta, service: serviceName }),
        info: (message, meta) => exports.logger.info(message, { ...meta, service: serviceName }),
        http: (message, meta) => exports.logger.http(message, { ...meta, service: serviceName }),
        debug: (message, meta) => exports.logger.debug(message, { ...meta, service: serviceName }),
    };
}
function logPerformance(operation, startTime, meta) {
    const duration = Date.now() - startTime;
    exports.logger.info(`${operation} completed`, {
        ...meta,
        duration,
    });
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map