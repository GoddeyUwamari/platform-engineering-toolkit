import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Create Tasks Table
 *
 * Creates the tasks table with foreign key relationships to users
 * Implements soft delete functionality and proper indexing
 */
export class CreateTasksTable1702000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for PostgreSQL
    await queryRunner.query(`
      CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED');
    `);

    await queryRunner.query(`
      CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    `);

    // Create tasks table
    await queryRunner.createTable(
      new Table({
        name: 'tasks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'task_status',
            default: "'TODO'",
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'task_priority',
            default: "'MEDIUM'",
            isNullable: false,
          },
          {
            name: 'due_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'assignee_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_by_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
          },
        ],
      }),
      true
    );

    // Create indexes for frequently queried columns
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_task_status',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_task_priority',
        columnNames: ['priority'],
      })
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_task_assignee',
        columnNames: ['assignee_id'],
      })
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_task_created_by',
        columnNames: ['created_by_id'],
      })
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        name: 'fk_task_assignee',
        columnNames: ['assignee_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        name: 'fk_task_created_by',
        columnNames: ['created_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('tasks', 'fk_task_assignee');
    await queryRunner.dropForeignKey('tasks', 'fk_task_created_by');

    // Drop indexes
    await queryRunner.dropIndex('tasks', 'idx_task_status');
    await queryRunner.dropIndex('tasks', 'idx_task_priority');
    await queryRunner.dropIndex('tasks', 'idx_task_assignee');
    await queryRunner.dropIndex('tasks', 'idx_task_created_by');

    // Drop table
    await queryRunner.dropTable('tasks');

    // Drop enum types
    await queryRunner.query('DROP TYPE "task_status"');
    await queryRunner.query('DROP TYPE "task_priority"');
  }
}
