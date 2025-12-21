import { Request, Response, NextFunction } from 'express';
import { JwtPayload, UserRole } from '../types';
export declare const verifyAccessToken: (token: string) => JwtPayload;
export declare const verifyRefreshToken: (token: string) => JwtPayload;
export declare const generateAccessToken: (payload: Omit<JwtPayload, "iat" | "exp">) => string;
export declare const generateRefreshToken: (payload: Omit<JwtPayload, "iat" | "exp">) => string;
export declare const generateTokens: (payload: Omit<JwtPayload, "iat" | "exp">) => {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
};
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (...allowedRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireBillingAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateTenantAccess: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateResourceOwnership: (req: Request, res: Response, next: NextFunction) => void;
export declare const getRateLimitKey: (req: Request) => string;
declare const _default: {
    verifyAccessToken: (token: string) => JwtPayload;
    verifyRefreshToken: (token: string) => JwtPayload;
    generateAccessToken: (payload: Omit<JwtPayload, "iat" | "exp">) => string;
    generateRefreshToken: (payload: Omit<JwtPayload, "iat" | "exp">) => string;
    generateTokens: (payload: Omit<JwtPayload, "iat" | "exp">) => {
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresIn: number;
        refreshTokenExpiresIn: number;
    };
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
    optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
    requireRole: (...allowedRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void;
    requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
    requireBillingAdmin: (req: Request, res: Response, next: NextFunction) => void;
    requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
    validateTenantAccess: (req: Request, res: Response, next: NextFunction) => void;
    validateResourceOwnership: (req: Request, res: Response, next: NextFunction) => void;
    getRateLimitKey: (req: Request) => string;
};
export default _default;
//# sourceMappingURL=auth.middleware.d.ts.map