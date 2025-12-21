/**
 * Session Service
 * 
 * Manages user sessions in Redis with automatic expiration.
 * Stores session data including tokens, user info, and metadata.
 * 
 * Session Types:
 * - Access Token Sessions: Short-lived (15 minutes)
 * - Refresh Token Sessions: Long-lived (7 days)
 * - User Active Sessions: Track all active sessions per user
 */

import { getRedisClient } from './redis-connection';
import { logger } from '../utils/logger';

/**
 * Session Data Structure
 * Contains all information needed to validate and manage a user session
 */
export interface SessionData {
  userId: string;           // User's unique ID
  tenantId: string;         // Tenant (company) ID for multi-tenancy
  email: string;            // User's email address
  role: string;             // User's role (SUPER_ADMIN, ADMIN, USER, etc.)
  accessToken: string;      // JWT access token
  refreshToken: string;     // JWT refresh token
  createdAt: string;        // ISO timestamp when session was created
  lastActivity: string;     // ISO timestamp of last activity
  ipAddress?: string;       // Optional: Client IP address
  userAgent?: string;       // Optional: Client user agent (browser info)
}

/**
 * Session Configuration Constants
 * Matches JWT token expiration times from docker-compose.yml
 */
const SESSION_CONFIG = {
  // Access token session TTL: 15 minutes (900 seconds)
  // Matches JWT_EXPIRES_IN=15m in docker-compose.yml
  ACCESS_TOKEN_TTL: 15 * 60,
  
  // Refresh token session TTL: 7 days (604800 seconds)
  // Matches JWT_REFRESH_EXPIRES_IN=7d in docker-compose.yml
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60,
  
  // Redis key prefixes for organization and easy querying
  ACCESS_TOKEN_PREFIX: 'session:access:',      // e.g., session:access:abc123
  REFRESH_TOKEN_PREFIX: 'session:refresh:',    // e.g., session:refresh:xyz789
  USER_SESSIONS_PREFIX: 'user:sessions:',      // e.g., user:sessions:user-id-123
};

/**
 * Session Service Class
 * All methods are static - no need to instantiate
 */
export class SessionService {
  
  // ==========================================================================
  // CREATE SESSION
  // ==========================================================================
  
  /**
   * Create a new session for a user after successful login
   * Stores both access token and refresh token sessions in Redis
   * 
   * @param accessToken - JWT access token
   * @param refreshToken - JWT refresh token
   * @param sessionData - User and session information
   * @returns Promise<void>
   */
  static async createSession(
    accessToken: string,
    refreshToken: string,
    sessionData: SessionData
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const now = new Date().toISOString();
      
      // Prepare session data with timestamps
      const dataToStore = {
        ...sessionData,
        createdAt: now,
        lastActivity: now,
      };

      logger.info('💾 Creating session for user', {
        userId: sessionData.userId,
        email: sessionData.email,
        role: sessionData.role,
      });

      // ======================================================================
      // STEP 1: Store Access Token Session (15 minutes)
      // ======================================================================
      const accessKey = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      
      await redis.setex(
        accessKey,                              // Key: session:access:token
        SESSION_CONFIG.ACCESS_TOKEN_TTL,        // TTL: 900 seconds (15 min)
        JSON.stringify(dataToStore)             // Value: JSON session data
      );
      
      logger.debug('✅ Access token session created', {
        key: accessKey,
        ttl: `${SESSION_CONFIG.ACCESS_TOKEN_TTL}s (15 min)`,
      });

      // ======================================================================
      // STEP 2: Store Refresh Token Session (7 days)
      // ======================================================================
      const refreshKey = `${SESSION_CONFIG.REFRESH_TOKEN_PREFIX}${refreshToken}`;
      
      await redis.setex(
        refreshKey,                             // Key: session:refresh:token
        SESSION_CONFIG.REFRESH_TOKEN_TTL,       // TTL: 604800 seconds (7 days)
        JSON.stringify(dataToStore)             // Value: JSON session data
      );
      
      logger.debug('✅ Refresh token session created', {
        key: refreshKey,
        ttl: `${SESSION_CONFIG.REFRESH_TOKEN_TTL}s (7 days)`,
      });

      // ======================================================================
      // STEP 3: Track User's Active Sessions (for logout all devices)
      // ======================================================================
      const userSessionsKey = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${sessionData.userId}`;
      
      // Add this session to user's active sessions set
      await redis.sadd(userSessionsKey, accessToken);
      
      // Set expiration on the user's sessions set (7 days)
      await redis.expire(userSessionsKey, SESSION_CONFIG.REFRESH_TOKEN_TTL);
      
      logger.debug('✅ User session tracked', {
        key: userSessionsKey,
        totalSessions: await redis.scard(userSessionsKey),
      });

      logger.info('🎉 Session created successfully', {
        userId: sessionData.userId,
        email: sessionData.email,
      });

    } catch (error) {
      logger.error('❌ Failed to create session:', { error });
      throw new Error('Failed to create session in Redis');
    }
  }

  // ==========================================================================
  // GET SESSION BY TOKEN
  // ==========================================================================
  
  /**
   * Retrieve session data by access token
   * Used to validate requests and get user info from token
   * 
   * @param accessToken - JWT access token
   * @returns Promise<SessionData | null> - Session data or null if not found/expired
   */
  static async getSessionByAccessToken(accessToken: string): Promise<SessionData | null> {
    try {
      const redis = getRedisClient();
      const key = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      
      // Get session data from Redis
      const sessionJson = await redis.get(key);
      
      if (!sessionJson) {
        logger.debug('⚠️  Session not found or expired', { key });
        return null;
      }
      
      // Parse JSON string back to object
      const sessionData: SessionData = JSON.parse(sessionJson);
      
      logger.debug('✅ Session retrieved', {
        userId: sessionData.userId,
        email: sessionData.email,
      });
      
      return sessionData;

    } catch (error) {
      logger.error('❌ Failed to get session by access token:', { error });
      return null;
    }
  }

  /**
   * Retrieve session data by refresh token
   * Used when refreshing access tokens
   * 
   * @param refreshToken - JWT refresh token
   * @returns Promise<SessionData | null> - Session data or null if not found/expired
   */
  static async getSessionByRefreshToken(refreshToken: string): Promise<SessionData | null> {
    try {
      const redis = getRedisClient();
      const key = `${SESSION_CONFIG.REFRESH_TOKEN_PREFIX}${refreshToken}`;
      
      const sessionJson = await redis.get(key);
      
      if (!sessionJson) {
        logger.debug('⚠️  Refresh session not found or expired', { key });
        return null;
      }
      
      const sessionData: SessionData = JSON.parse(sessionJson);
      
      logger.debug('✅ Refresh session retrieved', {
        userId: sessionData.userId,
        email: sessionData.email,
      });
      
      return sessionData;

    } catch (error) {
      logger.error('❌ Failed to get session by refresh token:', { error });
      return null;
    }
  }

  // ==========================================================================
  // UPDATE SESSION ACTIVITY
  // ==========================================================================
  
  /**
   * Update last activity timestamp for a session
   * Call this on each authenticated request to track user activity
   * 
   * @param accessToken - JWT access token
   * @returns Promise<void>
   */
  static async updateSessionActivity(accessToken: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      
      // Get current session data
      const sessionJson = await redis.get(key);
      
      if (!sessionJson) {
        logger.debug('⚠️  Cannot update activity: session not found');
        return;
      }
      
      // Parse, update timestamp, store back
      const sessionData: SessionData = JSON.parse(sessionJson);
      sessionData.lastActivity = new Date().toISOString();
      
      // Get remaining TTL to preserve expiration time
      const ttl = await redis.ttl(key);
      
      if (ttl > 0) {
        // Update session with same TTL
        await redis.setex(key, ttl, JSON.stringify(sessionData));
        
        logger.debug('✅ Session activity updated', {
          userId: sessionData.userId,
          lastActivity: sessionData.lastActivity,
          remainingTTL: `${ttl}s`,
        });
      }

    } catch (error) {
      logger.error('❌ Failed to update session activity:', { error });
      // Don't throw - activity update failure shouldn't break the request
    }
  }

  // ==========================================================================
  // DELETE SESSION (LOGOUT)
  // ==========================================================================
  
  /**
   * Delete a single session (logout from one device)
   * Removes both access and refresh token sessions
   * 
   * @param accessToken - JWT access token
   * @param refreshToken - JWT refresh token
   * @param userId - User ID (to update active sessions)
   * @returns Promise<void>
   */
  static async deleteSession(
    accessToken: string,
    refreshToken: string,
    userId: string
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      
      const accessKey = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      const refreshKey = `${SESSION_CONFIG.REFRESH_TOKEN_PREFIX}${refreshToken}`;
      const userSessionsKey = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;

      logger.info('🗑️  Deleting session', { userId });

      // Delete access token session
      await redis.del(accessKey);
      
      // Delete refresh token session
      await redis.del(refreshKey);
      
      // Remove from user's active sessions set
      await redis.srem(userSessionsKey, accessToken);

      logger.info('✅ Session deleted (logout successful)', { userId });

    } catch (error) {
      logger.error('❌ Failed to delete session:', { error });
      throw new Error('Failed to logout');
    }
  }

  // ==========================================================================
  // DELETE ALL USER SESSIONS (LOGOUT ALL DEVICES)
  // ==========================================================================
  
  /**
   * Delete all sessions for a user (logout from all devices)
   * Useful for security actions like password change or compromised account
   * 
   * @param userId - User ID
   * @returns Promise<number> - Number of sessions deleted
   */
  static async deleteAllUserSessions(userId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const userSessionsKey = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;
      
      logger.info('🗑️  Deleting all sessions for user', { userId });

      // Get all access tokens for this user
      const accessTokens = await redis.smembers(userSessionsKey);
      
      if (accessTokens.length === 0) {
        logger.info('ℹ️  No active sessions found for user', { userId });
        return 0;
      }

      // Build array of keys to delete
      const keysToDelete: string[] = [];
      
      for (const token of accessTokens) {
        keysToDelete.push(`${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${token}`);
        // Note: We don't have refresh tokens here, they'll expire naturally
      }
      
      // Delete all access token sessions
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }
      
      // Delete the user's sessions set
      await redis.del(userSessionsKey);

      logger.info('✅ All user sessions deleted', {
        userId,
        sessionsDeleted: accessTokens.length,
      });

      return accessTokens.length;

    } catch (error) {
      logger.error('❌ Failed to delete all user sessions:', { error });
      throw new Error('Failed to logout from all devices');
    }
  }

  // ==========================================================================
  // GET USER ACTIVE SESSIONS COUNT
  // ==========================================================================
  
  /**
   * Get the number of active sessions for a user
   * Useful for displaying "You're logged in on 3 devices"
   * 
   * @param userId - User ID
   * @returns Promise<number> - Number of active sessions
   */
  static async getUserActiveSessionsCount(userId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const userSessionsKey = `${SESSION_CONFIG.USER_SESSIONS_PREFIX}${userId}`;
      
      const count = await redis.scard(userSessionsKey);
      
      logger.debug('📊 Active sessions count', { userId, count });
      
      return count;

    } catch (error) {
      logger.error('❌ Failed to get active sessions count:', { error });
      return 0;
    }
  }

  // ==========================================================================
  // SESSION VALIDATION
  // ==========================================================================
  
  /**
   * Check if a session exists and is valid
   * Quick check without retrieving full session data
   * 
   * @param accessToken - JWT access token
   * @returns Promise<boolean> - True if session exists
   */
  static async isSessionValid(accessToken: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const key = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      
      // EXISTS returns 1 if key exists, 0 if not
      const exists = await redis.exists(key);
      
      return exists === 1;

    } catch (error) {
      logger.error('❌ Failed to validate session:', { error });
      return false;
    }
  }

  // ==========================================================================
  // GET SESSION TTL
  // ==========================================================================
  
  /**
   * Get remaining time-to-live for a session
   * Useful for showing "Session expires in X minutes"
   * 
   * @param accessToken - JWT access token
   * @returns Promise<number> - Remaining seconds (-2 if not found, -1 if no expiry)
   */
  static async getSessionTTL(accessToken: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const key = `${SESSION_CONFIG.ACCESS_TOKEN_PREFIX}${accessToken}`;
      
      const ttl = await redis.ttl(key);
      
      logger.debug('⏱️  Session TTL', {
        key,
        ttl: ttl > 0 ? `${ttl}s (${Math.floor(ttl / 60)} min)` : ttl,
      });
      
      return ttl;

    } catch (error) {
      logger.error('❌ Failed to get session TTL:', { error });
      return -2;
    }
  }
}