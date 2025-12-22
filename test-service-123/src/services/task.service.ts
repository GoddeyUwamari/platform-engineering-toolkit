import { TaskRepository } from '../repositories/task.repository';
import { Task, TaskStatus, TaskPriority } from '../models/task.entity';
import { cacheService, CachePrefix, CacheTTL } from './cache.service';
import { PaginatedResult, PaginationOptions } from '../core/database/base.repository';

/**
 * Task Service
 *
 * Handles business logic for task operations
 * Implements caching strategy
 * Provides task management and assignment
 */

interface CreateTaskDTO {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeId?: string;
  createdById: string;
}

interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeId?: string;
}

export class TaskService {
  private taskRepository: TaskRepository;

  constructor() {
    this.taskRepository = new TaskRepository();
  }

  /**
   * Create new task
   */
  async createTask(data: CreateTaskDTO): Promise<Task> {
    try {
      const task = await this.taskRepository.create({
        title: data.title,
        description: data.description,
        status: data.status || TaskStatus.TODO,
        priority: data.priority || TaskPriority.MEDIUM,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
        createdById: data.createdById,
      });

      // Cache the new task
      await cacheService.set(`${CachePrefix.TASK}${task.id}`, task, CacheTTL.MEDIUM);

      // Invalidate user's task cache if assigned
      if (data.assigneeId) {
        await cacheService.invalidateUserCache(data.assigneeId);
      }

      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Find task by ID with caching
   */
  async findById(id: string): Promise<Task | null> {
    try {
      return await cacheService.getOrSet(
        `${CachePrefix.TASK}${id}`,
        async () => {
          const task = await this.taskRepository.findByIdWithRelations(id);
          if (!task) {
            throw new Error(`Task with id ${id} not found`);
          }
          return task;
        },
        CacheTTL.MEDIUM
      );
    } catch (error) {
      console.error(`Error finding task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all tasks with pagination
   */
  async findAll(options: PaginationOptions<Task> = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.taskRepository.findAll({
        ...options,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error('Error finding all tasks:', error);
      throw error;
    }
  }

  /**
   * Get tasks assigned to a user
   */
  async findByAssignee(
    userId: string,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      const cacheKey = `${CachePrefix.USER_TASKS}${userId}:${JSON.stringify(options)}`;
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          return await this.taskRepository.findByAssignee(userId, options);
        },
        CacheTTL.SHORT
      );
    } catch (error) {
      console.error(`Error finding tasks for assignee ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks created by a user
   */
  async findByCreator(
    userId: string,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.taskRepository.findByCreator(userId, options);
    } catch (error) {
      console.error(`Error finding tasks for creator ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get tasks by status
   */
  async findByStatus(
    status: TaskStatus,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.taskRepository.findByStatus(status, options);
    } catch (error) {
      console.error(`Error finding tasks by status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Get overdue tasks
   */
  async findOverdue(options: PaginationOptions<Task> = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.taskRepository.findOverdue(options);
    } catch (error) {
      console.error('Error finding overdue tasks:', error);
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(id: string, data: UpdateTaskDTO): Promise<Task> {
    try {
      const task = await this.taskRepository.findById(id);
      if (!task) {
        throw new Error(`Task with id ${id} not found`);
      }

      const updated = await this.taskRepository.update(id, data);

      // Invalidate caches
      await cacheService.invalidateTaskCache(id);
      if (task.assigneeId) {
        await cacheService.invalidateUserCache(task.assigneeId);
      }
      if (data.assigneeId && data.assigneeId !== task.assigneeId) {
        await cacheService.invalidateUserCache(data.assigneeId);
      }

      return updated;
    } catch (error) {
      console.error(`Error updating task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    try {
      const task = await this.taskRepository.updateStatus(id, status);

      await cacheService.invalidateTaskCache(id);
      if (task.assigneeId) {
        await cacheService.invalidateUserCache(task.assigneeId);
      }

      return task;
    } catch (error) {
      console.error(`Error updating task status ${id}:`, error);
      throw error;
    }
  }

  /**
   * Assign task to a user
   */
  async assignTask(taskId: string, userId: string): Promise<Task> {
    try {
      const task = await this.taskRepository.assignTask(taskId, userId);

      await cacheService.invalidateTaskCache(taskId);
      await cacheService.invalidateUserCache(userId);

      return task;
    } catch (error) {
      console.error(`Error assigning task ${taskId} to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Unassign task
   */
  async unassignTask(taskId: string): Promise<Task> {
    try {
      const task = await this.taskRepository.findById(taskId);
      if (!task) {
        throw new Error(`Task with id ${taskId} not found`);
      }

      const updated = await this.taskRepository.unassignTask(taskId);

      await cacheService.invalidateTaskCache(taskId);
      if (task.assigneeId) {
        await cacheService.invalidateUserCache(task.assigneeId);
      }

      return updated;
    } catch (error) {
      console.error(`Error unassigning task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Delete task (soft delete)
   */
  async deleteTask(id: string): Promise<void> {
    try {
      const task = await this.taskRepository.findById(id);
      if (!task) {
        throw new Error(`Task with id ${id} not found`);
      }

      await this.taskRepository.softDelete(id);

      await cacheService.invalidateTaskCache(id);
      if (task.assigneeId) {
        await cacheService.invalidateUserCache(task.assigneeId);
      }
    } catch (error) {
      console.error(`Error deleting task ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get task statistics for a user
   */
  async getUserTaskStats(userId: string): Promise<{
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  }> {
    try {
      const cacheKey = `${CachePrefix.TASK_STATS}${userId}`;
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          return await this.taskRepository.getUserTaskStats(userId);
        },
        CacheTTL.SHORT
      );
    } catch (error) {
      console.error(`Error getting task stats for user ${userId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const taskService = new TaskService();
