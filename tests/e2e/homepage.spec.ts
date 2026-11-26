import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createChallenge } from '../../src/lib/inquiry-policy';
const secret = 'isolated-inquiry-secret-for-tests-only-0000';
test('cinematic homepage, responsive layouts and all CTA destinations', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'DON’T JUSTLEARN TECH.BUILD YOURFUTURE.',
  );
  await expect(page.locator('.hero-art')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const id of [
    'programs',
    'how-it-works',
    'projects',
    'why-nexora',
    'course-discovery',
    'learning-experience',
    'career-support',
    'faq',
    'inquiry',
  ])
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  const destinations = await page
    .locator('main a[data-track="cta_click"]')
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.getAttribute('href')!)),
    ]);
  for (const href of destinations)
    expect((await page.request.get(href.split('#')[0] || '/')).status()).toBe(
      200,
    );
  await page
    .locator('.cinema-copy')
    .getByRole('link', { name: 'Explore Programs', exact: true })
    .click();
  await expect(page).toHaveURL(/#programs/);
  await page
    .locator('.path-card')
    .first()
    .getByRole('link', { name: 'Explore Program', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'QA / SDET',
  );
  await expect(
    page.getByRole('link', { name: 'Start Application', exact: true }).first(),
  ).toBeVisible();
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 0) > 1050) {
    await page.locator('.program-dropdown summary').click();
    await expect(page.locator('.program-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.program-menu')).not.toBeVisible();
  } else {
    await page.getByLabel('Open navigation').click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'Real Projects' })
      .click();
    await expect(page).toHaveURL(/#projects/);
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeVisible();
  }
  expect(errors).toEqual([]);
  if (
    process.env.CAPTURE_PREVIEWS &&
    ['desktop', 'mobile'].includes(info.project.name)
  ) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.hero-art')).toHaveJSProperty('complete', true);
    await page.screenshot({
      path: `docs/previews/phase2-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
      scale: 'css',
    });
  }
});
test('FAQ keyboard controls, learning preview and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Assignments', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Make it work. Make it yours.' }),
  ).toBeVisible();
  const faq = page
    .locator('.faq-item')
    .filter({ hasText: 'Do you guarantee job placement?' });
  await faq.locator('summary').focus();
  await faq.locator('summary').press('Enter');
  await expect(faq).toHaveAttribute('open', '');
  await expect(faq.locator('p')).toContainText('No.');
  await faq.locator('summary').press('Enter');
  await expect(faq).not.toHaveAttribute('open');
  expect(
    await page
      .locator('.hero-atmosphere')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
test('homepage and interest form have no automated WCAG AA violations', async ({
  page,
}) => {
  for (const route of [
    '/',
    '/interest?program=ai-engineering',
    '/policies/privacy',
  ]) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          failure: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
test('inquiry validates consent, persists in PostgreSQL and emits PII-free events', async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    'Configured isolated database required',
  );
  const email = `e2e-${randomUUID()}@example.test`;
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await page.goto('/interest?program=ai-engineering&intent=career_call');
    await page.evaluate(() => {
      (window as unknown as { capturedEvents: unknown[] }).capturedEvents = [];
      window.addEventListener('nexora:marketing', (event) => {
        (
          window as unknown as { capturedEvents: unknown[] }
        ).capturedEvents.push((event as CustomEvent).detail);
      });
    });
    await page
      .getByRole('button', { name: 'Request a Free Career Call', exact: true })
      .click();
    await expect(page.locator('#name-error')).toBeVisible();
    await page.getByLabel('Your name', { exact: true }).fill('Test Learner');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByRole('checkbox').check();
    await page.waitForTimeout(1700);
    await page
      .getByRole('button', { name: 'Request a Free Career Call', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Inquiry received.' }),
    ).toBeVisible();
    const { rows } = await pool.query(
      'SELECT program, intent, "consentedAt" FROM "Inquiry" WHERE email=$1',
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].program).toBe('ai-engineering');
    expect(rows[0].intent).toBe('career_call');
    expect(rows[0].consentedAt).toBeTruthy();
    const events = await page.evaluate(
      () => (window as unknown as { capturedEvents: unknown[] }).capturedEvents,
    );
    expect(JSON.stringify(events)).not.toContain(email);
    expect(events).toContainEqual({
      name: 'inquiry_submitted',
      location: 'inquiry_form',
      program: 'ai-engineering',
      intent: 'career_call',
    });
    await page.reload();
    expect(
      (await pool.query('SELECT id FROM "Inquiry" WHERE email=$1', [email]))
        .rows,
    ).toHaveLength(1);
  } finally {
    await pool.query('DELETE FROM "Inquiry" WHERE email=$1', [email]);
    await pool.end();
  }
});
test('inquiry API enforces origin, consent, honeypot, replay safety and rate limits', async ({
  request,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    'Configured isolated database required',
  );
  const email = `api-${randomUUID()}@example.test`;
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const input = {
    name: 'Test Learner',
    email,
    program: 'qa-sdet',
    intent: 'program_interest',
    message: '',
    consent: true,
    website: '',
  };
  const headers = { origin: 'http://127.0.0.1:3100' };
  const token = createChallenge(secret, Date.now() - 2000);
  try {
    expect(
      (
        await request.post('/api/inquiries', {
          data: { ...input, token },
          headers: { origin: 'https://other.example' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/inquiries', {
          data: { ...input, token, consent: false },
          headers,
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/inquiries', {
          data: { ...input, token, website: 'spam' },
          headers,
        })
      ).status(),
    ).toBe(400);
    const first = await request.post('/api/inquiries', {
      data: { ...input, token },
      headers,
    });
    expect(first.status()).toBe(201);
    const receipt = (await first.json()).receipt;
    expect(
      (
        await (
          await request.post('/api/inquiries', {
            data: { ...input, token },
            headers,
          })
        ).json()
      ).receipt,
    ).toBe(receipt);
    expect(
      (
        await request.post('/api/inquiries', {
          data: { ...input, token, name: 'Different Learner' },
          headers,
        })
      ).status(),
    ).toBe(409);
    expect(
      (await pool.query('SELECT id FROM "Inquiry" WHERE email=$1', [email]))
        .rows,
    ).toHaveLength(1);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request.post('/api/inquiries', {
            data: {
              ...input,
              token: createChallenge(secret, Date.now() - 2000),
            },
            headers,
          })
        ).status(),
      ).toBe(201);
    expect(
      (
        await request.post('/api/inquiries', {
          data: { ...input, token: createChallenge(secret, Date.now() - 2000) },
          headers,
        })
      ).status(),
    ).toBe(429);
  } finally {
    await pool.query('DELETE FROM "Inquiry" WHERE email=$1', [email]);
    await pool.end();
  }
});
