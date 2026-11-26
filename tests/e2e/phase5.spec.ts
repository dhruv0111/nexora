import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const url = process.env.TEST_DATABASE_URL,
  base = 'http://127.0.0.1:3100',
  headers = { origin: base };
async function identity(
  pool: Pool,
  c: BrowserContext,
  id: string,
  role: string,
  name: string,
) {
  const token = randomUUID();
  await pool.query(
    'INSERT INTO "User"(id,role,name,"updatedAt") VALUES($1,$2,$3,now())',
    [id, role, name],
  );
  await pool.query(
    'INSERT INTO "Session"(id,"sessionToken","userId",expires) VALUES($1,$2,$3,now()+interval \'30 minutes\')',
    [randomUUID(), token, id],
  );
  await c.addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
test('project delivery, review gates and confidential portfolio boundaries work', async ({
  page,
  context,
  browser,
}, info) => {
  test.skip(!url, 'Requires isolated database');
  test.setTimeout(120000);
  const pool = new Pool({ connectionString: url }),
    prefix = `p5e${randomUUID().replaceAll('-', '')}`,
    student = prefix + 's',
    other = prefix + 'o',
    mentor = prefix + 'm',
    admin = prefix + 'a',
    course = prefix + 'c',
    cohort = prefix + 'h',
    enrollment = prefix + 'e',
    device = {
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
    };
  const mc = await browser.newContext(device),
    ac = await browser.newContext(device),
    oc = await browser.newContext(device);
  const projectName = `Isolated HireFlow delivery · ${info.project.name}`;
  let projectId = '',
    podId = '',
    ticketId = '';
  async function post(c: BrowserContext, action: string, data: unknown) {
    const r = await c.request.post(`/api/projects/${action}`, {
      headers,
      data,
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  }
  async function ticket() {
    return (
      await pool.query('SELECT * FROM "ProjectTicket" WHERE id=$1', [ticketId])
    ).rows[0];
  }
  async function move(status: string, c = mc) {
    const t = await ticket();
    return post(c, 'move', { ticketId, version: t.version, status });
  }
  try {
    await identity(
      pool,
      context,
      student,
      'STUDENT',
      'Isolated Project Learner',
    );
    await identity(pool, oc, other, 'STUDENT', 'Unrelated Project Learner');
    await identity(pool, mc, mentor, 'MENTOR', 'Isolated Project Mentor');
    await identity(pool, ac, admin, 'ADMIN', 'Isolated Project Admin');
    await pool.query(
      `INSERT INTO "Course"(id,slug,title,description,track,status,"contentApprovedAt","updatedAt") VALUES($1,$1,'Isolated project course','Synthetic project verification fixture.','FULL_STACK','PUBLISHED',now(),now())`,
      [course],
    );
    await pool.query(
      `INSERT INTO "Cohort"(id,"courseId",name,status,capacity) VALUES($1,$2,'Isolated delivery cohort','PUBLISHED',10)`,
      [cohort, course],
    );
    await pool.query(
      `INSERT INTO "Enrollment"(id,"userId","cohortId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',now())`,
      [enrollment, student, cohort],
    );
    await pool.query(
      `INSERT INTO "Payment"(id,"enrollmentId","amountMinor",currency,status,provider,"providerRef","verifiedAt","idempotencyKey","updatedAt") VALUES($1,$2,10000,'INR','SUCCEEDED','razorpay',$3,now(),$1,now())`,
      [prefix + 'pay', enrollment, 'pay_' + prefix],
    );
    await pool.query(
      'INSERT INTO "Mentor"(id,"userId",expertise) VALUES($1,$2,ARRAY[\'Synthetic project mentoring\'])',
      [prefix + 'profile', mentor],
    );
    await pool.query(
      'INSERT INTO "CohortMentor"("cohortId","mentorId") VALUES($1,$2)',
      [cohort, prefix + 'profile'],
    );
    const ap = await ac.newPage();
    await ap.goto('/projects');
    await ap.getByLabel('Project name', { exact: true }).fill(projectName);
    await ap
      .getByLabel('Project brief and training outcomes')
      .fill(
        'Build an isolated applicant workflow using synthetic data in a separate HireFlow repository.',
      );
    await ap
      .getByLabel('Confidential project (blocks portfolio exports)')
      .uncheck();
    await ap.getByLabel('Assigned lead mentor').selectOption(mentor);
    await ap.getByLabel('Publication status').selectOption('DRAFT');
    await ap
      .getByRole('button', { name: 'Create project', exact: true })
      .click();
    await expect(
      ap.getByRole('heading', {
        name: projectName,
        exact: true,
      }),
    ).toBeVisible();
    const projectCard = ap.locator('section.learn-card').filter({
      has: ap.getByRole('heading', { name: projectName, exact: true }),
    });
    await projectCard
      .getByText('Edit or publish project', { exact: true })
      .click();
    await projectCard
      .getByLabel('Project publication state')
      .selectOption('PUBLISHED');
    await projectCard
      .getByLabel('Publication or change rationale')
      .fill(
        'Assigned mentor reviewed the synthetic project brief and approved publication.',
      );
    await projectCard
      .getByRole('button', { name: 'Save project publication' })
      .click();
    await expect(projectCard.locator('.learn-tag').first()).toContainText(
      'PUBLISHED',
    );
    // Parallel viewport fixtures use the actual creator's audit to locate their project.
    projectId = (
      await pool.query(
        'SELECT "entityId" FROM "AuditLog" WHERE "actorId"=$1 AND action=\'PROJECT_CREATED\' ORDER BY "createdAt" DESC LIMIT 1',
        [admin],
      )
    ).rows[0].entityId;
    podId = (
      await post(ac, 'pod', {
        projectId,
        name: 'Cross-functional delivery pod',
      })
    ).id;
    await post(mc, 'member', {
      podId,
      userId: student,
      enrollmentId: enrollment,
      supervisorId: mentor,
      responsibility:
        'Build and explain the request-validation implementation and its evidence.',
      version: 0,
      remove: false,
    });
    const sp = {
      podId,
      version: 0,
      name: 'Validation sprint',
      goal: 'Deliver and review a small validation increment with QA evidence.',
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'PLANNED',
      retrospective: '',
    };
    const sprint = (await post(mc, 'sprint', sp)).id;
    await post(mc, 'sprint', {
      ...sp,
      id: sprint,
      version: 1,
      status: 'ACTIVE',
    });
    ticketId = (
      await post(mc, 'ticket', {
        podId,
        version: 0,
        sprintId: sprint,
        assigneeId: student,
        title: 'Implement input validation',
        requirements:
          'Implement typed request validation and document error behavior.',
        acceptance: ['Reject malformed applicant input with a clear response'],
        definitionOfDone: [
          'Review implementation, tests, QA and security evidence',
        ],
        priority: 'HIGH',
        kind: 'STORY',
        dueAt: sp.endsAt,
        issueUrl: '',
      })
    ).id;
    expect(
      (await oc.request.get(`/api/projects/pod?id=${podId}`)).status(),
    ).toBe(404);
    expect(
      (await oc.request.get(`/api/projects/ticket?id=${ticketId}`)).status(),
    ).toBe(404);
    const invalid = await context.request.post('/api/projects/move', {
      headers,
      data: { ticketId, version: (await ticket()).version, status: 'DONE' },
    });
    expect(invalid.status()).toBe(409);
    const editor = await mc.newPage();
    await editor.goto(`/projects/tickets/${ticketId}`);
    await editor
      .getByText('Edit ticket scope or assignment', { exact: true })
      .click();
    await editor
      .getByLabel('Edit technical requirements')
      .fill(
        'Implement typed validation, malformed-input handling and a documented empty-payload regression.',
      );
    await Promise.all([
      editor.waitForResponse(
        (r) =>
          r.url().endsWith('/api/projects/ticket') &&
          r.request().method() === 'POST',
      ),
      editor.getByRole('button', { name: 'Save ticket changes' }).click(),
    ]);
    await expect(
      editor.locator('.learn-lesson-body').filter({
        hasText:
          'Implement typed validation, malformed-input handling and a documented empty-payload regression.',
      }),
    ).toBeVisible();
    await editor.close();
    await move('READY');
    await page.goto(`/projects/${podId}`);
    await expect(
      page.getByRole('link', { name: /Implement input validation/ }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /Implement input validation/ })
      .click();
    await page.getByLabel('Move ticket to').selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: 'Update ticket status' }).click();
    await expect(
      page.locator('.learn-tag').filter({ hasText: /^IN_PROGRESS$/ }),
    ).toBeVisible();
    await page
      .getByLabel('Your actual contribution and supporting evidence')
      .fill(
        'Implemented request parsing and tested malformed input using synthetic fixtures.',
      );
    await page
      .getByRole('button', { name: 'Submit contribution evidence' })
      .click();
    await expect(
      page.getByText(
        'Implemented request parsing and tested malformed input using synthetic fixtures.',
        { exact: true },
      ),
    ).toBeVisible();
    const evidenceId = (
      await pool.query(
        'SELECT id FROM "ContributionEvidence" WHERE "ticketId"=$1',
        [ticketId],
      )
    ).rows[0].id;
    await page.getByLabel('Private contribution attachment').setInputFiles({
      name: 'evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Synthetic reviewed test evidence'),
    });
    await page.getByRole('button', { name: 'Attach evidence file' }).click();
    await expect(
      page.getByRole('link', { name: 'Download evidence.txt' }),
    ).toBeVisible();
    const file = (
      await pool.query('SELECT id FROM "ProjectFile" WHERE "evidenceId"=$1', [
        evidenceId,
      ])
    ).rows[0];
    expect(
      (await oc.request.get(`/api/projects/files/${file.id}`)).status(),
    ).toBe(404);
    await page.getByLabel('Move ticket to').selectOption('IN_REVIEW');
    await page.getByRole('button', { name: 'Update ticket status' }).click();
    await expect(
      page.locator('.learn-tag').filter({ hasText: /^IN_REVIEW$/ }),
    ).toBeVisible();
    const mp = await mc.newPage();
    await mp.goto(`/projects/tickets/${ticketId}`);
    await mp
      .getByLabel('Evidence review decision')
      .selectOption('CHANGES_REQUESTED');
    await mp
      .getByLabel('Review rationale and actionable feedback')
      .fill(
        'Add an explicit test for empty applicant payloads and explain the result.',
      );
    await mp.getByRole('button', { name: 'Save evidence review' }).click();
    await expect(
      mp.locator('.learn-tag').filter({ hasText: /^CHANGES_REQUESTED$/ }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByLabel('Your actual contribution and supporting evidence')
      .fill(
        'Added and reviewed the empty-payload regression along with typed validation behavior.',
      );
    await page
      .getByRole('button', { name: 'Submit contribution evidence' })
      .click();
    await expect(
      page.getByText(
        'Added and reviewed the empty-payload regression along with typed validation behavior.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByLabel('Private contribution attachment').setInputFiles({
      name: 'revised-evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Revised synthetic validation artifact with empty-payload regression.',
      ),
    });
    await page.getByRole('button', { name: 'Attach evidence file' }).click();
    await expect(
      page.getByRole('link', { name: 'Download revised-evidence.txt' }),
    ).toBeVisible();
    const approvedId = (
      await pool.query(
        'SELECT id FROM "ContributionEvidence" WHERE "ticketId"=$1 AND status=\'SUBMITTED\'',
        [ticketId],
      )
    ).rows[0].id;
    await post(mc, 'review', {
      id: approvedId,
      version: 1,
      status: 'APPROVED',
      feedback:
        'Inspected the actual submitted artifact and confirmed the stated contribution and regression evidence.',
      evaluation: 4,
    });
    const approveQuality = async () =>
      post(mc, 'quality', {
        ticketId,
        version: (await ticket()).version,
        codeReviewed: true,
        qaAccepted: true,
        dodAccepted: true,
        securityCleared: true,
        note: 'Reviewed the implementation, independent QA acceptance, Definition of Done and security evidence.',
      });
    await approveQuality();
    await move('QA_TESTING');
    await approveQuality();
    await move('DONE');
    await page.reload();
    await page
      .getByText('Create or revise portfolio summary', { exact: true })
      .click();
    await page
      .getByLabel('Public project contribution description')
      .fill(
        'Implemented and tested a request-validation boundary in a supervised synthetic-data training project.',
      );
    await page
      .getByLabel('Technical challenges and decisions')
      .fill(
        'Separated parsing errors from schema validation and verified malformed-payload behavior.',
      );
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/projects/portfolio') &&
          r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Save portfolio draft' }).click(),
    ]);
    const pf = (
      await pool.query(
        'SELECT id,version FROM "PortfolioEntry" WHERE "userId"=$1',
        [student],
      )
    ).rows[0];
    expect(
      (await (await context.request.get('/api/projects/export')).json())
        .entries,
    ).toHaveLength(0);
    await post(mc, 'portfolio-review', {
      id: pf.id,
      version: pf.version,
      approve: true,
      feedback:
        'Reviewed for accuracy and confidentiality. The description is supported by approved training evidence.',
    });
    const report = await (
      await context.request.get('/api/projects/export')
    ).json();
    expect(report.entries).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain('evidence.txt');
    expect(JSON.stringify(report)).not.toContain('https://github.com');
    expect(report.engagementType).toBe('SUPERVISED_TRAINING');
    await post(mc, 'release', {
      podId,
      title: 'Validation readiness',
      notes:
        'Recorded review of the synthetic training increment. No production deployment is claimed.',
      status: 'READY',
      deploymentUrl: '',
    });
    await page.goto(`/projects/${podId}`);
    await mp.goto(`/projects/tickets/${ticketId}`);
    for (const p of [page, mp]) {
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page: p })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
    if (
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    ) {
      await page.locator('.project-board-scroll').evaluate((el) => {
        el.scrollTo({
          left: el.scrollWidth - el.clientWidth,
          behavior: 'instant',
        });
      });
      await expect
        .poll(() =>
          page
            .locator('.project-board-scroll')
            .evaluate((el) =>
              Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft),
            ),
        )
        .toBeLessThan(2);
      await page.screenshot({
        path: `docs/previews/phase5-board-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
      await mp.screenshot({
        path: `docs/previews/phase5-review-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
      await page.goto('/projects/portfolio');
      await page.screenshot({
        path: `docs/previews/phase5-portfolio-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
    }
  } finally {
    if (podId) {
      await pool.query('DELETE FROM "PortfolioEntry" WHERE "userId"=$1', [
        student,
      ]);
      await pool.query(
        'DELETE FROM "ProjectFile" WHERE "evidenceId" IN (SELECT e.id FROM "ContributionEvidence" e JOIN "ProjectTicket" t ON t.id=e."ticketId" WHERE t."podId"=$1)',
        [podId],
      );
      await pool.query(
        'DELETE FROM "ContributionEvidence" WHERE "ticketId" IN (SELECT id FROM "ProjectTicket" WHERE "podId"=$1)',
        [podId],
      );
      await pool.query('DELETE FROM "ProjectTicket" WHERE "podId"=$1', [podId]);
      await pool.query('DELETE FROM "ProjectSprint" WHERE "podId"=$1', [podId]);
      await pool.query('DELETE FROM "ProjectConcern" WHERE "podId"=$1', [
        podId,
      ]);
      await pool.query('DELETE FROM "ProjectRelease" WHERE "podId"=$1', [
        podId,
      ]);
      await pool.query('DELETE FROM "AgilePod" WHERE id=$1', [podId]);
    }
    if (projectId)
      await pool.query('DELETE FROM "Project" WHERE id=$1', [projectId]);
    await pool.query('DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::text[])', [
      [student, mentor, other, admin],
    ]);
    await pool.query('DELETE FROM "Payment" WHERE "enrollmentId"=$1', [
      enrollment,
    ]);
    await pool.query('DELETE FROM "Enrollment" WHERE id=$1', [enrollment]);
    await pool.query('DELETE FROM "Cohort" WHERE id=$1', [cohort]);
    await pool.query('DELETE FROM "Course" WHERE id=$1', [course]);
    await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [
      [student, mentor, other, admin],
    ]);
    await Promise.all([mc.close(), ac.close(), oc.close()]);
    await pool.end();
  }
});
