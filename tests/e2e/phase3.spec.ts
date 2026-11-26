import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext } from '@playwright/test';
const base = 'http://127.0.0.1:3100',
  headers = { origin: base };
const url = process.env.TEST_DATABASE_URL;
async function identity(pool: Pool, context: BrowserContext, role = 'STUDENT') {
  const id = `p3e${randomUUID().replaceAll('-', '')}`,
    token = randomUUID();
  await pool.query(
    'INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,$2,now())',
    [id, role],
  );
  await pool.query(
    'INSERT INTO "Session" (id,"sessionToken","userId",expires) VALUES ($1,$2,$3,now()+interval \'30 minutes\')',
    [randomUUID(), token, id],
  );
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  return id;
}
async function cleanup(pool: Pool, courseId: string, users: string[]) {
  const appIds = (
    await pool.query('SELECT id FROM "Application" WHERE "courseId"=$1', [
      courseId,
    ])
  ).rows.map((r) => r.id);
  const enrollmentIds = (
    await pool.query(
      'SELECT e.id FROM "Enrollment" e JOIN "Cohort" c ON c.id=e."cohortId" WHERE c."courseId"=$1',
      [courseId],
    )
  ).rows.map((r) => r.id);
  await pool.query(
    'DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::text[]) OR "entityId"=$2 OR "entityId"=ANY($3::text[])',
    [users, courseId, appIds],
  );
  await pool.query(
    'DELETE FROM "Payment" WHERE "enrollmentId"=ANY($1::text[])',
    [enrollmentIds],
  );
  await pool.query('DELETE FROM "Enrollment" WHERE id=ANY($1::text[])', [
    enrollmentIds,
  ]);
  await pool.query('DELETE FROM "Application" WHERE "courseId"=$1', [courseId]);
  await pool.query('DELETE FROM "Cohort" WHERE "courseId"=$1', [courseId]);
  await pool.query('DELETE FROM "CourseRevision" WHERE "courseId"=$1', [
    courseId,
  ]);
  await pool.query('DELETE FROM "Course" WHERE id=$1', [courseId]);
  await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [users]);
}
const details = {
  fullName: 'Isolated Test Learner',
  education: [
    {
      qualification: 'Test qualification',
      institution: 'Test learning institution',
      year: '2022',
    },
  ],
  background: 'NON_TECHNICAL',
  backgroundDetails:
    'I am exploring a technical transition from an unrelated field.',
  careerGoals:
    'I want to build practical software skills, contribute to supervised projects, and learn to explain my decisions.',
  availability: '10_20',
  timezone: 'Asia/Kolkata',
  assessmentAnswers: [],
  consent: true,
};
test('all four programs, search, comparison and 24-week details work', async ({
  page,
}, info) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Find your direction',
  );
  await page.getByLabel('Find your next direction').fill('Playwright');
  await page.getByRole('button', { name: 'Filter programs' }).click();
  await expect(
    page.locator('.catalog-grid').getByRole('heading', { name: 'QA / SDET' }),
  ).toBeVisible();
  await expect(
    page
      .locator('.catalog-grid')
      .getByRole('heading', { name: 'AI Engineering' }),
  ).not.toBeVisible();
  await page.goto('/programs');
  await expect(page.getByRole('table')).toBeAttached();
  if (
    process.env.CAPTURE_PREVIEWS &&
    ['desktop', 'mobile'].includes(info.project.name)
  )
    await page.screenshot({
      path: `docs/previews/phase3-catalog-${info.project.name}.png`,
      fullPage: true,
      scale: 'css',
      animations: 'disabled',
    });
  for (const [slug, name] of [
    ['qa-sdet', 'QA / SDET'],
    ['full-stack', 'Full-Stack Development'],
    ['ai-engineering', 'AI Engineering'],
    ['data-analytics', 'Data Analytics'],
  ]) {
    await page.goto(`/programs/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('.curriculum-list>details')).toHaveCount(6);
    await expect(page.locator('.curriculum-body li')).toHaveCount(24);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (
      slug === 'ai-engineering' &&
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    )
      await page.screenshot({
        path: `docs/previews/phase3-course-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
  }
  await expect(page.locator('.course-hero-flags')).toContainText(
    'Illustrative',
  );
});
test('course catalog and details meet automated AA checks', async ({
  page,
}) => {
  for (const route of ['/programs', '/programs/ai-engineering']) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          why: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
test('resumable application, admin admissions, ownership and disabled checkout', async ({
  page,
  context,
  browser,
}, info) => {
  test.skip(!url, 'Requires configured isolated database');
  const pool = new Pool({ connectionString: url });
  const users: string[] = [];
  const courseId = `p3course${randomUUID().replaceAll('-', '')}`,
    slug = `test-e2e-${courseId}`;
  const adminContext = await browser.newContext(),
    otherContext = await browser.newContext();
  try {
    users.push(await identity(pool, context));
    users.push(await identity(pool, adminContext, 'ADMIN'));
    users.push(await identity(pool, otherContext));
    const draft = (
      JSON.parse(await readFile('prisma/draft-courses.json', 'utf8')) as {
        modules: unknown[];
      }[]
    )[0];
    await pool.query(
      `INSERT INTO "Course"(id,slug,title,description,track,status,"previewVisible",audience,prerequisites,skills,technologies,"updatedAt") VALUES($1,$2,'Isolated admissions test course','A browser-only isolated course fixture.','QA_SDET','DRAFT',true,ARRAY['Isolated test learner audience'],ARRAY['Isolated test prerequisite'],ARRAY['Explain a tested product contribution'],ARRAY['TypeScript'],now())`,
      [courseId, slug],
    );
    await page.goto(`/apply/${slug}`);
    await page.getByLabel('Full name', { exact: true }).fill(details.fullName);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('status')).toContainText('Draft saved');
    await page.reload();
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(
      details.fullName,
    );
    await page
      .getByLabel(/A little about your experience/)
      .fill(details.backgroundDetails);
    await page
      .getByLabel('Qualification or learning pathway')
      .fill('Test qualification');
    if (
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    )
      await page.screenshot({
        path: `docs/previews/phase3-application-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page
      .getByLabel(/What would you like to build toward/)
      .fill(details.careerGoals);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(
      page.locator('.application-form').getByRole('alert'),
    ).toContainText('Agree');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await expect(
      page.locator('.application-status-card .status-pill'),
    ).toHaveText('SUBMITTED');
    const app = (
      await pool.query(
        'SELECT id,version FROM "Application" WHERE "userId"=$1 AND "courseId"=$2',
        [users[0], courseId],
      )
    ).rows[0];
    const duplicate = await context.request.post(`/api/applications/${slug}`, {
      headers,
      data: { action: 'submit', version: app.version, details },
    });
    expect(duplicate.status()).toBe(200);
    expect((await duplicate.json()).id).toBe(app.id);
    expect(
      (
        await otherContext.request.get(`/api/application-records/${app.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await context.request.get(`/api/application-records/${app.id}`)
      ).status(),
    ).toBe(200);
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`/applications/${app.id}`);
    await expect(otherPage.getByRole('heading', { level: 1 })).toContainText(
      'back on track',
    );
    await otherPage.close();

    expect(
      (
        await context.request.post(`/api/admin/applications/${app.id}`, {
          headers,
          data: {
            version: app.version,
            status: 'ACCEPTED',
            assessmentStatus: 'PASSED',
            note: 'Unauthorised request',
          },
        })
      ).status(),
    ).toBe(403);
    const review = await adminContext.request.post(
      `/api/admin/applications/${app.id}`,
      {
        headers,
        data: {
          version: app.version,
          status: 'IN_REVIEW',
          assessmentStatus: 'PENDING',
          note: 'Reviewing this isolated browser test application.',
        },
      },
    );
    expect(review.status()).toBe(200);
    const reviewed = await review.json();
    const blocked = await adminContext.request.post(
      `/api/admin/applications/${app.id}`,
      {
        headers,
        data: {
          version: 2,
          status: 'ACCEPTED',
          assessmentStatus: 'PASSED',
          note: 'Attempt to accept before approved content.',
        },
      },
    );
    expect(blocked.status()).toBe(409);
    const approveBody = {
      version: 1,
      title: 'Isolated admissions test course',
      description: 'A browser-only isolated course fixture.',
      audience: ['Isolated test learner audience'],
      prerequisites: ['Isolated test prerequisite'],
      skills: ['Explain a tested product contribution'],
      technologies: ['TypeScript'],
      durationWeeks: 24,
      deliveryFormat: 'Isolated test delivery format',
      assessmentRequired: false,
      modules: draft.modules,
      status: 'PUBLISHED',
      previewVisible: false,
      contentSource: 'Isolated browser test source, not real approved content',
      approveContent: true,
      priceMinor: 123400,
      currency: 'INR',
      approvePrice: true,
      termsVersion: 'browser-test-v1',
      enrollmentTerms:
        'Isolated browser test terms. Not an actual enrollment agreement. '.repeat(
          4,
        ),
      refundPolicy:
        'Isolated browser test disclosure. Not an actual refund policy. '.repeat(
          3,
        ),
      approveTerms: true,
      mentorIds: [],
    };
    expect(
      (
        await adminContext.request.post(`/api/admin/courses/${courseId}`, {
          headers,
          data: approveBody,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await adminContext.request.post(`/api/admin/applications/${app.id}`, {
          headers,
          data: {
            version: reviewed.version,
            status: 'ACCEPTED',
            assessmentStatus: 'PASSED',
            note: 'Accepted only within the isolated browser fixture.',
          },
        })
      ).status(),
    ).toBe(200);
    const cohort = await adminContext.request.post('/api/admin/cohorts', {
      headers,
      data: {
        courseId,
        name: `Isolated cohort ${courseId}`,
        startsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        endsAt: new Date(Date.now() + 200 * 86400000).toISOString(),
        capacity: 2,
        status: 'PUBLISHED',
        admissionsOpen: true,
        mentorIds: [],
      },
    });
    expect(cohort.status()).toBe(200);
    await page.reload();
    await page.getByRole('link', { name: 'Review fees & enrollment' }).click();
    await expect(
      page.getByRole('button', { name: 'Continue to Sandbox Payment' }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        'Sandbox payments are not configured. No payment can be taken.',
      ),
    ).toBeVisible();
    const manipulated = await context.request.post('/api/checkout', {
      headers,
      data: {
        applicationId: app.id,
        cohortId: (await cohort.json()).id,
        priceVersion: 1,
        termsVersion: 'browser-test-v1',
        agree: true,
        amount: 1,
      },
    });
    expect(manipulated.status()).toBe(422);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    const admin = await adminContext.newPage();
    await admin.goto('/dashboard/admin/admissions');
    await expect(
      admin.getByRole('heading', { name: 'Admissions & programs' }),
    ).toBeVisible();
    await expect(
      admin
        .locator('.admin-record')
        .filter({ hasText: app.id })
        .getByRole('heading', { name: 'Isolated admissions test course' }),
    ).toBeVisible();
    if (
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    ) {
      await page.screenshot({
        path: `docs/previews/phase3-checkout-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
      await admin.screenshot({
        path: `docs/previews/phase3-admin-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
    }
  } finally {
    await cleanup(pool, courseId, users);
    await adminContext.close();
    await otherContext.close();
    await pool.end();
  }
});
