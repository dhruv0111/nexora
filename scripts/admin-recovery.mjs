import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword, strong } from '../src/lib/accounts/password.mjs';
const action = process.argv[2],
  email = process.env.NEXORA_ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.NEXORA_ADMIN_PASSWORD;
if (
  !['rotate', 'revoke', 'disable', 'enable'].includes(action) ||
  !email ||
  !process.env.DATABASE_URL ||
  (action === 'rotate' && !strong(password, email))
)
  throw Error(
    'Supply an existing administrator email, database configuration and a supported action. Rotation requires a strong protected password.',
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL }),
  db = await pool.connect();
try {
  await db.query('BEGIN');
  const { rows } = await db.query(
    'SELECT id FROM "User" WHERE email=$1 AND "staffScope"=$2 FOR UPDATE',
    [email, 'SUPER_ADMIN'],
  );
  if (rows.length !== 1) throw Error();
  const id = rows[0].id;
  if (action === 'rotate') {
    await db.query(
      'UPDATE "PasswordCredential" SET hash=$1 WHERE "userId"=$2',
      [await hashPassword(password), id],
    );
    await db.query('UPDATE "User" SET "forceChange"=true WHERE id=$1', [id]);
  }
  if (action === 'enable' || action === 'disable')
    await db.query('UPDATE "User" SET "disabledAt"=$1 WHERE id=$2', [
      action === 'enable' ? null : new Date(),
      id,
    ]);
  await db.query('DELETE FROM "Session" WHERE "userId"=$1', [id]);
  await db.query('DELETE FROM "AccountToken" WHERE "userId"=$1', [id]);
  await db.query(
    'INSERT INTO "AuditLog"(id,"actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,$2,$5)',
    [
      randomUUID(),
      id,
      'SUPER_ADMIN_RECOVERY',
      'User',
      JSON.stringify({ action, source: 'operator-cli' }),
    ],
  );
  await db.query('COMMIT');
  console.log('Account control applied. Sessions revoked.');
} catch {
  await db.query('ROLLBACK');
  console.error('Recovery refused.');
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
