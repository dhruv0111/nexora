import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword, strong } from '../src/lib/accounts/password.mjs';
const email = (process.env.NEXORA_ADMIN_EMAIL ?? '').trim().toLowerCase(),
  password = process.env.NEXORA_ADMIN_PASSWORD;
if (
  !process.env.DATABASE_URL ||
  !/^\S+@\S+\.\S+$/.test(email) ||
  !strong(password, email)
)
  throw Error(
    'Supply DATABASE_URL, a valid NEXORA_ADMIN_EMAIL and a strong NEXORA_ADMIN_PASSWORD via protected environment variables.',
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL }),
  db = await pool.connect();
try {
  await db.query('BEGIN');
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('initial-super-admin',0))",
  );
  const { rows } = await db.query(
    'SELECT id,email,"staffScope" FROM "User" WHERE lower(email)=$1 OR "staffScope"=$2',
    [email, 'SUPER_ADMIN'],
  );
  if (rows.length) {
    if (
      rows.length !== 1 ||
      rows[0].email?.toLowerCase() !== email ||
      rows[0].staffScope !== 'SUPER_ADMIN'
    )
      throw Error('Conflicting account or existing initial administrator.');
    console.log('Already provisioned.');
  } else {
    const id = randomUUID();
    await db.query(
      'INSERT INTO "User"(id,email,role,"staffScope","forceChange","emailVerified","updatedAt") VALUES($1,$2,$3,$4,true,now(),now())',
      [id, email, 'ADMIN', 'SUPER_ADMIN'],
    );
    await db.query(
      'INSERT INTO "PasswordCredential"("userId",hash) VALUES($1,$2)',
      [id, await hashPassword(password)],
    );
    await db.query(
      'INSERT INTO "AuditLog"(id,"actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,$2,$5)',
      [
        randomUUID(),
        id,
        'SUPER_ADMIN_PROVISIONED',
        'User',
        JSON.stringify({ source: 'operator-cli' }),
      ],
    );
  }
  await db.query('COMMIT');
} catch {
  await db.query('ROLLBACK');
  console.error('Provisioning refused or unavailable. No account was changed.');
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
