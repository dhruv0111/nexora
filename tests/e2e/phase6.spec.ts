import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const url = process.env.TEST_DATABASE_URL,
  base = 'http://127.0.0.1:3100',
  headers = { origin: base };
test('six consent-based career and employer hiring journeys work', async ({
  page,
  context,
  browser,
}, info) => {
  test.skip(!url, 'Requires isolated database');
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const pool = new Pool({ connectionString: url }),
    prefix = `p6e${randomUUID().replaceAll('-', '')}`,
    student = prefix + 's',
    admin = prefix + 'a',
    employer = prefix + 'r',
    other = prefix + 'o',
    course = prefix + 'c',
    cohort = prefix + 'h',
    enrollment = prefix + 'e',
    device = {
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
    };
  const ac = await browser.newContext(device),
    ec = await browser.newContext(device),
    oc = await browser.newContext(device),
    ap = await ac.newPage(),
    ep = await ec.newPage();
  for (const c of [ac, ec, oc]) c.setDefaultTimeout(15000);
  let employerId = '',
    jobId = '',
    applicationId = '';
  async function identity(c: BrowserContext, id: string, role: string) {
    const token = randomUUID();
    await pool.query(
      'INSERT INTO "User"(id,role,name,"updatedAt") VALUES($1,$2,$3,now())',
      [id, role, `Synthetic ${role}`],
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
  async function post(c: BrowserContext, action: string, data: unknown) {
    const r = await c.request.post(`/api/career/${action}`, { headers, data });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  }
  async function stage(status: string) {
    const p = (
      await pool.query('SELECT version FROM "HiringApplication" WHERE id=$1', [
        applicationId,
      ])
    ).rows[0];
    await post(ec, 'transition', {
      id: applicationId,
      version: p.version,
      status,
      note: 'Synthetic recruiter review of a candidate pipeline transition.',
    });
  }
  async function check(p: Page) {
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
  const companyName = `Synthetic Hiring Company ${info.project.name}`,
    jobTitle = `Synthetic QA role ${info.project.name}`;
  try {
    await identity(context, student, 'STUDENT');
    await identity(ac, admin, 'ADMIN');
    await identity(ec, employer, 'EMPLOYER');
    await identity(oc, other, 'EMPLOYER');
    await pool.query(
      `INSERT INTO "Course"(id,slug,title,description,track,status,"contentApprovedAt","updatedAt") VALUES($1,$1,'Synthetic career course','Isolated synthetic learning fixture.','QA_SDET','PUBLISHED',now(),now())`,
      [course],
    );
    await pool.query(
      `INSERT INTO "Cohort"(id,"courseId",name,status) VALUES($1,$2,'Synthetic graduate cohort','PUBLISHED')`,
      [cohort, course],
    );
    await pool.query(
      `INSERT INTO "Enrollment"(id,"userId","cohortId",status,"updatedAt") VALUES($1,$2,$3,'COMPLETED',now())`,
      [enrollment, student, cohort],
    );
    await pool.query(
      `INSERT INTO "Payment"(id,"enrollmentId","amountMinor",currency,status,provider,"providerRef","verifiedAt","idempotencyKey","updatedAt") VALUES($1,$2,10000,'INR','SUCCEEDED','razorpay',$3,now(),$1,now())`,
      [prefix + 'pay', enrollment, 'pay_' + prefix],
    );
    // 1. A graduate creates a profile and explicitly enables employer sharing.
    await page.goto('/career/profile');
    await page
      .getByLabel('Display name', { exact: true })
      .fill('Synthetic Career Learner');
    await page
      .getByLabel('Professional headline', { exact: true })
      .fill('QA engineer building reliable systems');
    await page
      .getByLabel('Career summary', { exact: true })
      .fill(
        'A synthetic graduate profile for isolated career workflow verification.',
      );
    await page
      .getByLabel('Education', { exact: true })
      .fill('Synthetic qualification');
    await page
      .getByLabel(
        'Actual professional background (exclude training as employment)',
      )
      .fill('No employment experience claimed from training.');
    await page
      .getByLabel('Self-reported technical skills (one per line)')
      .fill('TypeScript\nTesting');
    await page.getByLabel('Preferred roles (one per line)').fill('QA Engineer');
    await page
      .getByLabel('Preferred locations (one per line)')
      .fill('Bengaluru');
    await page
      .getByLabel(
        'Preferred work arrangements (REMOTE, HYBRID, ONSITE; one per line)',
      )
      .fill('REMOTE');
    await page.getByLabel('Work eligibility description').fill('India');
    await page.getByLabel('Profile visibility').selectOption('EMPLOYERS');
    await page
      .getByLabel('I accept sharing notice career-v1 for my chosen visibility')
      .check();
    await page
      .getByRole('button', { name: 'Save career profile', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'SELECT version FROM \"CareerProfile\" WHERE \"userId\"=$1',
              [student],
            )
          ).rows[0]?.version,
      )
      .toBe(1);
    await page.getByRole('button', { name: 'Create resume version' }).click();
    await expect(
      page.getByRole('heading', { name: 'Resume version 1' }),
    ).toBeVisible();
    await post(ac, 'readiness', {
      userId: student,
      version: 0,
      ready: true,
      communication: 8,
      preparation: 8,
      overrideScore: -1,
      reason:
        'Synthetic readiness review of verified training evidence and preparation.',
    });
    // 2. Company registers, submits evidence and receives a separate admin review.
    await ep.goto('/career/employer');
    await ep.getByLabel('Legal company name').fill(companyName);
    await ep
      .getByLabel('Official company website')
      .fill('https://synthetic.example');
    await ep
      .getByLabel('Business email matching website domain')
      .fill('recruiter@synthetic.example');
    await ep
      .getByLabel('Authorized recruiter name')
      .fill('Synthetic Recruiter');
    await ep.getByLabel('Industry', { exact: true }).fill('Software');
    await ep.getByLabel('Company location').fill('Bengaluru');
    await ep
      .getByLabel('Hiring requirements and recruiter authority')
      .fill(
        'Synthetic verification evidence for isolated testing, not a real company partnership.',
      );
    await ep
      .getByLabel(
        'I am authorized to register this company using a recruiter account',
      )
      .check();
    await ep
      .getByRole('button', { name: 'Register company', exact: true })
      .click();
    await expect(
      ep.getByRole('heading', { name: companyName, exact: true }),
    ).toBeVisible();
    employerId = (
      await pool.query('SELECT id FROM "Employer" WHERE "userId"=$1', [
        employer,
      ])
    ).rows[0].id;
    expect(
      (await ec.request.get(`/api/career/candidate?id=${student}`)).status(),
    ).toBe(403);
    await ep
      .getByLabel('Verification submission and authorization details')
      .fill(
        'Synthetic domain and recruiter authority references submitted for manual review.',
      );
    await ep
      .getByRole('button', { name: 'Submit for administrative review' })
      .click();
    await expect(ep.locator('.learn-tag').first()).toHaveText('PENDING_REVIEW');
    await ap.goto('/career/admin');
    let card = ap.locator('article').filter({
      has: ap.getByRole('heading', { name: companyName, exact: true }),
    });
    await card.getByText(`Review ${companyName}`, { exact: true }).click();
    await card
      .getByLabel('Employer verification decision')
      .selectOption('VERIFIED');
    await card
      .getByLabel('Verification findings and evidence references')
      .fill(
        'Reviewed synthetic company authority evidence in isolated harness; no real verification claimed.',
      );
    await card.getByRole('button', { name: 'Record employer review' }).click();
    await expect(card.locator('.learn-tag')).toHaveText('VERIFIED');
    // 3. Employer creates a draft; admin moderates; employer publishes unchanged content.
    await ep.reload();
    await ep.getByText('Create an opening', { exact: true }).click();
    let form = ep.locator('form').filter({
      has: ep.getByRole('button', {
        name: 'Create draft opening',
        exact: true,
      }),
    });
    await form.getByLabel('Job title', { exact: true }).fill(jobTitle);
    await form
      .getByLabel('Role responsibilities and prerequisites')
      .fill(
        'Build and review reliable API tests using synthetic data. Explain actual training evidence.',
      );
    await form
      .getByLabel('Required skills (one per line)')
      .fill('TypeScript\nTesting');
    await form.getByLabel('Job location', { exact: true }).fill('Bengaluru');
    await form.getByLabel('Work arrangement').selectOption('REMOTE');
    await form.getByLabel('Work eligibility requirement').fill('India');
    await form
      .getByRole('button', { name: 'Create draft opening', exact: true })
      .click();
    await expect(
      ep.getByRole('heading', { name: jobTitle, exact: true }),
    ).toBeVisible();
    jobId = (
      await pool.query('SELECT id FROM "Opportunity" WHERE "employerId"=$1', [
        employerId,
      ])
    ).rows[0].id;
    await ap.reload();
    card = ap.locator('article').filter({
      has: ap.getByRole('heading', { name: jobTitle, exact: true }),
    });
    await card.getByText(`Moderate ${jobTitle}`, { exact: true }).click();
    await card
      .getByLabel('Moderation findings and legitimacy checks')
      .fill(
        'Synthetic role reviewed for isolated testing; no genuine listing fabricated.',
      );
    await card.getByRole('button', { name: 'Save job moderation' }).click();
    await expect(card.locator('.learn-tag')).toHaveText('APPROVED');
    await ep.reload();
    await ep.getByText(`Edit ${jobTitle}`, { exact: true }).click();
    form = ep.locator('form').filter({
      has: ep.getByRole('button', { name: 'Save opening', exact: true }),
    });
    await form.getByLabel('Opening state').selectOption('PUBLISHED');
    await form
      .getByRole('button', { name: 'Save opening', exact: true })
      .click();
    await expect(
      ep
        .locator('article')
        .filter({
          has: ep.getByRole('heading', { name: jobTitle, exact: true }),
        })
        .locator('.learn-tag'),
    ).toHaveText('PUBLISHED · APPROVED');
    // 4. Student applies; recruiter invites; candidate confirms.
    await page.goto(`/career/jobs/${jobId}`);
    await page
      .getByLabel('Your application statement')
      .fill(
        'I can explain my synthetic training projects and actual technical contribution.',
      );
    await page
      .getByLabel('I consent to share my career profile with this employer')
      .check();
    await page.getByRole('button', { name: 'Save job application' }).click();
    await expect(page.getByRole('status')).toContainText('Saved successfully.');
    applicationId = (
      await pool.query('SELECT id FROM "HiringApplication" WHERE "userId"=$1', [
        student,
      ])
    ).rows[0].id;
    expect(
      (
        await oc.request.get(`/api/career/application?id=${applicationId}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await ec.request.post('/api/career/apply', {
          headers,
          data: { opportunityId: jobId },
        })
      ).status(),
    ).toBe(422);
    await stage('SCREENING');
    await stage('SHORTLISTED');
    await ep.goto(`/career/applications/${applicationId}`);
    await ep
      .getByText('Invite candidate to an interview', { exact: true })
      .click();
    await ep
      .getByLabel('Interview round name')
      .fill('Synthetic technical discussion');
    await ep.getByRole('button', { name: 'Send interview invitation' }).click();
    await expect(
      ep.getByRole('heading', { name: 'Synthetic technical discussion' }),
    ).toBeVisible();
    await page.goto(`/career/applications/${applicationId}`);
    await page
      .getByText('Respond or update Synthetic technical discussion', {
        exact: true,
      })
      .click();
    await page.getByLabel('Interview action').selectOption('CONFIRM');
    await page.getByRole('button', { name: 'Save interview response' }).click();
    await expect(page.getByRole('status')).toContainText('Saved successfully.');
    // 5. Offer and independently verified joining remain separate records.
    await stage('INTERVIEW');
    await ep.reload();
    await ep.getByText('Record a genuine offer', { exact: true }).click();
    await ep
      .getByLabel('Offer reference and evidence locator')
      .fill('Synthetic written offer reference for this isolated test only.');
    await ep
      .getByLabel('Offer recording rationale')
      .fill('Recorded test artifact; no real employment or offer is claimed.');
    await ep.getByRole('button', { name: 'Record unverified offer' }).click();
    await expect(ep.locator('.learn-tag').first()).toHaveText('OFFERED');
    await ap.goto(`/career/applications/${applicationId}`);
    await ap
      .getByText('Administratively verify offer or joining', { exact: true })
      .click();
    await ap
      .getByLabel('Independently checked evidence reference')
      .fill('Synthetic independently checked offer record reference.');
    await ap
      .getByLabel('Verification findings and source')
      .fill('Isolated admin confirmation of synthetic offer evidence.');
    await ap
      .getByRole('button', { name: 'Save verified hiring outcome' })
      .click();
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              'SELECT \"offerVerifiedAt\" FROM \"HiringOutcome\" WHERE \"applicationId\"=$1',
              [applicationId],
            )
          ).rows[0]?.offerVerifiedAt,
      )
      .toBeTruthy();
    expect(
      (
        await pool.query(
          'SELECT "joiningVerifiedAt" FROM "HiringOutcome" WHERE "applicationId"=$1',
          [applicationId],
        )
      ).rows[0].joiningVerifiedAt,
    ).toBeNull();
    await ap.reload();
    await ap
      .getByText('Administratively verify offer or joining', { exact: true })
      .click();
    await ap.getByLabel('Verification action').selectOption('VERIFY_JOINING');
    await ap
      .getByLabel('Independently checked evidence reference')
      .fill('Synthetic joining confirmation checked with isolated fixtures.');
    await ap
      .getByLabel('Verification findings and source')
      .fill(
        'Actual event in this synthetic fixture verified separately from its offer.',
      );
    await ap
      .getByRole('button', { name: 'Save verified hiring outcome' })
      .click();
    await expect(ap.locator('.learn-tag').first()).toHaveText('HIRED');
    await ep.goto(`/career/candidates/${student}`);
    await check(ep);
    if (
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    )
      await ep.screenshot({
        path: `docs/previews/phase6-candidate-${info.project.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    // 6. Revocation immediately blocks future recruiter profile and resume requests.
    await page.goto('/career/profile');
    await page.getByRole('button', { name: 'Revoke company access' }).click();
    await expect(
      page.getByRole('button', { name: 'Grant company access again' }),
    ).toBeVisible();
    expect(
      (await ec.request.get(`/api/career/candidate?id=${student}`)).status(),
    ).toBe(404);
    const resumeId = (
      await pool.query('SELECT id FROM "CareerResume" WHERE "userId"=$1', [
        student,
      ])
    ).rows[0].id;
    expect(
      (await ec.request.get(`/api/career/resume?id=${resumeId}`)).status(),
    ).toBe(404);
    await ep.goto(`/career/candidates/${student}`);
    await expect(
      ep.getByRole('heading', { name: 'Let’s get you back on track.' }),
    ).toBeVisible();
    await page.goto('/career');
    await check(page);
    await ap.goto('/career/admin');
    await check(ap);
    await ep.goto('/career/employer');
    await check(ep);
    if (
      process.env.CAPTURE_PREVIEWS &&
      ['desktop', 'mobile'].includes(info.project.name)
    ) {
      for (const [p, name] of [
        [page, 'student'],
        [ap, 'admin'],
        [ep, 'employer'],
      ] as const)
        await p.screenshot({
          path: `docs/previews/phase6-${name}-${info.project.name}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  } finally {
    if (applicationId) {
      for (const table of ['HiringOutcome', 'HiringInterview', 'HiringHistory'])
        await pool.query(`DELETE FROM "${table}" WHERE "applicationId"=$1`, [
          applicationId,
        ]);
      await pool.query('DELETE FROM "HiringApplication" WHERE id=$1', [
        applicationId,
      ]);
    }
    await pool.query('DELETE FROM "CareerConsent" WHERE "userId"=$1', [
      student,
    ]);
    await pool.query('DELETE FROM "CareerResume" WHERE "userId"=$1', [student]);
    await pool.query('DELETE FROM "CareerReadiness" WHERE "userId"=$1', [
      student,
    ]);
    await pool.query('DELETE FROM "CareerProfile" WHERE "userId"=$1', [
      student,
    ]);
    if (jobId)
      await pool.query('DELETE FROM "Opportunity" WHERE id=$1', [jobId]);
    if (employerId)
      await pool.query('DELETE FROM "Employer" WHERE id=$1', [employerId]);
    await pool.query('DELETE FROM "Payment" WHERE "enrollmentId"=$1', [
      enrollment,
    ]);
    await pool.query('DELETE FROM "Enrollment" WHERE id=$1', [enrollment]);
    await pool.query('DELETE FROM "Cohort" WHERE id=$1', [cohort]);
    await pool.query('DELETE FROM "Course" WHERE id=$1', [course]);
    await pool.query('DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::text[])', [
      [student, admin, employer, other],
    ]);
    await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [
      [student, admin, employer, other],
    ]);
    await Promise.all([ac.close(), ec.close(), oc.close()]);
    await pool.end();
  }
});
