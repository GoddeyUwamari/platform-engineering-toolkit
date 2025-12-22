import { Router, Request, Response, NextFunction } from 'express';
import { userController } from './user.controller';
import { validate } from '../../../middlewares/validation.middleware';
import {
  createUserValidator,
  updateUserValidator,
  getUserValidator,
  deleteUserValidator,
  listUsersValidator,
  changePasswordValidator,
} from './user.validator';

/**
 * User Routes
 *
 * RESTful API endpoints for user management
 */

const router = Router();

// Create wrapped handlers that properly handle async operations
// These wrappers cast req to unknown first to avoid unsafe-argument errors
const getAllUsersHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.getAllUsers(req as never, res, next);
};

const getUserByIdHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.getUserById(req as never, res, next);
};

const getUserTasksHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.getUserTasks(req as never, res, next);
};

const createUserHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.createUser(req as never, res, next);
};

const updateUserHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.updateUser(req as never, res, next);
};

const changePasswordHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.changePassword(req as never, res, next);
};

const deleteUserHandler = (req: Request, res: Response, next: NextFunction): void => {
  void userController.deleteUser(req as never, res, next);
};

// Wrap validate middleware to handle its async nature
const wrapValidate = (validations: ReturnType<typeof validate>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    void validations(req, res, next);
  };
};

// Get all users with pagination
router.get('/', wrapValidate(validate(listUsersValidator)), getAllUsersHandler);

// Get user by ID
router.get('/:id', wrapValidate(validate(getUserValidator)), getUserByIdHandler);

// Get user's tasks
router.get('/:id/tasks', wrapValidate(validate(getUserValidator)), getUserTasksHandler);

// Create new user
router.post('/', wrapValidate(validate(createUserValidator)), createUserHandler);

// Update user
router.put('/:id', wrapValidate(validate(updateUserValidator)), updateUserHandler);

// Change password
router.post(
  '/:id/change-password',
  wrapValidate(validate(changePasswordValidator)),
  changePasswordHandler
);

// Delete user (soft delete)
router.delete('/:id', wrapValidate(validate(deleteUserValidator)), deleteUserHandler);

export default router;
