import { TaskStatus, TaskPriority } from '../models/task.entity';
import { UserRole, UserStatus } from '../models/user.entity';

/**
 * Request Type Definitions
 *
 * Type-safe interfaces for Express request parameters, bodies, and queries
 * Used throughout controllers to prevent unsafe any assignments
 */

// ============================================================================
// Task Request Types
// ============================================================================

export interface CreateTaskBody {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
  createdById: string;
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeId?: string;
}

export interface UpdateTaskStatusBody {
  status: TaskStatus;
}

export interface AssignTaskBody {
  assigneeId: string;
}

export interface TaskIdParams {
  id: string;
}

export interface TaskListQuery {
  page?: string;
  limit?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

// ============================================================================
// User Request Types
// ============================================================================

export interface CreateUserBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface UpdateUserBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ChangePasswordBody {
  oldPassword: string;
  newPassword: string;
}

export interface UserIdParams {
  id: string;
}

export interface UserListQuery {
  page?: string;
  limit?: string;
  role?: UserRole;
  status?: UserStatus;
}
