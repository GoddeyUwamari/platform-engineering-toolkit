import { Router, Request, Response, NextFunction } from 'express';
import { taskController } from './task.controller';
import { validate } from '../../../middlewares/validation.middleware';
import {
  createTaskValidator,
  updateTaskValidator,
  updateTaskStatusValidator,
  assignTaskValidator,
  getTaskValidator,
  deleteTaskValidator,
  listTasksValidator,
} from './task.validator';

/**
 * Task Routes
 *
 * RESTful API endpoints for task management
 */

const router = Router();

// Create wrapped handlers that properly handle async operations
// These wrappers cast req to unknown first to avoid unsafe-argument errors
const getOverdueTasksHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.getOverdueTasks(req as never, res, next);
};

const getAllTasksHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.getAllTasks(req as never, res, next);
};

const getTaskByIdHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.getTaskById(req as never, res, next);
};

const createTaskHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.createTask(req as never, res, next);
};

const updateTaskHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.updateTask(req as never, res, next);
};

const updateTaskStatusHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.updateTaskStatus(req as never, res, next);
};

const assignTaskHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.assignTask(req as never, res, next);
};

const deleteTaskHandler = (req: Request, res: Response, next: NextFunction): void => {
  void taskController.deleteTask(req as never, res, next);
};

// Wrap validate middleware to handle its async nature
const wrapValidate = (validations: ReturnType<typeof validate>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    void validations(req, res, next);
  };
};

// Get overdue tasks (must be before /:id route)
router.get('/overdue', getOverdueTasksHandler);

// Get all tasks with pagination and filters
router.get('/', wrapValidate(validate(listTasksValidator)), getAllTasksHandler);

// Get task by ID
router.get('/:id', wrapValidate(validate(getTaskValidator)), getTaskByIdHandler);

// Create new task
router.post('/', wrapValidate(validate(createTaskValidator)), createTaskHandler);

// Update task
router.put('/:id', wrapValidate(validate(updateTaskValidator)), updateTaskHandler);

// Update task status
router.patch(
  '/:id/status',
  wrapValidate(validate(updateTaskStatusValidator)),
  updateTaskStatusHandler
);

// Assign task to user
router.patch('/:id/assign', wrapValidate(validate(assignTaskValidator)), assignTaskHandler);

// Delete task (soft delete)
router.delete('/:id', wrapValidate(validate(deleteTaskValidator)), deleteTaskHandler);

export default router;
