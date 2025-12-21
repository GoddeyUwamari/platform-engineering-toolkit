import { Pool, PoolClient } from 'pg';
export declare const initializeDatabase: () => Promise<void>;
export declare const getPool: () => Pool;
export declare const getClient: () => Promise<PoolClient>;
export declare const query: <T = any>(text: string, params?: any[]) => Promise<T[]>;
export declare const queryOne: <T = any>(text: string, params?: any[]) => Promise<T | null>;
export declare const setTenantContext: (tenantId: string, client?: PoolClient) => Promise<void>;
export declare const clearTenantContext: (client?: PoolClient) => Promise<void>;
export declare const closeDatabase: () => Promise<void>;
//# sourceMappingURL=connection.d.ts.map