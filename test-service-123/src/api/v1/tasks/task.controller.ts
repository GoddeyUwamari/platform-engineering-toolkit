import { Request, Response, NextFunction } from 'express';
import { taskService } from '../../../services/task.service';
import { TaskStatus, TaskPriority } from '../../../models/task.entity';
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskStatusBody,
  AssignTaskBody,
  TaskIdParams,
  TaskListQuery,
  PaginationQuery,
} from '../../../types/request.types';

/**
 * Task Controller
 *
 * Handles HTTP requests for task operations
 * Implements RESTful API endpoints
 */

export class TaskController {
  /**
   * Create new task
   * POST /api/v1/tasks
   */
  async createTask(
    req: Request<object, object, CreateTaskBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, status, priority, dueDate, assigneeId, createdById } = req.body;

      // For now, we'll require createdById in the body
      // In Phase 3 (Authentication), we'll get this from the authenticated user
      if (!createdById) {
        res.status(400).json({
          success: false,
          error: { message: 'createdById is required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const task = await taskService.createTask({
        title,
        description,
        status: status as TaskStatus,
        priority: priority as TaskPriority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId,
        createdById,
      });

      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get task by ID
   * GET /api/v1/tasks/:id
   */
  async getTaskById(req: Request<TaskIdParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const task = await taskService.findById(id);

      if (!task) {
        res.status(404).json({
          success: false,
          error: { message: 'Task not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: task,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all tasks with pagination and filters
   * GET /api/v1/tasks
   */
  async getAllTasks(
    req: Request<object, object, object, TaskListQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status;
      const priority = req.query.priority;
      const assigneeId = req.query.assigneeId;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (assigneeId) where.assigneeId = assigneeId;

      const result = await taskService.findAll({
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
   * Update task
   * PUT /api/v1/tasks/:id
   */
  async updateTask(
    req: Request<TaskIdParams, object, UpdateTaskBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, status, priority, dueDate, assigneeId } = req.body;

      const task = await taskService.updateTask(id, {
        title,
        description,
        status: status as TaskStatus,
        priority: priority as TaskPriority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId,
      });

      res.status(200).json({
        success: true,
        data: task,
        message: 'Task updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update task status
   * PATCH /api/v1/tasks/:id/status
   */
  async updateTaskStatus(
    req: Request<TaskIdParams, object, UpdateTaskStatusBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const task = await taskService.updateStatus(id, status);

      res.status(200).json({
        success: true,
        data: task,
        message: 'Task status updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign task to user
   * PATCH /api/v1/tasks/:id/assign
   */
  async assignTask(
    req: Request<TaskIdParams, object, AssignTaskBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { assigneeId } = req.body;

      const task = await taskService.assignTask(id, assigneeId);

      res.status(200).json({
        success: true,
        data: task,
        message: 'Task assigned successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete task (soft delete)
   * DELETE /api/v1/tasks/:id
   */
  async deleteTask(req: Request<TaskIdParams>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await taskService.deleteTask(id);

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overdue tasks
   * GET /api/v1/tasks/overdue
   */
  async getOverdueTasks(
    req: Request<object, object, object, PaginationQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await taskService.findOverdue({ page, limit });

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
}

export const taskController = new TaskController();
