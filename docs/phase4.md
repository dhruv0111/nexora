# Phase 4 — Student LMS and mentor experience

The existing repository now has database-backed student learning, cohort-scoped mentor tools, admin content management and private support. Public marketing, admissions, payment state machines and the original style-guide previews are preserved. No new dependencies or production secrets were added.

## Routes and architecture

| Route                                                | Purpose                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/student`                                 | Personalized enrollments, real progress, roadmap, classes, tasks, feedback, assessment results, project memberships, updates and support |
| `/dashboard/mentor`, `/learning/cohorts`             | Assigned cohorts and paginated student progress/risk indicators                                                                          |
| `/learn/[enrollmentId]`                              | Published lesson search, module milestones and next lesson                                                                               |
| `/learn/[enrollmentId]/[lessonId]`                   | Authorized lesson content, video/captions/resources, completion and resume position                                                      |
| `/learning/classes`                                  | Cohort agenda/calendar, class links, recording availability and attendance                                                               |
| `/learning/assignments`                              | Student draft/submission/files/feedback; mentor authoring, review and grading                                                            |
| `/learning/assessments`                              | Published quizzes, server scoring, attempt limits and results; staff authoring                                                           |
| `/learning/announcements`, `/learning/history`       | Cohort updates, private notifications and persisted learning activity                                                                    |
| `/learning/support`                                  | Owner-private conversations, categories, priorities and support-admin resolution                                                         |
| `/dashboard/admin/learning`                          | Learning administration entry point                                                                                                      |
| `/learning/content`, `/learning/instructors`         | Admin lesson publishing/order/prerequisites and existing mentor assignment                                                               |
| `/api/learning/[action]`, `/api/learning/files/[id]` | Independently authorized reads/mutations and private downloads                                                                           |

`src/lib/learning/` separates access policy, content, tasks/quizzes, schedules/support, private files and bounded read models. `src/components/learning/` contains the responsive sidebar shell, dashboards, lesson controls, accessible authoring forms and route sections. Learning CSS is route-scoped and does not add an LMS bundle to the marketing homepage.

## Database and migration review

The two new migrations are additive: [learning platform](../prisma/migrations/20261120120000_learning_platform/migration.sql) and [captions](../prisma/migrations/20261120123000_lesson_captions/migration.sql). They extend existing Lesson, Assignment, Submission, Assessment and AssessmentAttempt records and add progress, lesson/submission revisions, live classes, attendance, private files, announcements, notifications and support conversations. Existing rows receive conservative defaults; legacy task rows remain draft until explicitly reviewed/published. No table or column is dropped and no records are deleted by these migrations. Assignment.projectId becomes nullable so a learning task need not invent an Agile project. Its existing foreign key/unique key remain.

The Phase 3 course editor now upserts modules by course/start week instead of deleting/recreating them. This preserves lesson foreign keys and learning history. A database test verifies that continuity. SQL checks constrain statuses, schedules, attempts, file lengths and sizes; indexes cover learning access and cohort/deadline queries. Both migrations were applied only to the isolated verification database, not a production database.

## Access, calculations and workflows

- **Paid access:** student ownership plus ACTIVE enrollment, SUCCEEDED payment with verifiedAt/captured provider reference and zero refunded amount, published cohort and approved published course. Every lesson/progress/submission/quiz/file action rechecks access on the server. No public waiver, test login, fake-payment callback or manual “mark paid” route was introduced. Existing payment gates remain unchanged. COMPLETED or financial-review enrollments are not silently granted new access.
- **Mentors:** actual mentor-role profile and CohortMentor assignment required on reads and mutations. Unassigned cohorts return 404. Students cannot call staff authoring/grading/attendance actions. Support conversation access is limited to the student owner and ADMIN support staff; cohort mentors do not automatically gain access to private tickets.
- **Continue learning:** earliest published, incomplete lesson by course ordering whose prerequisite is completed and still published. If all are complete, the course remains available for review. Draft lesson content is not sent to students.
- **Progress:** completed published lesson IDs divided by all published lessons in that course, rounded down. Hidden/draft lessons are excluded. Completion and resume seconds persist in LessonProgress; completion retries do not create extra rows/audits. Completed acknowledgements are retained when saving a new resume position. Percentages, grades and completion timestamps are not accepted from clients. Video position is saved through the lesson controls and bounded by authored duration; completion acknowledges learning, not verified watch time or mastery. Module completion requires all its published lessons; empty modules do not earn a milestone.
- **Other learning measures:** submitted/graded assignments, assessment scores/passes and recorded attendance are separate persisted measures, not an invented composite career-readiness score. Project participation reads actual existing PodMember records; no Agile engine was added.
- **Assignments:** drafts may be edited before the deadline. Final submissions are immutable until graded and explicitly permitted for resubmission, still before the deadline. Identical final retries are idempotent. Server rubric bounds determine the grade. Earlier submission/feedback snapshots and grading audits are retained. Uploaded files are part of the saved draft and cannot be changed after submission.
- **Quizzes:** server-stored correct answers are omitted from student props. Strict input accepts answers, a content version and a unique request key; the server calculates score/pass, checks UTC deadline and serialized attempt limits. Exact retries reuse the result. An assessment with attempts cannot be rewritten; staff create a new assessment to change its scoring content.
- **Classes:** timestamps are UTC; display and staff scheduling inputs use Asia/Kolkata (IST). Schedules support rescheduled/cancelled/completed states and genuine operator-provided HTTPS links. Attendance requires a noncancelled class that has started and a verified active learner in that cohort. Schedule changes, announcements, grades and support replies generate persistent in-app notifications. Email delivery, external conferencing APIs and timed push reminders are not connected; upcoming classes provide the dashboard reminder.
- **Support:** unique creation keys, versioned replies, assignment to existing ADMIN users, open/in-progress/resolved states and student reopening. Messages are paginated and rendered as escaped text. High-priority technical/learning tickets provide the escalation path; no response-time guarantee is invented.

The UI uses 20-record operational pages and bounded dashboard summaries. Courses support up to 500 authored lessons. Cohort risk indicators use the displayed learner page, up to the 100 most recent published assignments, and bounded activity windows: an overdue unsubmitted task or no completed-lesson activity for seven days after cohort start. These are support indicators within that review window, not a complete academic/placement assessment. Larger deployments should add reporting aggregates beyond these bounded operational views.

## Private file handling

Permitted uploads are UTF-8 TXT and PDF, 1 byte–2 MB each, at most three files per submission. The request stream is bounded before multipart parsing; filename/type/content signatures and quota are validated. Bytes, hash and metadata are stored in PostgreSQL, not a public directory. Downloads reauthorize the owner’s current enrollment or assigned staff, use attachment/octet-stream, no-store, nosniff and a restrictive sandbox policy. Files are never rendered inline.

This storage adapter works locally without external credentials. It does **not** claim malware scanning: PDF signature checks do not establish that a PDF is harmless. Production operations still need approved retention/deletion, database backups/encryption, appropriate scanner integration and storage capacity planning or a reviewed private object-store adapter. Video/caption/resource links must point to genuine operator-configured media; provider privacy, signed-link expiry and CORS/caption delivery require that provider’s setup. No fabricated video/meeting URL was seeded into application data.

## Setup and operation

Use the root README’s PostgreSQL/Auth.js configuration and the same canonical hostname for browser origin and OAuth callback. Then:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

The existing seed still inserts only missing illustrative course drafts; it creates no student progress, grades, classes, paid enrollments or LMS content. Operators publish approved course content through admissions administration, create real cohorts, assign real mentor profiles, and author/publish lessons/tasks/assessments. An actual verified paid enrollment is required for student learning. Privileged roles/profiles require the trusted operator process; public registration cannot grant them. New learning functionality needs no new secret variables. Keep Razorpay disabled until genuine sandbox keys and external checks are supplied; live payments remain unsupported.

The reused API layer enforces fresh database-session roles, canonical-origin checks, strict Zod bodies, bounded streams, persistent per-user rate limits and private/no-store responses. Serializable transactions use bounded backoff for recognized PostgreSQL/Prisma write conflicts, including adapter commit conflicts. Validation, syntax and arbitrary errors are not retried. Logs contain sanitized event/error codes, not raw exceptions, names, messages or file bodies.

## Verification

Verification results and preview artifacts are recorded below. Test data is synthetic and isolated; it is not commercial curriculum or evidence of a real remote payment. Browser authentication uses direct isolated database sessions, not a production bypass. External GitHub consent, genuine media/conferencing delivery and actual Razorpay sandbox capture/webhook delivery remain unverified without operator configuration.

## Acceptance evidence — 20 November 2026

| Requested feature | Verified behavior                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student dashboard | Real owned enrollments, completion rows, deadlines, feedback, results and updates; empty data stays empty                                          |
| Continue learning | First incomplete eligible published lesson; browser check moves from lesson 1 to lesson 2 after completion                                         |
| Progress          | Persisted completion produces 1/2 = 50%; duplicate completion is harmless; client percent/score fields rejected; resume seconds persist separately |
| Live classes      | Cohort schedule and attendance persist; an actual mentor form entry of 09:00 IST is checked against 03:30 UTC storage                              |
| Assignments       | Draft, private upload, submission, rubric grade, visible feedback and permitted resubmission verified                                              |
| Mentor dashboard  | Only assigned cohorts and their eligible students; unrelated mentor requests return 404                                                            |
| Course access     | Unpaid and cross-user lesson requests return 403; unpublished lesson returns 404; blocked page uses the existing forbidden screen                  |
| Mobile UX         | Five widths, keyboard menu operation, no document overflow, and readable roster tables in focusable horizontal-scroll regions                      |
| Security          | Cross-user file/ticket requests rejected; origin checks, deadlines, attempt limits, rubric bounds and server scoring exercised                     |

The full Phase 1–4 regression run passed **100 browser tests with zero skips**. After the final scoped learning/UX changes, all five Phase 4 journeys were rerun on the final production build. Unit/component/security verification passed **55 tests**; real PostgreSQL integration verification passed **31 tests**. Strict TypeScript, ESLint without warnings, formatting and the production build passed. All five migrations are applied to the isolated database, and Prisma reports no schema difference.

The first browser passes found and corrected a focusability issue for scrolling tables and a missing adapter-level serialization-conflict retry. The scheduling test now interprets PostgreSQL timestamps explicitly as UTC, and final-state assertions wait for persisted submissions/grades/support replies rather than brief component messages. No failing scenario was skipped to obtain a passing result. Axe reports no A/AA violations in the tested student dashboard, mentor roster and existing public/auth/course/checkout surfaces. This is not a manual screen-reader or multi-browser certification.

To reproduce:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run test:db
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 CAPTURE_PREVIEWS=1 npm run test:e2e -- --workers=4
```

Use an isolated database whose name includes `nexora_phase1`, apply migrations first, and never run fixture tests against production. Tests create and remove their synthetic records. Playwright owns port 3100; the user's server on 3000 is not stopped.

## Responsive previews

| Screen           | Desktop                                        | Mobile                                        |
| ---------------- | ---------------------------------------------- | --------------------------------------------- |
| Student overview | [Preview](previews/phase4-student-desktop.png) | [Preview](previews/phase4-student-mobile.png) |
| Mentor progress  | [Preview](previews/phase4-mentor-desktop.png)  | [Preview](previews/phase4-mentor-mobile.png)  |
| Lesson workspace | [Preview](previews/phase4-lesson-desktop.png)  | [Preview](previews/phase4-lesson-mobile.png)  |

These screenshots use clearly labeled isolated records, including a synthetic verified-payment fixture; they do not claim a real Razorpay payment or approved Nexora curriculum. The test records are removed after capture. Local production screenshots were visually inspected alongside automated checks.

## Remaining blockers and Phase 5 readiness

Approved commercial curricula/prerequisites, fees/dates and formal privacy/retention/enrollment/refund terms are still required. Genuine GitHub consent, Razorpay capture/webhook delivery, media/captions, conferencing and email delivery need real operator configuration and external verification. Production payments remain disabled. Deployment secrets, hosting, backups, file scanning/retention and appropriate operational monitoring are not supplied or launch-approved.

The student/mentor learning foundation is ready for separately scoped Phase 5 Agile project work. The full pod engine and placement portal were not implemented. Local workflow verification does not make external integrations or production enrollment ready.

## Performance carry-forward

Final production-build Lighthouse 13.6.0 spot check: **94 performance, 100 accessibility, 2.76 s LCP, CLS 0, TBT 161 ms**. The ≤2.5 s LCP target remains open; no improvement over the Phase 3 2.76 s median is claimed. The existing investigation identified the hero image and rendering/main-thread delay, with image discovery/high priority already passing and no network-font dependency. Phase 4 keeps the existing targeted image/motion changes and loads learning styles/client controls only on learning routes.

This single check used Chrome 157 headless on macOS, local production server at 127.0.0.1:3100, default simulated mobile profile (412×823, DPR 1.75, 4× CPU slowdown, 150 ms RTT, 1,638.4 Kbps). Browser tests had finished; the Next image cache was retained, and Lighthouse used its default fresh browser profile/storage. It is not a deployed/CDN or real-device measurement and does not measure field INP. Further profiling on the selected production host remains necessary. No unrelated marketing redesign was performed to chase a lab score.

[HTML report](performance/phase4-mobile.report.html) · [JSON report](performance/phase4-mobile.report.json) · [Summary](performance/phase4-summary.json).
