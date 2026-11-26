# Phase 3 — Courses, admissions and sandbox checkout

## Delivery and content status

Four responsive course pages and a searchable catalog extend the existing public design. Application drafts, submission, human admissions review, cohort administration, fee review, agreement snapshots and payment reconciliation use PostgreSQL. The existing inquiry flow and role workspaces remain available. The learning platform remains a shell; lessons, Agile delivery and the employer portal are outside this phase.

**Content is not business-approved.** The user will supply source details. The four authored 24-week outlines, prerequisites and delivery descriptions are visibly illustrative drafts. AI Engineering explicitly requires Python, algebra/API readiness and human assessment. No approved fee, cohort date, instructor, legal policy or partnership is invented. Publication, acceptance and checkout have independent server-side approval gates. Source approval is an authorized operator attestation, not automatic verification of a document's accuracy.

## Architecture and data

- `src/lib/catalog/`: bounded database reads, offline illustrative previews, validated admin updates and revision history.
- `src/lib/admissions/`: bounded applicant/profile DTOs, draft resume, optimistic versions, final validation, consent and review transitions.
- `src/lib/payments/`: test-only Razorpay adapter, signatures, transactional eligibility/capacity checks, order reuse, verification and reconciliation.
- `src/lib/domain/`: server session/role guards, canonical-origin checks, streamed body limits, database rate buckets, safe responses, serializable retries and audit helpers.
- `src/components/courses/`, `admissions/`, `checkout/`, `admin/`: reusable route compositions. `src/styles/courses.css` is loaded by new routes; existing homepage critical CSS is preserved.

The additive [migration](../prisma/migrations/20261119220000_admissions_checkout/migration.sql) extends the [schema](../prisma/schema.prisma): curriculum modules, instructors, applicant profiles, application consent/review/version data, enrollment agreement/fee snapshots, payment order state and refunds, durable normalized payment events, course revisions, audit records and action rate buckets. Existing records are preserved. SQL checks constrain weeks, amounts and refund bounds; unique keys prevent duplicate applications, enrollments and provider identities. The seed inserts only missing draft courses and never overwrites existing courses.

## Routes

| Route                                  | Behavior                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/programs`, `/programs/[slug]`        | Search/filter/compare and six modules covering 24 weeks per track                           |
| `/apply/[slug]`                        | Student-only, resumable three-step application                                              |
| `/applications`, `/applications/[id]`  | Student's own records, review feedback and history                                          |
| `/checkout/[applicationId]`            | Accepted owner's approved fee/cohort/terms review; disabled without configuration           |
| `/enrollments/[id]`                    | Owner's actual pending/paid/review/refund-related status                                    |
| `/dashboard/admin/admissions?view=...` | Admin-only applications, courses, cohorts, enrollments, payments, inquiries and audit views |
| `/dashboard/admin/courses/[id]`        | Versioned course/fee/terms/instructor editor                                                |
| `/api/application-records/[id]`        | Owner-only private record; another student's ID returns 404                                 |
| `/api/enrollments/[id]/access`         | Requires ownership, ACTIVE enrollment and verified captured payment                         |

Every mutation handler independently authorizes its role and validates a strict DTO. Student records are owner-scoped, including API reads. Next.js can stream an HTML not-found page with HTTP 200; the private JSON record endpoint returns explicit 404. Mutations require the configured canonical origin; Auth.js retains its OAuth state/CSRF handling. Webhooks use provider authentication rather than browser origin checks. Redirects are restricted to recognized internal paths. Per-user sensitive-action limits persist in PostgreSQL; public webhook edge traffic limits remain a hosting concern.

## Setup and operator workflow

Follow the root README for Node, PostgreSQL and GitHub OAuth. Then:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Set the same hostname consistently in `NEXTAUTH_URL`, `INQUIRY_ORIGIN`, the browser and GitHub callback. All secrets are server-only and belong in ignored environment files or a secret store. The first privileged admin is assigned by a trusted operator through the existing secured database process, never public registration.

1. Supply approved curriculum/prerequisites/delivery source references, fees and enrollment/refund terms. Edit each seeded draft in the admin UI, approve the relevant sections and publish. Changes invalidate affected approvals; old content is retained in CourseRevision.
2. Create actual dated cohorts with capacity and admissions status. Assign only existing mentor-role profiles. Do not use synthetic test fixtures as business content.
3. Students save/submit applications with consent. Admins review them before acceptance. AI technical readiness must be marked passed by an authorized reviewer. Acceptance records the reviewed course content version.
4. Checkout validates that version, published/approved content, fee/terms versions, dated cohort and available capacity. It reserves a seat for 15 minutes and snapshots the agreed fee, terms and refund disclosure.

## Sandbox configuration and payment behavior

Default `RAZORPAY_MODE=disabled`. To test with a real Razorpay test account, configure **all** of:

```dotenv
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_YOUR_REAL_TEST_KEY
RAZORPAY_KEY_SECRET=YOUR_REAL_TEST_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_INDEPENDENT_WEBHOOK_SECRET
```

Restart the server. Configure a reachable HTTPS webhook at `/api/payments/webhook` for `payment.captured`, `payment.failed`, `order.paid`, and `refund.processed`, using the matching webhook secret. A real HTTPS test deployment/tunnel and genuine provider keys are necessary for external delivery. Enable/verify capture behavior in the provider test account. Browser card data stays inside Razorpay hosted checkout; Nexora stores no card number or CVV. Live key prefixes and live mode are rejected; production activation requires a later reviewed implementation/configuration step.

Server prices determine each real provider order. One durable order attempt is permitted per enrollment. A timeout leaves an UNKNOWN state; recovery searches the provider using the stored receipt and never blindly creates a second order. The owner or admin can reconcile an existing payment. A valid client signature alone grants no access: the server fetches payment and order, validates identity/receipt/amount/currency, and requires captured payment and fully paid order before transactional activation. Payment capture with lost capacity, changed course content or withdrawn eligibility enters REVIEW_REQUIRED and grants no access.

Webhook verification hashes the **exact raw bytes** before parsing. Unique provider event IDs plus payload hashes protect retries/collisions. Normalized identifiers and processing state are durable; raw webhook PII is not retained. Duplicate and out-of-order failed events cannot downgrade paid records. Provider refunds revoke access or require review; there is no refund-creation API, installment plan or financing integration. A pending enrollment with no payment attempt may be cancelled by admin; financial exceptions require an operator to reconcile with the provider.

The adapter follows [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/), [order API documentation](https://github.com/razorpay/markdown-docs/blob/master/api/orders/create.md), [receipt lookup](https://github.com/razorpay/markdown-docs/blob/master/api/orders/fetch-all.md) and [payment webhook documentation](https://github.com/razorpay/markdown-docs/blob/master/webhooks/payments.md).

**External payment verification remains blocked:** no real Razorpay credentials were supplied. Database contract tests inject isolated provider response fixtures only within the test process; they do not create remote orders, collect money, prove hosted checkout callbacks or verify actual webhook delivery. Before enabling sandbox enrollment, exercise real order creation, capture, invalid signatures, duplicate delivery, interruption/reconciliation and provider-side refund events. Production payments remain disabled pending approval and operational configuration.

## Verification and acceptance

Use an isolated database named `nexora_phase1` for destructive test fixtures; never production. Browser tests create direct database sessions only inside that isolated harness. No test sign-in route or runtime gateway bypass exists.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run test:db
npm run build
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 CAPTURE_PREVIEWS=1 npm run test:e2e -- --workers=4
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npx prisma migrate status
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Browser tests own port 3100 and leave port 3000 available. Five widths are checked: 375, 390, 768, 1440 and 1920 px. The three prior navigation skips were desktop/wide/tablet instances of a mobile-only assertion; it now checks the correct navigation for each width, including tablet, without skipping those cases. Axe covers WCAG A/AA checks; manual assistive technology and additional browsers remain launch work.

| Acceptance item                           | Status                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Four accessible course routes             | Implemented; responsive browser verification                                         |
| Accurate approved curricula/prerequisites | **Pending user sources**; authored drafts are visibly illustrative                   |
| Application workflow                      | Implemented through human admissions review and fee review                           |
| Enrollment authorization/capacity         | Server-enforced; PostgreSQL integration coverage                                     |
| Payment and webhook security              | Implemented; local contract coverage; **external sandbox pending keys**              |
| Duplicate payment protection              | Database constraints, single order attempt, receipt recovery and event deduplication |
| Mobile experience and existing dashboards | Responsive and role/session regression coverage                                      |
| LCP investigation                         | See measured performance below                                                       |
| Production payment activation             | Deferred; deliberately disabled                                                      |

Final command counts, screenshots and performance measurements are recorded below after verification.

### Final results — 20 November 2026

| Check                                  | Result                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Strict TypeScript, ESLint, Prettier    | Passed                                                                         |
| Production build                       | Passed, Next.js 16.4.6 / Webpack                                               |
| Unit/component/security tests          | 42 passed                                                                      |
| PostgreSQL integration tests           | 18 passed, including payment-contract fixtures and changed-content eligibility |
| Migrations                             | All three applied; database-to-schema diff reports no difference               |
| Full browser regression                | 95 passed, zero skipped, five viewport sizes                                   |
| Automated accessibility                | No axe violations on tested public/auth/catalog/course/checkout pages          |
| Real GitHub consent / Razorpay sandbox | Not run; genuine external credentials absent                                   |

The final provider adapter/eligibility changes were followed by the 18-test database suite and a fresh production build; the desktop/mobile Phase 3 cases were then rerun against that build. Existing role sessions, revocation, immediate role changes, inquiry persistence and public routes passed the full regression suite.

### Mobile LCP investigation

The measured LCP element is `img.hero-art` inside `.cinema-image`. The initial HTML already discovers/preloads it with high fetch priority; the image discovery audit passes. System fonts avoid font downloads. The profile identifies remaining rendering/main-thread delay rather than a missing image request. Targeted changes keep the existing illustration and layout: synchronous hero decoding, GSAP/ScrollTrigger imports on first scroll instead of during initial idle hydration, desktop-only hero parallax, and transform-only CSS headline entrances that honor reduced motion. No readable content is hidden by motion.

Three sequential Lighthouse 13.6.0 runs used the final production server on 127.0.0.1:3100, Chrome 157 headless on macOS, default simulated Moto G Power mobile profile (412×823, DPR 1.75, 4× CPU slowdown, 150 ms RTT, 1,638.4 Kbps). Browser tests were stopped; fresh Lighthouse browser profiles/storage were used, with the server's Next image cache retained. These are local laboratory results, not deployed/CDN or field INP measurements.

| Run | Performance | Accessibility | LCP    | CLS | TBT    |
| --- | ----------- | ------------- | ------ | --- | ------ |
| 1   | 96          | 100           | 2.67 s | 0   | 115 ms |
| 2   | 92          | 100           | 2.97 s | 0   | 180 ms |
| 3   | 94          | 100           | 2.76 s | 0   | 152 ms |

**Median LCP 2.76 s; the ≤2.5 s target remains unmet.** The prior Phase 2 single run was 2.74 s, so these measurements do not establish an LCP improvement. Performance stayed above 90 and CLS stayed zero in all three runs. The first trace's observed (unthrottled) LCP breakdown was approximately 52 ms TTFB, 32 ms resource delay, 67 ms transfer and 471 ms element render delay; those observed subparts must not be added to explain the simulated 2.67 s total. Framework hydration/render work remains a follow-up for the selected production host; no unsupported target-pass claim is made.

[Machine-readable summary](performance/phase3-summary.json) · [Run 1](performance/phase3-mobile-1.report.html) · [Run 2](performance/phase3-mobile-2.report.html) · [Run 3](performance/phase3-mobile-3.report.html). JSON reports use the same basenames. Repeat with the running production server, once per run and without concurrent browser tests:

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm exec --yes --package=lighthouse -- lighthouse http://127.0.0.1:3100 --only-categories=performance,accessibility --chrome-flags='--headless --no-sandbox' --output=json --output=html --output-path=docs/performance/phase3-mobile-repeat --quiet
```

### Preview artifacts

| Experience        | Desktop                                            | Mobile                                            |
| ----------------- | -------------------------------------------------- | ------------------------------------------------- |
| Catalog           | [Preview](previews/phase3-catalog-desktop.png)     | [Preview](previews/phase3-catalog-mobile.png)     |
| AI course         | [Preview](previews/phase3-course-desktop.png)      | [Preview](previews/phase3-course-mobile.png)      |
| Application       | [Preview](previews/phase3-application-desktop.png) | [Preview](previews/phase3-application-mobile.png) |
| Disabled checkout | [Preview](previews/phase3-checkout-desktop.png)    | [Preview](previews/phase3-checkout-mobile.png)    |
| Admin admissions  | [Preview](previews/phase3-admin-desktop.png)       | [Preview](previews/phase3-admin-mobile.png)       |

Application/admin/checkout screenshots use clearly identified synthetic isolated test records. Their fee and terms are fixtures, not approved Nexora offers. Fixtures are removed after testing. The catalog/course screenshots show the actual seeded illustrative drafts.

### Limits and Phase 4 readiness

Approved content, pricing, dates, formal privacy/retention/enrollment/refund terms and genuine OAuth/payment credentials remain operator dependencies. Real sandbox capture/webhook delivery and refunds still require external verification. Live payments, refund initiation, financing, installments, email notifications and full LMS workflows are not enabled. Review-required financial exceptions need provider reconciliation and an authorized operator; no unsafe manual “mark paid” action is exposed. Manual screen-reader/cross-browser and deployment-edge abuse controls remain launch checks. LCP needs further work to meet 2.5 s.

The versioned course/admissions/enrollment foundation is ready for a separately scoped learning phase; production enrollment is not launch-approved. No deployment was performed and no real payment was taken.
