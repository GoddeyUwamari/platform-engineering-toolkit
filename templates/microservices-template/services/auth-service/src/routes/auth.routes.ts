import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '@shared/middleware/auth.middleware';

/**
 * Authentication Routes
 * Defines all authentication-related endpoints
 */

const router = Router();

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
router.post('/login', AuthController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', AuthController.refreshToken);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with token
 * @access  Public
 */
router.post('/verify-email', AuthController.verifyEmail);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', AuthController.resetPassword);

/**
 * @route   GET /api/auth/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', AuthController.healthCheck);

// ============================================================================
// Protected Routes (Authentication Required)
// ============================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout', requireAuth, AuthController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password (requires current password)
 * @access  Private
 */
router.post('/change-password', requireAuth, AuthController.changePassword);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', requireAuth, AuthController.getProfile);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.patch('/profile', requireAuth, AuthController.updateProfile);

/**
 * @route   GET /api/auth/tenants
 * @desc    Get list of tenants with optional search
 * @access  Private
 */
router.get('/tenants', requireAuth, AuthController.getTenants);

// ============================================================================
// Export Router
// ============================================================================

export default router;