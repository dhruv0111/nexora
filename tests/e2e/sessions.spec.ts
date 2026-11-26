import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';
const url = process.env.TEST_DATABASE_URL;
test.describe('real database sessions', () => {
  test.skip(
    !url,
    'Requires isolated TEST_DATABASE_URL and configured test server',
  );
  let pool: Pool;
  test.beforeAll(() => {
    if (!url || !new URL(url).pathname.includes('nexora_phase1'))
      throw new Error('Only isolated verification databases are allowed');
    pool = new Pool({ connectionString: url });
  });
  test.afterAll(async () => {
    await pool?.end();
  });
  for (const role of ['STUDENT', 'MENTOR', 'EMPLOYER', 'ADMIN']) {
    test(`${role} can access its workspace and loses access on revocation`, async ({
      page,
      context,
    }) => {
      const id = randomUUID(),
        token = randomUUID();
      try {
        await pool.query(
          `INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,$2,now())`,
          [id, role],
        );
        await pool.query(
          `INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,now() + interval '10 minutes')`,
          [randomUUID(), token, id],
        );
        await context.addCookies([
          {
            name: 'next-auth.session-token',
            value: token,
            url: 'http://127.0.0.1:3100',
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        await page.goto(`/dashboard/${role.toLowerCase()}`);
        await expect(page.getByText('Secure learning platform')).toBeVisible();
        await page.goto(`/dashboard/${role === 'ADMIN' ? 'student' : 'admin'}`);
        await expect(page).toHaveURL(/\/forbidden/);
        await pool.query(`DELETE FROM "Session" WHERE "userId" = $1`, [id]);
        await page.goto(`/dashboard/${role.toLowerCase()}`);
        await expect(page).toHaveURL(/\/sign-in/);
      } finally {
        await pool.query(`DELETE FROM "User" WHERE id = $1`, [id]);
      }
    });
  }
  test('role changes take effect on the next request', async ({
    page,
    context,
  }) => {
    const id = randomUUID(),
      token = randomUUID();
    try {
      await pool.query(
        `INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',now())`,
        [id],
      );
      await pool.query(
        `INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,now() + interval '10 minutes')`,
        [randomUUID(), token, id],
      );
      await context.addCookies([
        {
          name: 'next-auth.session-token',
          value: token,
          url: 'http://127.0.0.1:3100',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await page.goto('/dashboard/admin');
      await expect(page.getByText('Secure learning platform')).toBeVisible();
      await pool.query(`UPDATE "User" SET role = 'STUDENT' WHERE id = $1`, [
        id,
      ]);
      await page.reload();
      await expect(page).toHaveURL(/\/forbidden/);
    } finally {
      await pool.query(`DELETE FROM "User" WHERE id = $1`, [id]);
    }
  });
});
