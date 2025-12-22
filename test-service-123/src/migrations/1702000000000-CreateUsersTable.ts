import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create Users Table
 *
 * Creates the users table with all required columns, constraints, and indexes
 * Implements soft delete functionality with deletedAt column
 */
export class CreateUsersTable1702000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for PostgreSQL
    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
    `);

    await queryRunner.query(`
      CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
    `);

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'user_role',
            default: "'USER'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'user_status',
            default: "'ACTIVE'",
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
      'users',
      new TableIndex({
        name: 'idx_user_email',
        columnNames: ['email'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_user_role',
        columnNames: ['role'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_user_status',
        columnNames: ['status'],
      })
    );

    // Enable UUID extension if not already enabled
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('users', 'idx_user_email');
    await queryRunner.dropIndex('users', 'idx_user_role');
    await queryRunner.dropIndex('users', 'idx_user_status');

    // Drop table
    await queryRunner.dropTable('users');

    // Drop enum types
    await queryRunner.query('DROP TYPE "user_role"');
    await queryRunner.query('DROP TYPE "user_status"');
  }
}
