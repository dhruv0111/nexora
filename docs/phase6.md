# Phase 6 — Career Center and employer hiring

NEXORA now separates admissions from recruitment: existing `Application` records retain their Phase 3 meaning, while `HiringApplication` records track employer opportunities. HireFlow remains a separate training product. No employer partnerships, jobs, offers, salaries or joining outcomes are seeded as real business activity.

## Architecture

`src/lib/career/` contains resource/tenant policies, profile/consent/resume handling, employer/job/application services, interview/mock scheduling, operations and bounded read/report models. Existing Auth.js sessions, serializable transactions, advisory locks, audit logging, form controls, file validation and Phase 5 portfolio approval checks are reused. There are no new dependencies.

Two additive migrations extend `Employer` and `Opportunity`, introduce career/hiring tables, and add a job discovery index. Existing records and admissions/payment enums are preserved. Legacy employers are deliberately not automatically VERIFIED. Recruitment contract/invoice CHECK constraints permit DRAFT only. Apply through `npm run db:migrate`; never reset an existing database.

| Route                                  | Purpose                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/career`                              | Personal readiness, applications, notifications, mock interviews and support                                           |
| `/career/profile`                      | Profile builder, immutable resume versions, consent controls and sharing history                                       |
| `/career/jobs` and `/career/jobs/[id]` | Moderated current openings, transparent match explanations and applications                                            |
| `/career/employer`                     | Registration, company profile/review, private documents, openings, authorized candidate discovery and company pipeline |
| `/career/candidates/[id]`              | Current authorized career DTO and approved training portfolios                                                         |
| `/career/applications/[id]`            | Status timeline, interview responses, feedback and separate offer/joining records                                      |
| `/career/admin`                        | Company verification, job moderation, readiness, recommendations, mocks, support, reports and commercial drafts        |
| `/career/public/[id]`                  | Optional deliberately minimal public profile, only while explicit PUBLIC visibility remains active                     |
| `/api/career/[action]`                 | Independent authenticated role/resource checks for each action; only `public` serves an explicit public DTO            |

Employer dashboard entry redirects into the real hiring workspace. Student/mentor learning navigation and admin overview link to Career Center. Loading, empty, error and saved states are provided. Job and candidate listings and administration use pages of 20. Personal dashboard lists show bounded recent records; they are not lifetime totals. Matching is explanatory and never an automatic rejection rule.

## Consent and security

A student can choose PRIVATE, EMPLOYERS or PUBLIC. The career-v1 notice distinguishes company-specific access, verified-employer directory discovery and optional account-email sharing. Applying explicitly grants the selected company access. Directory opt-in requires a separate seeking/discovery checkbox. A specific company revocation overrides directory opt-in. PRIVATE withdraws all grants and blocks future profile, resume and portfolio access. Previously downloaded copies cannot be recalled.

Recruiter access requires current database role, their own administratively VERIFIED company, an eligible paid active/completed enrollment, reviewed readiness, current profile consent and either directory opt-in or a current company grant. Employer IDs supplied by clients cannot change tenancy. Operational application states remain available after consent withdrawal, while profile, statement, resume and candidate interview details are redacted. Candidate-visible feedback is distinct from internal recruiter feedback. Candidates cannot shortlist themselves, verify offers or confirm joining.

Employer registration checks domain/email agreement, then records REGISTERED. Submission moves to PENDING_REVIEW. Only ADMIN may record VERIFIED/REJECTED/SUSPENDED with evidence references and rationale. This is a manual verification process: the application does not independently establish company legitimacy or email ownership. Recruiters must use a separate account; a learner with existing records cannot silently switch roles. Company identity changes require renewed review and remove published jobs from discovery.

Jobs require a verified company and separate administrative moderation before publication. Editing moderated content resets approval. Normalized tenant/title/location/type/work-mode keys prevent exact duplicate openings. Expired and archived jobs disappear from discovery and reject new applications; expiration is enforced at read/write time without an assumed scheduler. Administrative moderation does not by itself publish a draft.

All mutations validate input, recheck actor/resource permissions, apply origin/rate/body limits, and use audited serializable updates. Versioned updates reject stale submissions. Unique learner/job keys and per-learner locks prevent duplicate concurrent applications. Scheduling stores UTC instants, validates IANA zones, checks conflicts and displays IST by default. Rescheduling requires renewed candidate confirmation. Withdrawal, rejection, closure and verified joining cancel pending future interview slots while retaining their history. Mock interviews have separate records, assigned mentors and assessments.

Private company verification PDF/TXT files are limited to 2 MB and five active files, with bounded multipart reads, content validation, private storage and authorized attachment downloads (`no-store`, `nosniff`, sandbox). They are not exposed to students or other employers. Resume builder outputs versioned text; only the latest version is shared; retiring it never reinstates an older version. Retiring a file/resume erases its bytes/content while retaining metadata and audit. `CAREER_RETENTION_DAYS` defaults to 365 (30–3650); an explicit admin action erases older artifact contents. No background purge runs and hiring/consent history is not automatically deleted. Malware scanning and approved retention/legal policy remain launch requirements.

## Evidence, matching and readiness

Career sharing reuses Phase 5's current contribution approval, separate portfolio publication approval, PUBLISHED project and nonconfidential requirements. Employer/public DTOs further remove source URLs, evidence IDs, supervisor IDs and internal notes. Public sharing omits education, background, resume, contact information and work eligibility. Students must keep sensitive data out of fields they intentionally publish.

Skills and actual professional experience are labelled self-reported. Match reasons distinguish mentor-reviewed technologies in current approved portfolios from self-reported skill overlap, location/work-mode preferences, self-reported prerequisites/eligibility, completed enrollment, passed assessments and publication-approved training portfolios. No opaque AI score or automated rejection exists.

Readiness has an explicit 100-point rubric: passed assessments 20, COMPLETED paid enrollment 20, approved training portfolio 20, completed scored mock up to 20, staff-reviewed communication 10 and career preparation 10. It does not claim professional employment or guarantee placement. Assigned mentors/admins review eligibility and may override the total with a recorded reason. A reviewed readiness decision and verified paid enrollment are required to apply; graduation contributes to the rubric but is not silently invented from attendance.

Pipeline: DRAFT → APPLIED → SCREENING → SHORTLISTED → INTERVIEW → OFFERED → HIRED, with controlled REJECTED/WITHDRAWN/CLOSED branches. Offers require an actual reference/date and remain unverified until an admin records independent checks. Only a separate admin joining verification, after offer verification and with an actual nonfuture joining date, records HIRED. Every transition and verification is audited; stage movement cannot bypass offer/joining verification.

## Reporting and commercial boundaries

The report returns its exact `[from,to)` UTC period, as-of timestamp and definition with every result. Cohort/track populations use enrollments created in period. Graduation is the current COMPLETED state plus a verified unrefunded payment. Seekers require current paid active/completed enrollment, reviewed readiness and directory consent. Verified offers and starts count distinct paid learners in that enrollment population with independently verified event dates in period. Conversion numerator is confirmed starts; denominator is distinct verified paid learners enrolled in period, including later-cancelled enrollments. Zero denominator produces null, not a fabricated percentage. Learners may appear in multiple cohorts; group rates must not be summed into a global rate. Invitations count records created in period, including later cancellations. Partnership counts mean currently VERIFIED company records whose latest verification falls in period, not claims of signed hiring agreements. Up to 200 groups are shown.

ENROLLED and GRADUATED are enrollment facts, SEEKING_EMPLOYMENT is current consent/preferences/readiness, INTERVIEWED is an interview record, OFFERED is an offer record and JOINED is separately verified actual joining. These are not combined into a single placement success statistic. Self-reported compensation is never aggregated into marketing salary statistics.

Recruitment agreement drafts support fixed minor-unit fees or percentage basis points, replacement/refund windows and draft invoice records. Billing activation, payment collection, automated invoices and student placement success fees are absent. Phase 7's full finance/operations suite is outside this phase.

## Setup and verification

Use the repository's existing setup and PostgreSQL/Auth.js configuration. Add `CAREER_RETENTION_DAYS=365` if a different reviewed retention window is needed. No calendar/email API keys are requested: those adapters are not connected, and all notifications are explicitly in-app. Manual meeting URLs are supported without pretending that a calendar invitation was delivered.

```sh
npm run db:migrate
npm run db:generate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run test:db
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 CAPTURE_PREVIEWS=1 npm run test:e2e -- --workers=4
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Fixtures are synthetic and isolated; tests must never target production. Browser verification owns port 3100 and does not stop the user's server on port 3000. The two recent Phase 5 edits (preview capture in `tests/e2e/phase5.spec.ts` and `docs/phase5.md`) are included in regression/static verification. The production build, strict TypeScript, ESLint, formatting, 60 unit tests and 63 PostgreSQL tests passed. Eight migrations were applied to the isolated database and the database-to-schema diff was empty. The full browser run passed all 105 Phase 1–5 regressions. Two Phase 6 assertions waited for a transient notice after the saved form disappeared. After switching to persistent state checks and rebuilding, all five Phase 6 viewport journeys passed (375, 390, 768, 1440 and 1920 px). Automated accessibility and overflow checks passed on the tested hiring screens.

Each viewport exercised graduate profile creation and opt-in, manual employer verification, moderated job publication, application and interview confirmation, separate offer and joining verification, and consent revocation followed by rejected recruiter profile/resume requests. The journey used isolated records and real database sessions.

| Preview                  | Desktop                                          | Mobile                                         |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| Student Career Center    | [Desktop](previews/phase6-student-desktop.png)   | [Mobile](previews/phase6-student-mobile.png)   |
| Employer workspace       | [Desktop](previews/phase6-employer-desktop.png)  | [Mobile](previews/phase6-employer-mobile.png)  |
| Authorized candidate     | [Desktop](previews/phase6-candidate-desktop.png) | [Mobile](previews/phase6-candidate-mobile.png) |
| Placement administration | [Desktop](previews/phase6-admin-desktop.png)     | [Mobile](previews/phase6-admin-mobile.png)     |

## Carry-forward blockers

Approved curricula/prerequisites, fees/cohorts and commercial/legal/privacy/retention terms remain outstanding. Real Razorpay and GitHub provider verification remain unperformed; production payments remain disabled. Real media, calendar/email configuration, production database/hosting/secrets, backups, malware scanning and operational monitoring remain launch work. No external deployment is performed.

The previous local mobile homepage measurement remains **2.76 s LCP**, target **≤2.5 s**; no Phase 6 fix or new measurement is claimed. Route-scoped career CSS and reused lightweight forms add no animation or dependency to the marketing bundle. Manual screen-reader and additional-browser audits remain outstanding.
