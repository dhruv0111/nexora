import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const courses = JSON.parse(
    await readFile(new URL('./draft-courses.json', import.meta.url), 'utf8'),
  );
  for (const c of courses) {
    await client.query('BEGIN');
    try {
      const { rows } = await client.query(
        `INSERT INTO "Course" (id,slug,title,description,track,status,"previewVisible","durationWeeks","deliveryFormat",audience,prerequisites,skills,technologies,"assessmentRequired","updatedAt") VALUES ($1,$2,$3,$4,$5::"Track",'DRAFT',true,24,$6,$7,$8,$9,$10,$11,now()) ON CONFLICT (slug) DO NOTHING RETURNING id`,
        [
          randomUUID(),
          c.slug,
          c.title,
          c.description,
          c.track,
          c.deliveryFormat,
          c.audience,
          c.prerequisites,
          c.skills,
          c.technologies,
          c.assessmentRequired,
        ],
      );
      if (rows[0])
        for (const m of c.modules)
          await client.query(
            `INSERT INTO "CurriculumModule" (id,"courseId","startWeek",title,summary,"weeklyTopics") VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              randomUUID(),
              rows[0].id,
              m.startWeek,
              m.title,
              m.summary,
              m.weeklyTopics,
            ],
          );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  console.log(
    'Draft catalog ensured. Existing records were not overwritten; no prices, dates, or approvals were invented.',
  );
} finally {
  client.release();
  await pool.end();
}
