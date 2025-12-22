import { Request, Response, NextFunction } from 'express';
import { userService } from '../../../services/user.service';
import { UserRole, UserStatus } from '../../../models/user.entity';
import {
  CreateUserBody,
  UpdateUserBody,
  ChangePasswordBody,
  UserIdParams,
  UserListQuery,
} from '../../../types/request.types';

/**
 * User Controller
 *
 * Handles HTTP requests for user operations
 * Implements RESTful API endpoints
 */

export class UserController {
  /**
   * Create new user
   * POST /api/v1/users
   */
  async createUser(
    req: Request<object, object, CreateUserBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      const user = await userService.createUser({
        email,
        password,
        firstName,
        lastName,
        role: role as UserRole,
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  async getUserById(req: Request<UserIdParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const user = await userService.findById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users with pagination
   * GET /api/v1/users
   */
  async getAllUsers(
    req: Request<object, object, object, UserListQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const role = req.query.role;
      const status = req.query.status;

      const where: Record<string, unknown> = {};
      if (role) where.role = role;
      if (status) where.status = status;

      const result = await userService.findAll({
        page,
        limit,
        where,
        order: { createdAt: 'DESC' },
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user
   * PUT /api/v1/users/:id
   */
  async updateUser(
    req: Request<UserIdParams, object, UpdateUserBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, role, status } = req.body;

      const user = await userService.updateUser(id, {
        email,
        firstName,
        lastName,
        role: role as UserRole,
        status: status as UserStatus,
      });

      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /api/v1/users/:id
   */
  async deleteUser(req: Request<UserIdParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await userService.deleteUser(id);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's tasks
   * GET /api/v1/users/:id/tasks
   */
  async getUserTasks(req: Request<UserIdParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const user = await userService.getUserWithTasks(id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          assignedTasks: user.assignedTasks || [],
          createdTasks: user.createdTasks || [],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * POST /api/v1/users/:id/change-password
   */
  async changePassword(
    req: Request<UserIdParams, object, ChangePasswordBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { oldPassword, newPassword } = req.body;

      await userService.changePassword(id, oldPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
