import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const url = process.env.TEST_DATABASE_URL,
  base = 'http://127.0.0.1:3100',
  headers = { origin: base };
async function identity(
  pool: Pool,
  context: BrowserContext,
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
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
test('learning, mentoring, private support and enrollment security work end to end', async ({
  page,
  context,
  browser,
}, info) => {
  test.skip(!url, 'Requires isolated verification database');
  test.setTimeout(120000);
  const pool = new Pool({ connectionString: url }),
    prefix = `p4e${randomUUID().replaceAll('-', '')}`,
    student = `${prefix}s`,
    other = `${prefix}u`,
    mentor = `${prefix}m`,
    unassigned = `${prefix}x`,
    admin = `${prefix}a`,
    course = `${prefix}c`,
    cohort = `${prefix}h`,
    enrollment = `${prefix}e`,
    unpaid = `${prefix}unpaid`;
  const device = {
    viewport: info.project.use.viewport,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch,
  };
  const mentorContext = await browser.newContext(device),
    otherContext = await browser.newContext(device),
    adminContext = await browser.newContext(device),
    outsiderContext = await browser.newContext(device);
  const users = [student, other, mentor, unassigned, admin];
  async function post(c: BrowserContext, action: string, data: unknown) {
    const r = await c.request.post(`/api/learning/${action}`, {
      headers,
      data,
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  }
  try {
    await identity(pool, context, student, 'STUDENT', 'Test Learner');
    await identity(pool, otherContext, other, 'STUDENT', 'Unpaid Learner');
    await identity(pool, mentorContext, mentor, 'MENTOR', 'Test Mentor');
    await identity(
      pool,
      outsiderContext,
      unassigned,
      'MENTOR',
      'Unassigned Mentor',
    );
    await identity(pool, adminContext, admin, 'ADMIN', 'Test Administrator');
    await pool.query(
      `INSERT INTO "Course"(id,slug,title,description,track,status,"contentApprovedAt","contentSource","updatedAt") VALUES($1,$1,'Isolated Phase 4 learning course','Synthetic verification fixture, not real Nexora course content.','QA_SDET','PUBLISHED',now(),'Isolated test-only curriculum',now())`,
      [course],
    );
    await pool.query(
      `INSERT INTO "CurriculumModule"(id,"courseId","startWeek",title,summary,"weeklyTopics") VALUES($1,$2,1,'Learning foundations','A synthetic module for browser verification.',ARRAY['First topic','Second topic','Third topic','Fourth topic'])`,
      [`${prefix}module`, course],
    );
    await pool.query(
      `INSERT INTO "Cohort"(id,"courseId",name,"startsAt","endsAt",capacity,status) VALUES($1,$2,'Isolated learning cohort',now()-interval '7 days',now()+interval '180 days',10,'PUBLISHED')`,
      [cohort, course],
    );
    await pool.query(
      `INSERT INTO "Mentor"(id,"userId",expertise) VALUES($1,$2,ARRAY['Test mentoring'])`,
      [`${prefix}profile`, mentor],
    );
    await pool.query(
      'INSERT INTO "CohortMentor"("cohortId","mentorId") VALUES($1,$2)',
      [cohort, `${prefix}profile`],
    );
    await pool.query(
      `INSERT INTO "Enrollment"(id,"userId","cohortId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',now()),($4,$5,$3,'ACTIVE',now())`,
      [enrollment, student, cohort, unpaid, other],
    );
    // Isolated verified-payment fixture only; no remote payment or application bypass route exists.
    await pool.query(
      `INSERT INTO "Payment"(id,"enrollmentId","amountMinor",currency,status,provider,"providerRef","verifiedAt","idempotencyKey","updatedAt") VALUES($1,$2,10000,'INR','SUCCEEDED','razorpay',$3,now(),$1,now())`,
      [`${prefix}payment`, enrollment, `pay_${prefix}`],
    );
    const lessonBody = {
      version: 0,
      courseId: course,
      moduleId: `${prefix}module`,
      title: 'Understand a typed API',
      position: 1,
      kind: 'RESOURCE',
      content:
        'This isolated lesson explains typed requests and reliable validation. It is synthetic test material.',
      videoUrl: '',
      captionsUrl: '',
      resourceUrl: '',
      durationSeconds: 0,
      prerequisiteId: '',
      status: 'PUBLISHED',
    };
    const first = await post(adminContext, 'lesson', lessonBody),
      second = await post(adminContext, 'lesson', {
        ...lessonBody,
        title: 'Build on your first lesson',
        position: 2,
        prerequisiteId: first.id,
      }),
      draft = await post(adminContext, 'lesson', {
        ...lessonBody,
        title: 'Secret unpublished lesson',
        position: 3,
        status: 'DRAFT',
      });
    await post(mentorContext, 'assignment', {
      version: 0,
      cohortId: cohort,
      title: 'Explain your API decisions',
      instructions:
        'Describe your approach, include test evidence, and explain an edge case.',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'PUBLISHED',
      allowResubmit: true,
      rubric: [{ criterion: 'Reasoning', points: 100 }],
      resourceUrl: '',
    });
    const quiz = await post(mentorContext, 'quiz', {
      version: 0,
      cohortId: cohort,
      title: 'Typed API knowledge check',
      questions: [
        {
          prompt: 'Which assertion verifies equality?',
          options: ['expect(a).toBe(b)', 'console.log(a)'],
          correctIndex: 0,
        },
      ],
      passPercent: 70,
      maxAttempts: 1,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'PUBLISHED',
    });
    const live = await post(mentorContext, 'class', {
      version: 0,
      cohortId: cohort,
      title: 'API review workshop',
      description: 'A synthetic live class for isolated workflow testing.',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      meetingUrl: '',
      recordingUrl: '',
      status: 'SCHEDULED',
    });
    await post(mentorContext, 'announcement', {
      cohortId: cohort,
      title: 'Bring your API questions',
      body: 'Prepare one question about validation for the workshop.',
    });
    expect(
      (
        await otherContext.request.get(
          `/api/learning/lesson?enrollmentId=${enrollment}&id=${first.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await otherContext.request.get(
          `/api/learning/lesson?enrollmentId=${unpaid}&id=${first.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.get(
          `/api/learning/lesson?enrollmentId=${enrollment}&id=${draft.id}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await context.request.get(
          `/api/learning/lesson?enrollmentId=${enrollment}&id=${second.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await outsiderContext.request.get(`/api/learning/cohort?id=${cohort}`)
      ).status(),
    ).toBe(404);
    const blockedPage = await otherContext.newPage();
    await blockedPage.goto(`/learn/${unpaid}/${first.id}`);
    await expect(blockedPage).toHaveURL(/\/forbidden/);
    await blockedPage.close();
    const spoof = await context.request.post('/api/learning/progress', {
      headers,
      data: {
        enrollmentId: enrollment,
        lessonId: first.id,
        positionSeconds: 0,
        complete: true,
        percent: 100,
      },
    });
    expect(spoof.status()).toBe(422);
    const badOrigin = await context.request.post('/api/learning/progress', {
      headers: { origin: 'https://untrusted.example' },
      data: {
        enrollmentId: enrollment,
        lessonId: first.id,
        positionSeconds: 0,
        complete: true,
      },
    });
    expect(badOrigin.status()).toBe(403);
    await page.goto('/dashboard/student');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Test');
    await expect(page.getByText('Secret unpublished lesson')).not.toBeVisible();
    await page
      .getByRole('link', { name: 'Continue learning', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(first.id));
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Save learning progress' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Learning progress saved',
    );
    await page.goto('/dashboard/student');
    await expect(
      page.getByRole('link', { name: 'Continue learning', exact: true }),
    ).toHaveAttribute('href', `/learn/${enrollment}/${second.id}`);
    await expect(page.locator('progress')).toHaveAttribute('value', '50');
    if (info.project.name.includes('mobile')) {
      await page.getByText('Menu', { exact: true }).focus();
      await page.getByText('Menu', { exact: true }).press('Enter');
      await page
        .getByRole('navigation', { name: 'Mobile learning navigation' })
        .getByRole('link', { name: 'Assignments', exact: true })
        .click();
    } else
      await page
        .getByRole('navigation', { name: 'Learning navigation' })
        .getByRole('link', { name: 'Assignments', exact: true })
        .click();
    await page
      .getByLabel('Your work or explanation')
      .fill(
        'My typed API validates requests and tests the empty-input edge case.',
      );
    await page.getByRole('button', { name: 'Save assignment' }).click();
    await expect(page.getByLabel('Attach a resource')).toBeVisible();
    await page.reload();
    await page.getByLabel('Attach a resource').setInputFiles({
      name: 'evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Private assignment evidence'),
    });
    await page.getByRole('button', { name: 'Upload file' }).click();
    await expect(page.getByText('File stored privately.')).toBeVisible();
    const file = (
      await pool.query(
        'SELECT f.id FROM "LearningFile" f JOIN "Submission" s ON s.id=f."submissionId" WHERE s."userId"=$1',
        [student],
      )
    ).rows[0];
    expect(
      (
        await otherContext.request.get(`/api/learning/files/${file.id}`)
      ).status(),
    ).toBe(404);
    await page.getByLabel('Submission action').selectOption('submit');
    await page.getByRole('button', { name: 'Save assignment' }).click();
    await expect(
      page.locator('.learn-tag').filter({ hasText: 'SUBMITTED' }),
    ).toBeVisible();
    await page.reload();
    const mentorPage = await mentorContext.newPage();
    await mentorPage.goto(`/learning/assignments?cohort=${cohort}`);
    await mentorPage
      .getByText('Test Learner · Explain your API decisions · SUBMITTED', {
        exact: true,
      })
      .click();
    await mentorPage.getByLabel('Reasoning · out of 100').fill('85');
    await mentorPage
      .getByLabel('Actionable mentor feedback')
      .fill(
        'Clear reasoning. Add an explicit malformed-payload test next time.',
      );
    await mentorPage
      .getByRole('button', { name: 'Publish grade & feedback' })
      .click();
    await expect(
      mentorPage.locator('summary').filter({
        hasText: 'Test Learner · Explain your API decisions · GRADED',
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Grade: 85 / 100')).toBeVisible();
    await expect(page.getByText(/Clear reasoning/)).toBeVisible();
    await page.goto('/learning/assessments');
    await page.getByLabel('expect(a).toBe(b)', { exact: true }).check();
    await page.getByRole('button', { name: 'Submit assessment' }).click();
    await expect(page.getByText('1 / 1', { exact: false })).toBeVisible();
    expect(
      (
        await context.request.post('/api/learning/attempt', {
          headers,
          data: {
            enrollmentId: enrollment,
            assessmentId: quiz.id,
            version: 1,
            requestKey: randomUUID(),
            answers: [0],
          },
        })
      ).status(),
    ).toBe(409);
    await post(mentorContext, 'attendance', {
      classId: live.id,
      userId: student,
      status: 'PRESENT',
    });
    await page.goto('/learning/classes');
    await expect(
      page.getByText('API review workshop', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Attendance: PRESENT')).toBeVisible();
    await expect(page.locator('time')).toContainText('IST');
    await page.goto('/learning/support');
    await page
      .getByLabel('What do you need help with?')
      .fill('Help understanding API validation');
    await page
      .getByLabel('Describe the issue')
      .fill(
        'Could you help me understand schema validation for optional fields?',
      );
    await page.getByRole('button', { name: 'Create support ticket' }).click();
    await expect(page.getByRole('status')).toContainText('Ticket created');
    const ticket = (
      await pool.query('SELECT id FROM "SupportTicket" WHERE "userId"=$1', [
        student,
      ])
    ).rows[0];
    expect(
      (
        await otherContext.request.get(`/api/learning/ticket?id=${ticket.id}`)
      ).status(),
    ).toBe(404);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`/learning/support?ticket=${ticket.id}`);
    await adminPage
      .getByLabel('Your reply')
      .fill(
        'Start with a minimal valid request and test each optional field separately.',
      );
    await adminPage.getByLabel('Ticket status').selectOption('RESOLVED');
    await adminPage
      .getByRole('button', { name: 'Send support update' })
      .click();
    await expect(
      adminPage.locator('.learn-tag').filter({ hasText: /^RESOLVED$/ }),
    ).toBeVisible();
    await expect(
      adminPage.getByText(
        'Start with a minimal valid request and test each optional field separately.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.goto(`/learning/support?ticket=${ticket.id}`);
    await expect(page.getByText('RESOLVED', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Start with a minimal valid request/),
    ).toBeVisible();
    await mentorPage.goto(`/learning/cohorts?cohort=${cohort}`);
    await expect(
      mentorPage.getByRole('cell', { name: /Test Learner/ }),
    ).toBeVisible();
    await expect(
      mentorPage.getByRole('cell', { name: /Unpaid Learner/ }),
    ).not.toBeVisible();
    const classEditor = await mentorContext.newPage();
    await classEditor.goto(`/learning/classes?cohort=${cohort}`);
    const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await classEditor
      .getByLabel('Class title')
      .fill('Scheduled through mentor UI');
    await classEditor
      .getByLabel('Class description')
      .fill(
        'A real persisted class created through the mentor scheduling form.',
      );
    await classEditor.getByLabel('Starts at (IST)').fill(`${day}T09:00`);
    await classEditor.getByLabel('Ends at (IST)').fill(`${day}T10:00`);
    await classEditor
      .getByRole('button', { name: 'Save class schedule' })
      .click();
    await expect(classEditor.getByRole('status')).toContainText(
      'Saved successfully',
    );
    const savedClass = (
      await pool.query(
        `SELECT "startsAt" AT TIME ZONE 'UTC' AS "startsAt" FROM "LiveClass" WHERE "cohortId"=$1 AND title=$2`,
        [cohort, 'Scheduled through mentor UI'],
      )
    ).rows[0];
    expect(savedClass.startsAt.toISOString()).toBe(
      new Date(`${day}T09:00+05:30`).toISOString(),
    );
    await classEditor.close();
    await page.goto('/dashboard/student');
    for (const p of [page, mentorPage]) {
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
      await page.screenshot({
        path: `docs/previews/phase4-student-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
      await mentorPage.screenshot({
        path: `docs/previews/phase4-mentor-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
      await page.goto(`/learn/${enrollment}/${second.id}`);
      await page.screenshot({
        path: `docs/previews/phase4-lesson-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
        animations: 'disabled',
      });
    }
  } finally {
    await pool.query(
      'DELETE FROM "SupportTicket" WHERE "userId"=ANY($1::text[])',
      [users],
    );
    await pool.query('DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::text[])', [
      users,
    ]);
    await pool.query(
      'DELETE FROM "Submission" WHERE "userId"=ANY($1::text[])',
      [users],
    );
    await pool.query('DELETE FROM "Assignment" WHERE "cohortId"=$1', [cohort]);
    await pool.query(
      'DELETE FROM "AssessmentAttempt" WHERE "userId"=ANY($1::text[])',
      [users],
    );
    await pool.query('DELETE FROM "Assessment" WHERE "courseId"=$1', [course]);
    await pool.query(
      'UPDATE "Lesson" SET "prerequisiteId"=NULL WHERE "courseId"=$1',
      [course],
    );
    await pool.query('DELETE FROM "Lesson" WHERE "courseId"=$1', [course]);
    await pool.query(
      'DELETE FROM "Payment" WHERE "enrollmentId"=ANY($1::text[])',
      [[enrollment, unpaid]],
    );
    await pool.query('DELETE FROM "Enrollment" WHERE "cohortId"=$1', [cohort]);
    await pool.query('DELETE FROM "Cohort" WHERE id=$1', [cohort]);
    await pool.query('DELETE FROM "Course" WHERE id=$1', [course]);
    await pool.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [users]);
    await Promise.all([
      mentorContext.close(),
      otherContext.close(),
      adminContext.close(),
      outsiderContext.close(),
    ]);
    await pool.end();
  }
});
