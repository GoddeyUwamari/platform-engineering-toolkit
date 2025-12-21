/**
 * Test Data Factories for Notification Service
 */

import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import { UUID } from '@shared/types';

export async function createNotification(
  pool: Pool,
  options: {
    userId: UUID;
    tenantId: UUID;
    type?: 'EMAIL' | 'SMS' | 'WEBHOOK';
    status?: 'PENDING' | 'SENT' | 'FAILED';
  }
): Promise<any> {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, tenant_id, type, status, subject, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      options.userId,
      options.tenantId,
      options.type || 'EMAIL',
      options.status || 'PENDING',
      faker.lorem.sentence(),
      faker.lorem.paragraph(),
    ]
  );

  return result.rows[0];
}

export async function createNotificationTemplate(
  pool: Pool,
  options: {
    name?: string;
    type?: 'EMAIL' | 'SMS' | 'WEBHOOK';
  }
): Promise<any> {
  const result = await pool.query(
    `INSERT INTO notification_templates (name, type, subject, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      options.name || faker.lorem.word(),
      options.type || 'EMAIL',
      faker.lorem.sentence(),
      faker.lorem.paragraph(),
    ]
  );

  return result.rows[0];
}
