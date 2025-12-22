# API Testing Guide - Phase 2

Complete guide for testing all Phase 2 API endpoints with curl, Postman, and HTTPie examples.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Health Check Endpoints](#health-check-endpoints)
3. [User API Endpoints](#user-api-endpoints)
4. [Task API Endpoints](#task-api-endpoints)
5. [Testing Workflows](#testing-workflows)
6. [Response Formats](#response-formats)
7. [Error Handling](#error-handling)

---

## Getting Started

### Prerequisites

- Server running on `http://localhost:3000`
- Database seeded with sample data (`npm run seed`)
- Tools: curl (pre-installed), Postman, or HTTPie

### Base URL

```
http://localhost:3000
```

### Response Format

All API responses follow this consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Health Check Endpoints

### 1. Basic Health Check

Check if API is running.

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "v1"
}
```

### 2. Readiness Check

Check if all services (database, cache) are ready.

```bash
curl http://localhost:3000/ready
```

**Response:**
```json
{
  "success": true,
  "message": "API is ready",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "v1",
  "services": {
    "database": {
      "status": "healthy",
      "healthy": true,
      "details": {
        "database": "production_api",
        "host": "localhost",
        "port": 5432,
        "isConnected": true
      }
    },
    "redis": {
      "status": "healthy",
      "healthy": true,
      "details": {
        "host": "localhost",
        "port": 6379,
        "db": 0,
        "status": "ready"
      }
    }
  }
}
```

### 3. API Version Info

```bash
curl http://localhost:3000/api/v1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "v1",
    "environment": "development",
    "endpoints": {
      "users": "/api/v1/users",
      "tasks": "/api/v1/tasks"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## User API Endpoints

### 1. Get All Users

Retrieve paginated list of users with optional filtering.

```bash
# Get all users (default: page 1, limit 10)
curl http://localhost:3000/api/v1/users

# Get users with pagination
curl "http://localhost:3000/api/v1/users?page=1&limit=5"

# Filter by role
curl "http://localhost:3000/api/v1/users?role=ADMIN"

# Filter by status
curl "http://localhost:3000/api/v1/users?status=ACTIVE"

# Combine filters
curl "http://localhost:3000/api/v1/users?page=1&limit=10&role=USER&status=ACTIVE"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "ADMIN",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `role` (optional): Filter by role (USER | ADMIN | SUPER_ADMIN)
- `status` (optional): Filter by status (ACTIVE | INACTIVE | SUSPENDED)

### 2. Get User by ID

Retrieve a specific user's details.

```bash
# Replace USER_ID with actual UUID
curl http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Create New User

Create a new user account.

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "New",
    "lastName": "User",
    "role": "USER"
  }'
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "New",
  "lastName": "User",
  "role": "USER"  // Optional: USER (default) | ADMIN | SUPER_ADMIN
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440001",
    "email": "newuser@example.com",
    "firstName": "New",
    "lastName": "User",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User created successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Password: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
- FirstName: 2-100 characters
- LastName: 2-100 characters
- Role: Optional (USER | ADMIN | SUPER_ADMIN)

### 4. Update User

Update user information.

```bash
curl -X PUT http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "lastName": "Name",
    "status": "ACTIVE"
  }'
```

**Request Body (all fields optional):**
```json
{
  "email": "newemail@example.com",
  "firstName": "Updated",
  "lastName": "Name",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "newemail@example.com",
    "firstName": "Updated",
    "lastName": "Name",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "User updated successfully",
  "timestamp": "2024-01-01T01:00:00.000Z"
}
```

### 5. Change Password

Change user's password.

```bash
curl -X POST http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000/change-password \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewPass456!",
    "confirmPassword": "NewPass456!"
  }'
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Get User's Tasks

Retrieve all tasks assigned to or created by a user.

```bash
# Get user's tasks
curl http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000/tasks

# With pagination
curl "http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000/tasks?page=1&limit=5"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assignedTasks": [
      {
        "id": "750e8400-e29b-41d4-a716-446655440000",
        "title": "Implement authentication",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "dueDate": "2024-01-10T00:00:00.000Z"
      }
    ],
    "createdTasks": [
      {
        "id": "850e8400-e29b-41d4-a716-446655440000",
        "title": "Code review",
        "status": "TODO",
        "priority": "MEDIUM"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 7. Delete User

Soft delete a user (sets deletedAt timestamp).

```bash
curl -X DELETE http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Task API Endpoints

### 1. Get All Tasks

Retrieve paginated list of tasks with filtering.

```bash
# Get all tasks
curl http://localhost:3000/api/v1/tasks

# With pagination
curl "http://localhost:3000/api/v1/tasks?page=1&limit=5"

# Filter by status
curl "http://localhost:3000/api/v1/tasks?status=TODO"

# Filter by priority
curl "http://localhost:3000/api/v1/tasks?priority=HIGH"

# Filter by assignee
curl "http://localhost:3000/api/v1/tasks?assigneeId=550e8400-e29b-41d4-a716-446655440000"

# Combine filters
curl "http://localhost:3000/api/v1/tasks?status=IN_PROGRESS&priority=HIGH&page=1&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "title": "Implement user authentication",
      "description": "Add JWT-based auth with refresh tokens",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2024-01-10T00:00:00.000Z",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
      "createdById": "450e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "assignee": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "john.doe@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "createdBy": {
        "id": "450e8400-e29b-41d4-a716-446655440000",
        "email": "admin@example.com",
        "firstName": "Admin",
        "lastName": "User"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): TODO | IN_PROGRESS | DONE | ARCHIVED
- `priority` (optional): LOW | MEDIUM | HIGH | URGENT
- `assigneeId` (optional): Filter by assigned user UUID
- `createdById` (optional): Filter by creator user UUID

### 2. Get Task by ID

Retrieve a specific task with full details.

```bash
curl http://localhost:3000/api/v1/tasks/750e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440000",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication with refresh tokens",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "dueDate": "2024-01-10T00:00:00.000Z",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
    "createdById": "450e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "assignee": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "createdBy": {
      "id": "450e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Create New Task

Create a new task.

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "description": "Task description here",
    "priority": "HIGH",
    "dueDate": "2024-01-15T00:00:00.000Z",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
    "createdById": "450e8400-e29b-41d4-a716-446655440000"
  }'
```

**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task description (optional)",
  "status": "TODO",           // Optional: TODO (default) | IN_PROGRESS | DONE | ARCHIVED
  "priority": "MEDIUM",        // Optional: LOW | MEDIUM (default) | HIGH | URGENT
  "dueDate": "2024-01-15T00:00:00.000Z",  // Optional: ISO 8601 format
  "assigneeId": "550e8400-e29b-41d4-a716-446655440000",  // Optional: User UUID
  "createdById": "450e8400-e29b-41d4-a716-446655440000"  // Required: User UUID
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "950e8400-e29b-41d4-a716-446655440000",
    "title": "New Task",
    "description": "Task description here",
    "status": "TODO",
    "priority": "HIGH",
    "dueDate": "2024-01-15T00:00:00.000Z",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
    "createdById": "450e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Task created successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Validation Rules:**
- Title: Required, 3-255 characters
- Description: Optional, max 5000 characters
- Status: Optional (TODO | IN_PROGRESS | DONE | ARCHIVED)
- Priority: Optional (LOW | MEDIUM | HIGH | URGENT)
- DueDate: Optional, valid ISO 8601 date
- AssigneeId: Optional, valid user UUID
- CreatedById: Required, valid user UUID

### 4. Update Task

Update task details.

```bash
curl -X PUT http://localhost:3000/api/v1/tasks/750e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Task Title",
    "priority": "URGENT",
    "status": "IN_PROGRESS"
  }'
```

**Request Body (all fields optional):**
```json
{
  "title": "Updated Task Title",
  "description": "Updated description",
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  "dueDate": "2024-01-20T00:00:00.000Z",
  "assigneeId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440000",
    "title": "Updated Task Title",
    "description": "Updated description",
    "status": "IN_PROGRESS",
    "priority": "URGENT",
    "dueDate": "2024-01-20T00:00:00.000Z",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
    "createdById": "450e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "Task updated successfully",
  "timestamp": "2024-01-01T01:00:00.000Z"
}
```

### 5. Update Task Status

Update only the task status.

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/750e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE"
  }'
```

**Request Body:**
```json
{
  "status": "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440000",
    "status": "DONE",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "Task status updated successfully",
  "timestamp": "2024-01-01T01:00:00.000Z"
}
```

### 6. Assign Task

Assign task to a user.

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/750e8400-e29b-41d4-a716-446655440000/assign \
  -H "Content-Type: application/json" \
  -d '{
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Request Body:**
```json
{
  "assigneeId": "550e8400-e29b-41d4-a716-446655440000"  // User UUID
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440000",
    "title": "Implement user authentication",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
    "updatedAt": "2024-01-01T01:00:00.000Z"
  },
  "message": "Task assigned successfully",
  "timestamp": "2024-01-01T01:00:00.000Z"
}
```

### 7. Get Overdue Tasks

Retrieve all tasks past their due date.

```bash
# Get overdue tasks
curl http://localhost:3000/api/v1/tasks/overdue

# With pagination
curl "http://localhost:3000/api/v1/tasks/overdue?page=1&limit=5"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "title": "Overdue Task",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2023-12-25T00:00:00.000Z",
      "assignee": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "john.doe@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 8. Delete Task

Soft delete a task.

```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/750e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Testing Workflows

### Workflow 1: Create User and Assign Task

```bash
# 1. Create new user
USER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "workflow@example.com",
    "password": "WorkflowPass123!",
    "firstName": "Workflow",
    "lastName": "User"
  }')

# Extract user ID (using jq)
USER_ID=$(echo $USER_RESPONSE | jq -r '.data.id')
echo "Created user: $USER_ID"

# 2. Create task assigned to that user
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Welcome Task\",
    \"description\": \"Get started with the platform\",
    \"priority\": \"HIGH\",
    \"assigneeId\": \"$USER_ID\",
    \"createdById\": \"$USER_ID\"
  }")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.data.id')
echo "Created task: $TASK_ID"

# 3. Get user's tasks
curl "http://localhost:3000/api/v1/users/$USER_ID/tasks"
```

### Workflow 2: Task Lifecycle

```bash
# Get a task ID from seeded data
TASK_ID="750e8400-e29b-41d4-a716-446655440000"

# 1. View task
curl "http://localhost:3000/api/v1/tasks/$TASK_ID"

# 2. Start work (change status to IN_PROGRESS)
curl -X PATCH "http://localhost:3000/api/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'

# 3. Complete task
curl -X PATCH "http://localhost:3000/api/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "DONE"}'

# 4. Archive task
curl -X PATCH "http://localhost:3000/api/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "ARCHIVED"}'
```

### Workflow 3: Reassign Task

```bash
TASK_ID="750e8400-e29b-41d4-a716-446655440000"
NEW_ASSIGNEE_ID="550e8400-e29b-41d4-a716-446655440001"

# Reassign task to different user
curl -X PATCH "http://localhost:3000/api/v1/tasks/$TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -d "{\"assigneeId\": \"$NEW_ASSIGNEE_ID\"}"
```

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, PUT, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Invalid input data |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate email, etc. |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Database down |

### Validation Error Example

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password is required"
      },
      {
        "field": "firstName",
        "message": "First name is required"
      },
      {
        "field": "lastName",
        "message": "Last name is required"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Not Found Error Example

```bash
curl http://localhost:3000/api/v1/users/invalid-uuid
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "message": "User not found"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Conflict Error Example

```bash
# Try to create user with existing email
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "message": "Email already registered"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Using Postman

### Import Collection

1. Create new collection: "Production API - Phase 2"
2. Add environment variables:
   - `base_url`: `http://localhost:3000`
   - `api_version`: `v1`

3. Use variables in requests:
   - URL: `{{base_url}}/api/{{api_version}}/users`

### Example Requests

**Create User:**
- Method: POST
- URL: `{{base_url}}/api/{{api_version}}/users`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
  ```json
  {
    "email": "postman@example.com",
    "password": "PostmanTest123!",
    "firstName": "Postman",
    "lastName": "User"
  }
  ```

**Save Response Variable:**
```javascript
// In Postman Tests tab
const response = pm.response.json();
pm.environment.set("user_id", response.data.id);
```

**Use in Next Request:**
- URL: `{{base_url}}/api/{{api_version}}/users/{{user_id}}`

---

## Using HTTPie

HTTPie provides a more readable CLI experience:

```bash
# Install HTTPie
pip install httpie

# Get users
http GET :3000/api/v1/users

# Create user
http POST :3000/api/v1/users \
  email=httpie@example.com \
  password=HttpieTest123! \
  firstName=HTTPie \
  lastName=User

# Update user
http PUT :3000/api/v1/users/USER_ID \
  firstName=Updated \
  lastName=Name

# Create task
http POST :3000/api/v1/tasks \
  title="New Task" \
  description="Task description" \
  priority=HIGH \
  createdById=USER_ID
```

---

## Testing Tips

1. **Use jq for JSON parsing:**
   ```bash
   curl http://localhost:3000/api/v1/users | jq '.data[0].id'
   ```

2. **Save responses to files:**
   ```bash
   curl http://localhost:3000/api/v1/users > users.json
   ```

3. **Test with invalid data:**
   ```bash
   # Test validation
   curl -X POST http://localhost:3000/api/v1/users \
     -H "Content-Type: application/json" \
     -d '{"email": "invalid"}'
   ```

4. **Monitor logs:**
   ```bash
   # In separate terminal
   npm run dev
   # Watch for SQL queries and errors
   ```

5. **Check database:**
   ```bash
   psql -U postgres -h localhost -d production_api -c "SELECT * FROM users;"
   ```

---

**Phase 2 API Testing Complete! 🎉**

You now have comprehensive examples for testing all Phase 2 endpoints. Use these as templates for your own testing workflows.
