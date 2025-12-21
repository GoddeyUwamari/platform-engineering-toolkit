"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimitKey = exports.validateResourceOwnership = exports.validateTenantAccess = exports.requireSuperAdmin = exports.requireBillingAdmin = exports.requireAdmin = exports.requireRole = exports.optionalAuth = exports.requireAuth = exports.generateTokens = exports.generateRefreshToken = exports.generateAccessToken = exports.verifyRefreshToken = exports.verifyAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const error_handler_1 = require("./error-handler");
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key-change-this';
const verifyAccessToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new error_handler_1.AuthenticationError('Access token has expired');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new error_handler_1.AuthenticationError('Invalid access token');
        }
        throw new error_handler_1.AuthenticationError('Token verification failed');
    }
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, REFRESH_TOKEN_SECRET);
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new error_handler_1.AuthenticationError('Refresh token has expired');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new error_handler_1.AuthenticationError('Invalid refresh token');
        }
        throw new error_handler_1.AuthenticationError('Token verification failed');
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
const generateAccessToken = (payload) => {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn,
        issuer: 'cloudbill',
        audience: 'cloudbill-api',
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
    return jsonwebtoken_1.default.sign(payload, REFRESH_TOKEN_SECRET, {
        expiresIn,
        issuer: 'cloudbill',
        audience: 'cloudbill-api',
    });
};
exports.generateRefreshToken = generateRefreshToken;
const generateTokens = (payload) => {
    const accessToken = (0, exports.generateAccessToken)(payload);
    const refreshToken = (0, exports.generateRefreshToken)(payload);
    const accessTokenExpiry = jsonwebtoken_1.default.decode(accessToken);
    const refreshTokenExpiry = jsonwebtoken_1.default.decode(refreshToken);
    return {
        accessToken,
        refreshToken,
        accessTokenExpiresIn: accessTokenExpiry.exp - accessTokenExpiry.iat,
        refreshTokenExpiresIn: refreshTokenExpiry.exp - refreshTokenExpiry.iat,
    };
};
exports.generateTokens = generateTokens;
const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
        return cookieToken;
    }
    return null;
};
exports.requireAuth = (0, error_handler_1.asyncHandler)(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) {
        throw new error_handler_1.AuthenticationError('No authentication token provided');
    }
    const decoded = (0, exports.verifyAccessToken)(token);
    req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
        userAgent: req.get('user-agent'),
    };
    logger_1.logger.debug('User authenticated', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
    });
    next();
});
exports.optionalAuth = (0, error_handler_1.asyncHandler)(async (req, _res, next) => {
    const token = extractToken(req);
    if (token) {
        try {
            const decoded = (0, exports.verifyAccessToken)(token);
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                tenantId: decoded.tenantId,
                userAgent: req.get('user-agent'),
            };
            logger_1.logger.debug('Optional auth: User authenticated', {
                userId: decoded.userId,
            });
        }
        catch (error) {
            logger_1.logger.debug('Optional auth: Invalid token, continuing without user');
        }
    }
    next();
});
const requireRole = (...allowedRoles) => {
    return (0, error_handler_1.asyncHandler)(async (req, _res, next) => {
        if (!req.user) {
            throw new error_handler_1.AuthenticationError('Authentication required');
        }
        if (!allowedRoles.includes(req.user.role)) {
            logger_1.logger.warn('Authorization failed - insufficient permissions', {
                userId: req.user.userId,
                userRole: req.user.role,
                requiredRoles: allowedRoles,
            });
            throw new error_handler_1.AuthorizationError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
        }
        logger_1.logger.debug('Authorization successful', {
            userId: req.user.userId,
            userRole: req.user.role,
        });
        next();
    });
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.ADMIN);
exports.requireBillingAdmin = (0, exports.requireRole)(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.ADMIN, types_1.UserRole.BILLING_ADMIN);
exports.requireSuperAdmin = (0, exports.requireRole)(types_1.UserRole.SUPER_ADMIN);
exports.validateTenantAccess = (0, error_handler_1.asyncHandler)(async (req, _res, next) => {
    if (!req.user) {
        throw new error_handler_1.AuthenticationError('Authentication required');
    }
    const requestedTenantId = req.params.tenantId || req.body.tenantId;
    if (req.user.role === types_1.UserRole.SUPER_ADMIN) {
        next();
        return;
    }
    if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
        logger_1.logger.warn('Tenant access denied', {
            userId: req.user.userId,
            userTenantId: req.user.tenantId,
            requestedTenantId,
        });
        throw new error_handler_1.AuthorizationError('Access denied to this tenant');
    }
    next();
});
exports.validateResourceOwnership = (0, error_handler_1.asyncHandler)(async (req, _res, next) => {
    if (!req.user) {
        throw new error_handler_1.AuthenticationError('Authentication required');
    }
    const requestedUserId = req.params.userId || req.body.userId;
    if (req.user.role === types_1.UserRole.SUPER_ADMIN ||
        req.user.role === types_1.UserRole.ADMIN) {
        next();
        return;
    }
    if (requestedUserId && requestedUserId !== req.user.userId) {
        logger_1.logger.warn('Resource ownership validation failed', {
            userId: req.user.userId,
            requestedUserId,
        });
        throw new error_handler_1.AuthorizationError('Access denied to this resource');
    }
    next();
});
const getRateLimitKey = (req) => {
    if (req.user) {
        return `ratelimit:user:${req.user.userId}`;
    }
    return `ratelimit:ip:${req.ip}`;
};
exports.getRateLimitKey = getRateLimitKey;
exports.default = {
    verifyAccessToken: exports.verifyAccessToken,
    verifyRefreshToken: exports.verifyRefreshToken,
    generateAccessToken: exports.generateAccessToken,
    generateRefreshToken: exports.generateRefreshToken,
    generateTokens: exports.generateTokens,
    requireAuth: exports.requireAuth,
    optionalAuth: exports.optionalAuth,
    requireRole: exports.requireRole,
    requireAdmin: exports.requireAdmin,
    requireBillingAdmin: exports.requireBillingAdmin,
    requireSuperAdmin: exports.requireSuperAdmin,
    validateTenantAccess: exports.validateTenantAccess,
    validateResourceOwnership: exports.validateResourceOwnership,
    getRateLimitKey: exports.getRateLimitKey,
};
//# sourceMappingURL=auth.middleware.js.map