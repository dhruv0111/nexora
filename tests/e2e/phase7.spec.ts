import { randomUUID, randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { hashPassword } from '../../src/lib/accounts/password.mjs';

test.use({ trace: 'off' });
for (const role of ['STUDENT', 'EMPLOYER', 'ADMIN']) {
  test(
    role + ' password sign-in, role redirect and sign-out',
    async ({ page }, info) => {
      test.skip(
        !process.env.TEST_DATABASE_URL,
        'Requires the isolated test database.',
      );
      const pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
      });
      const id = randomUUID(),
        email = id + '@example.test',
        password = randomBytes(24).toString('hex');
      try {
        await pool.query(
          'INSERT INTO "User"(id,email,role,"staffScope","emailVerified","updatedAt") VALUES ($1,$2,$3,$4,now(),now())',
          [id, email, role, role === 'ADMIN' ? 'FINANCE_STAFF' : null],
        );
        await pool.query(
          'INSERT INTO "PasswordCredential"("userId",hash) VALUES($1,$2)',
          [id, await hashPassword(password)],
        );
        await page.goto('/sign-in');
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page
          .getByRole('button', { name: 'Sign in with password' })
          .click();
        await expect(page).toHaveURL(
          role === 'ADMIN'
            ? /\/operations$/
            : role === 'EMPLOYER'
              ? /\/career\/employer$/
              : /\/dashboard\/student$/,
        );
        const finance = await page.request.get('/api/operations/finance');
        expect(finance.status()).toBe(role === 'ADMIN' ? 200 : 403);
        if (role === 'ADMIN') {
          await expect(
            page.getByRole('heading', { name: 'Verified cash collections' }),
          ).toBeVisible();
          expect(
            await page.evaluate(() =>
              [...document.querySelectorAll('*')]
                .filter(
                  (el) => el.getBoundingClientRect().right > innerWidth + 1,
                )
                .map((el) => ({
                  tag: el.tagName,
                  cls: el.className,
                  text: el.textContent?.slice(0, 60),
                  right: el.getBoundingClientRect().right,
                }))
                .slice(0, 8),
            ),
          ).toEqual([]);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .analyze()
            ).violations,
          ).toEqual([]);
          if (
            process.env.CAPTURE_PHASE7 &&
            ['desktop', 'mobile'].includes(info.project.name)
          )
            await page.screenshot({
              path:
                'docs/previews/phase7-finance-' + info.project.name + '.png',
              fullPage: true,
            });
        }
        await page.goto('/account/security');
        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page).toHaveURL(/\/$/);
        expect(
          (await page.request.get('/api/operations/finance')).status(),
        ).toBe(401);
      } finally {
        await pool.query('DELETE FROM "User" WHERE id=$1', [id]);
        await pool.end();
      }
    },
  );
}
