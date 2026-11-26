import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('nexora_phase1'))
  throw new Error(
    'Use an isolated nexora_phase1 database through TEST_DATABASE_URL',
  );
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
beforeAll(async () => {
  await client.query('BEGIN');
});
afterAll(async () => {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
});
async function rejected(sql: string, code: string) {
  await client.query('SAVEPOINT constraint_test');
  await expect(client.query(sql)).rejects.toMatchObject({ code });
  await client.query('ROLLBACK TO SAVEPOINT constraint_test');
}
describe('PostgreSQL foundation', () => {
  it('defaults new OAuth users to student', async () => {
    const { rows } = await client.query(
      `INSERT INTO "User" (id, email, "updatedAt") VALUES ('db-test-user', 'db-test@example.test', now()) RETURNING role`,
    );
    expect(rows[0].role).toBe('STUDENT');
  });
  it('enforces application targets and payment domain constraints', async () => {
    await rejected(
      `INSERT INTO "Application" (id, "userId", "updatedAt") VALUES ('bad-app', 'db-test-user', now())`,
      '23514',
    );
    await rejected(
      `INSERT INTO "Payment" (id, "enrollmentId", "amountMinor", currency, provider, "idempotencyKey", "updatedAt") VALUES ('bad-payment', 'missing', -1, 'USD', 'test', 'key', now())`,
      '23514',
    );
  });
  it('enforces foreign keys', async () => {
    await rejected(
      `INSERT INTO "Enrollment" (id,"userId","cohortId","updatedAt") VALUES ('bad', 'db-test-user','missing',now())`,
      '23503',
    );
  });
  it('prevents duplicate enrollments and protects financial history', async () => {
    await client.query(
      `INSERT INTO "Course" (id,slug,title,description,track,"updatedAt") VALUES ('db-course','db-test','Test','Test','QA_SDET',now())`,
    );
    await client.query(
      `INSERT INTO "Cohort" (id,"courseId",name) VALUES ('db-cohort','db-course','Test')`,
    );
    await client.query(
      `INSERT INTO "Enrollment" (id,"userId","cohortId","updatedAt") VALUES ('db-enroll','db-test-user','db-cohort',now())`,
    );
    await rejected(
      `INSERT INTO "Enrollment" (id,"userId","cohortId","updatedAt") VALUES ('db-duplicate','db-test-user','db-cohort',now())`,
      '23505',
    );
    await rejected(`DELETE FROM "User" WHERE id = 'db-test-user'`, '23001');
  });
});
