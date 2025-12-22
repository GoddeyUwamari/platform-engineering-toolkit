import { FindOptionsWhere, LessThan, IsNull } from 'typeorm';
import {
  BaseRepository,
  PaginatedResult,
  PaginationOptions,
} from '../core/database/base.repository';
import { Task, TaskStatus, TaskPriority } from '../models/task.entity';

/**
 * Task Repository
 *
 * Handles all database operations for Task entities
 * Extends BaseRepository for common CRUD operations
 * Adds task-specific query methods
 */
export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super(Task);
  }

  /**
   * Find all tasks assigned to a specific user
   */
  async findByAssignee(
    userId: string,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.findAll({
        ...options,
        where: { assigneeId: userId } as FindOptionsWhere<Task>,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error(`Error finding tasks by assignee ${userId}:`, error);
      throw new Error(`Failed to find tasks by assignee: ${(error as Error).message}`);
    }
  }

  /**
   * Find all tasks created by a specific user
   */
  async findByCreator(
    userId: string,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.findAll({
        ...options,
        where: { createdById: userId } as FindOptionsWhere<Task>,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error(`Error finding tasks by creator ${userId}:`, error);
      throw new Error(`Failed to find tasks by creator: ${(error as Error).message}`);
    }
  }

  /**
   * Find tasks by status
   */
  async findByStatus(
    status: TaskStatus,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.findAll({
        ...options,
        where: { status } as FindOptionsWhere<Task>,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error(`Error finding tasks by status ${status}:`, error);
      throw new Error(`Failed to find tasks by status: ${(error as Error).message}`);
    }
  }

  /**
   * Find tasks by priority
   */
  async findByPriority(
    priority: TaskPriority,
    options: PaginationOptions<Task> = {}
  ): Promise<PaginatedResult<Task>> {
    try {
      return await this.findAll({
        ...options,
        where: { priority } as FindOptionsWhere<Task>,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error(`Error finding tasks by priority ${priority}:`, error);
      throw new Error(`Failed to find tasks by priority: ${(error as Error).message}`);
    }
  }

  /**
   * Find overdue tasks
   * Tasks that have passed their due date and are not completed
   */
  async findOverdue(options: PaginationOptions<Task> = {}): Promise<PaginatedResult<Task>> {
    try {
      const now = new Date();
      return await this.findAll({
        ...options,
        where: {
          dueDate: LessThan(now),
          status: TaskStatus.TODO || TaskStatus.IN_PROGRESS,
        } as FindOptionsWhere<Task>,
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error('Error finding overdue tasks:', error);
      throw new Error(`Failed to find overdue tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Find unassigned tasks
   */
  async findUnassigned(options: PaginationOptions<Task> = {}): Promise<PaginatedResult<Task>> {
    try {
      return await this.findAll({
        ...options,
        where: { assigneeId: IsNull() } as FindOptionsWhere<Task>,
        relations: ['createdBy'],
      });
    } catch (error) {
      console.error('Error finding unassigned tasks:', error);
      throw new Error(`Failed to find unassigned tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    try {
      return await this.update(id, { status });
    } catch (error) {
      console.error(`Error updating task status ${id}:`, error);
      throw new Error(`Failed to update task status: ${(error as Error).message}`);
    }
  }

  /**
   * Assign task to a user
   */
  async assignTask(taskId: string, userId: string): Promise<Task> {
    try {
      return await this.update(taskId, { assigneeId: userId });
    } catch (error) {
      console.error(`Error assigning task ${taskId} to user ${userId}:`, error);
      throw new Error(`Failed to assign task: ${(error as Error).message}`);
    }
  }

  /**
   * Unassign task from user
   */
  async unassignTask(taskId: string): Promise<Task> {
    try {
      return await this.update(taskId, { assigneeId: undefined });
    } catch (error) {
      console.error(`Error unassigning task ${taskId}:`, error);
      throw new Error(`Failed to unassign task: ${(error as Error).message}`);
    }
  }

  /**
   * Find task by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<Task | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['assignee', 'createdBy'],
      });
    } catch (error) {
      console.error(`Error finding task with relations ${id}:`, error);
      throw new Error(`Failed to find task with relations: ${(error as Error).message}`);
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
      const total = await this.count({ assigneeId: userId } as FindOptionsWhere<Task>);
      const todo = await this.count({
        assigneeId: userId,
        status: TaskStatus.TODO,
      } as FindOptionsWhere<Task>);
      const inProgress = await this.count({
        assigneeId: userId,
        status: TaskStatus.IN_PROGRESS,
      } as FindOptionsWhere<Task>);
      const done = await this.count({
        assigneeId: userId,
        status: TaskStatus.DONE,
      } as FindOptionsWhere<Task>);

      const now = new Date();
      const overdueTasks = await this.repository.count({
        where: {
          assigneeId: userId,
          dueDate: LessThan(now),
          status: TaskStatus.TODO || TaskStatus.IN_PROGRESS,
        } as FindOptionsWhere<Task>,
      });

      return {
        total,
        todo,
        inProgress,
        done,
        overdue: overdueTasks,
      };
    } catch (error) {
      console.error(`Error getting task stats for user ${userId}:`, error);
      throw new Error(`Failed to get task statistics: ${(error as Error).message}`);
    }
  }

  /**
   * Archive completed tasks older than specified days
   */
  async archiveOldCompletedTasks(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.repository.update(
        {
          status: TaskStatus.DONE,
          updatedAt: LessThan(cutoffDate),
        } as FindOptionsWhere<Task>,
        { status: TaskStatus.ARCHIVED }
      );

      return result.affected || 0;
    } catch (error) {
      console.error('Error archiving old completed tasks:', error);
      throw new Error(`Failed to archive old tasks: ${(error as Error).message}`);
    }
  }
}
