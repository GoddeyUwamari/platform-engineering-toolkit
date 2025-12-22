import { body, param, query } from 'express-validator';
import { UserRole, UserStatus } from '../../../models/user.entity';

/**
 * User Validation Rules
 *
 * Input validation for user-related API endpoints
 */

export const createUserValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be at most 100 characters'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be at most 100 characters'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
];

export const updateUserValidator = [
  param('id').isUUID().withMessage('Valid user ID is required'),

  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be at most 100 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be at most 100 characters'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),

  body('status')
    .optional()
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
];

export const changePasswordValidator = [
  param('id').isUUID().withMessage('Valid user ID is required'),

  body('oldPassword').notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
];

export const getUserValidator = [param('id').isUUID().withMessage('Valid user ID is required')];

export const deleteUserValidator = [param('id').isUUID().withMessage('Valid user ID is required')];

export const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),

  query('status')
    .optional()
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
];
