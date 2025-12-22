import 'reflect-metadata';
import { AppDataSource, initializeDatabase, closeDatabase } from '../core/database/data-source';
import { UserRepository } from '../repositories/user.repository';
import { TaskRepository } from '../repositories/task.repository';
import { User, UserRole, UserStatus } from '../models/user.entity';
import { TaskStatus, TaskPriority } from '../models/task.entity';
import bcrypt from 'bcryptjs';

/**
 * Seed Data Script
 *
 * Populates the database with initial development/test data
 * Run with: npm run seed
 *
 * ⚠️ WARNING: This script will clear existing data in development mode
 */

const SALT_ROUNDS = 10;

const seedUsers = async (): Promise<User[]> => {
  console.info('\n📦 Seeding users...');

  const userRepository = new UserRepository();
  const users: User[] = [];

  // Hash passwords
  const defaultPassword = await bcrypt.hash('Password123!', SALT_ROUNDS);

  // Admin user
  const admin = await userRepository.create({
    email: 'admin@example.com',
    passwordHash: defaultPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });
  users.push(admin);
  console.info(`✅ Created admin user: ${admin.email}`);

  // Regular users
  const user1 = await userRepository.create({
    email: 'john.doe@example.com',
    passwordHash: defaultPassword,
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  });
  users.push(user1);
  console.info(`✅ Created user: ${user1.email}`);

  const user2 = await userRepository.create({
    email: 'jane.smith@example.com',
    passwordHash: defaultPassword,
    firstName: 'Jane',
    lastName: 'Smith',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  });
  users.push(user2);
  console.info(`✅ Created user: ${user2.email}`);

  const user3 = await userRepository.create({
    email: 'bob.wilson@example.com',
    passwordHash: defaultPassword,
    firstName: 'Bob',
    lastName: 'Wilson',
    role: UserRole.USER,
    status: UserStatus.INACTIVE,
  });
  users.push(user3);
  console.info(`✅ Created user: ${user3.email}`);

  console.info(`\n✅ Seeded ${users.length} users`);
  return users;
};

const seedTasks = async (users: User[]): Promise<void> => {
  console.info('\n📦 Seeding tasks...');

  const taskRepository = new TaskRepository();
  const [admin, user1, user2] = users;

  const tasks = [
    {
      title: 'Set up development environment',
      description: 'Install Node.js, PostgreSQL, Redis, and required tools',
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: user1!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      title: 'Implement user authentication',
      description: 'Add JWT-based authentication with refresh tokens',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: user1!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
    {
      title: 'Write API documentation',
      description: 'Document all API endpoints using OpenAPI/Swagger',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: user2!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    {
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assigneeId: user1!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
    {
      title: 'Implement rate limiting',
      description: 'Add rate limiting middleware to prevent API abuse',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: user2!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    },
    {
      title: 'Add comprehensive error handling',
      description: 'Improve error messages and logging throughout the application',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: undefined,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    },
    {
      title: 'Database backup strategy',
      description: 'Implement automated database backups and recovery procedures',
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assigneeId: user1!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    },
    {
      title: 'Code review for Phase 1',
      description: 'Review all Phase 1 code for best practices and security issues',
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: user2!.id,
      createdById: admin!.id,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      title: 'Performance optimization',
      description: 'Profile and optimize database queries and API response times',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: undefined,
      createdById: user1!.id,
      dueDate: undefined,
    },
    {
      title: 'Update README documentation',
      description: 'Keep README.md up to date with latest features and setup instructions',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.LOW,
      assigneeId: user2!.id,
      createdById: user1!.id,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    },
  ];

  for (const taskData of tasks) {
    await taskRepository.create(taskData);
  }

  console.info(`✅ Seeded ${tasks.length} tasks`);
};

const clearDatabase = async (): Promise<void> => {
  console.info('\n🗑️  Clearing existing data...');

  // Delete all tasks first (due to foreign key constraints)
  await AppDataSource.query('DELETE FROM tasks');
  console.info('✅ Cleared tasks table');

  // Delete all users
  await AppDataSource.query('DELETE FROM users');
  console.info('✅ Cleared users table');
};

const seed = async (): Promise<void> => {
  try {
    console.info('🌱 Starting database seeding...');
    console.info('='.repeat(60));

    // Initialize database connection
    await initializeDatabase();

    // Check environment
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      console.error('❌ Cannot seed data in production environment');
      process.exit(1);
    }

    // Clear existing data in development
    await clearDatabase();

    // Seed users
    const users = await seedUsers();

    // Seed tasks
    await seedTasks(users);

    console.info('\n' + '='.repeat(60));
    console.info('✅ Database seeding completed successfully!');
    console.info('='.repeat(60));
    console.info('\n📝 Default credentials:');
    console.info('   Email: admin@example.com');
    console.info('   Password: Password123!');
    console.info('\n   All users have the same password: Password123!');
    console.info('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDatabase();
  }
};

// Run seed if executed directly
if (require.main === module) {
  void seed();
}

export default seed;
