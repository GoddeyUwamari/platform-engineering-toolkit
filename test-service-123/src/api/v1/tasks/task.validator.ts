import { body, param, query } from 'express-validator';
import { TaskStatus, TaskPriority } from '../../../models/task.entity';

/**
 * Task Validation Rules
 *
 * Input validation for task-related API endpoints
 */

export const createTaskValidator = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be at most 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be at most 5000 characters'),

  body('status')
    .optional()
    .isIn(Object.values(TaskStatus))
    .withMessage(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`),

  body('priority')
    .optional()
    .isIn(Object.values(TaskPriority))
    .withMessage(`Priority must be one of: ${Object.values(TaskPriority).join(', ')}`),

  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid ISO 8601 date'),

  body('assigneeId').optional().isUUID().withMessage('Assignee ID must be a valid UUID'),
];

export const updateTaskValidator = [
  param('id').isUUID().withMessage('Valid task ID is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be at most 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be at most 5000 characters'),

  body('status')
    .optional()
    .isIn(Object.values(TaskStatus))
    .withMessage(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`),

  body('priority')
    .optional()
    .isIn(Object.values(TaskPriority))
    .withMessage(`Priority must be one of: ${Object.values(TaskPriority).join(', ')}`),

  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid ISO 8601 date'),

  body('assigneeId').optional().isUUID().withMessage('Assignee ID must be a valid UUID'),
];

export const updateTaskStatusValidator = [
  param('id').isUUID().withMessage('Valid task ID is required'),

  body('status')
    .isIn(Object.values(TaskStatus))
    .withMessage(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`),
];

export const assignTaskValidator = [
  param('id').isUUID().withMessage('Valid task ID is required'),

  body('assigneeId').isUUID().withMessage('Assignee ID must be a valid UUID'),
];

export const getTaskValidator = [param('id').isUUID().withMessage('Valid task ID is required')];

export const deleteTaskValidator = [param('id').isUUID().withMessage('Valid task ID is required')];

export const listTasksValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(Object.values(TaskStatus))
    .withMessage(`Status must be one of: ${Object.values(TaskStatus).join(', ')}`),

  query('priority')
    .optional()
    .isIn(Object.values(TaskPriority))
    .withMessage(`Priority must be one of: ${Object.values(TaskPriority).join(', ')}`),

  query('assigneeId').optional().isUUID().withMessage('Assignee ID must be a valid UUID'),
];
