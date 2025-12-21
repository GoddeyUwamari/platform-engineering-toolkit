import Redis from 'ioredis';
export declare const connectRedis: () => Promise<Redis>;
export declare const getRedisClient: () => Redis;
export declare const disconnectRedis: () => Promise<void>;
export declare const isRedisConnected: () => boolean;
export declare const checkRedisHealth: () => Promise<boolean>;
export declare const getRedisInfo: () => {
    connected: boolean;
    status: string;
    host?: undefined;
    port?: undefined;
    db?: undefined;
} | {
    connected: boolean;
    status: "close" | "end" | "connect" | "wait" | "reconnecting" | "connecting" | "ready";
    host: string | undefined;
    port: number | undefined;
    db: number | undefined;
};
//# sourceMappingURL=redis-connection.d.ts.map