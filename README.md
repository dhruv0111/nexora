# Nexora — Phase 6

A cinematic Train-to-Hire platform with admissions, secure enrollment, a student LMS, mentor tools and a supervised Agile project delivery engine. [Phase 6 setup/security/verification](docs/phase6.md) · [Phase 5 report](docs/phase5.md) · [Phase 4 report](docs/phase4.md) · [Phase 3 payment report](docs/phase3.md).

Curriculum outlines are illustrative drafts awaiting the user's approved sources. No actual fees, dates, instructors or legal terms are invented. Production payments remain disabled.

## Local setup

Use Node 24 LTS (minimum 22.12), npm, and PostgreSQL 16 or newer.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL to an existing, empty PostgreSQL database.
# Generate independent NEXTAUTH_SECRET and LEAD_FORM_SECRET values with: openssl rand -base64 32
# Set INQUIRY_ORIGIN to the exact browser origin (for example http://localhost:3000).
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:3000/programs` or `/style-guide`. Use the same hostname as your configured canonical origin. Public previews work without credentials. Database commands require a reachable PostgreSQL database. Do not use the example database password in production.

For OAuth, register a GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github`, set `GITHUB_ID`, `GITHUB_SECRET`, a 32+ character `NEXTAUTH_SECRET`, and `NEXTAUTH_URL=http://localhost:3000`, then use that hostname consistently. Production requires HTTPS, its matching callback URL, and securely stored environment variables. Restart the server after changing environment configuration. Never expose secrets through `NEXT_PUBLIC_*` or commit `.env`.

No test account or sign-in bypass is installed. New GitHub accounts receive `STUDENT`; `VISITOR` means an unauthenticated request. Privileged roles require a trusted operator to update the user record through a secured administrative process. No public role mutation endpoint exists.

## Structure

```text
src/app/                 App Router routes, layouts and route boundaries
  (public)/              Public navigation, program previews and auth shells
  dashboard/[role]/      Server-authorized role workspace shells
  api/auth/              Auth.js endpoint, fail-closed when unconfigured
src/components/ui/       shadcn-compatible source primitives (Radix Slot + CVA)
src/components/layout/   Brand, navigation, footer and containers
src/components/auth/     Authentication actions
src/components/          Course cards, style guide and workspace composition
src/config/              Typed course previews and design tokens
src/lib/                 Environment, Prisma, authorization and domain services
src/types/               Auth.js session type augmentation
prisma/                  PostgreSQL schema and committed additive SQL migrations
tests/                   Unit, database integration and browser verification
```

## Routes and behavior

| Route                                                      | Purpose                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `/`                                                        | Cinematic homepage and persistent inquiry flow           |
| `/style-guide`                                             | Component showcase and public role-shell previews        |
| `/programs`, `/programs/[slug]`                            | Searchable catalog and detailed draft curricula          |
| `/apply/[slug]`, `/applications`                           | Student applications, draft resume and status            |
| `/checkout/[applicationId]`, `/enrollments/[id]`           | Fee review and verified enrollment status                |
| `/dashboard/admin/admissions`                              | Admin course/admissions/payment operations               |
| `/interest`                                                | Program-specific inquiry or career-call request          |
| `/policies/[policy]`                                       | Inquiry notice and honest formal-policy status           |
| `/sign-in`, `/register`                                    | Auth.js shells and account/enrollment explanation        |
| `/learn/[enrollmentId]`, `/learning/[section]`             | Student LMS and scoped learning/support tools            |
| `/dashboard/admin/learning`                                | Admin content, cohort learning and instructor management |
| `/dashboard`, `/dashboard/[role]`                          | Server-authorized role redirect and workspace shells     |
| `/projects`, `/projects/[podId]`, `/projects/tickets/[id]` | Authorized pods, sprints, tickets, evidence and reviews  |
| `/projects/portfolio`                                      | Publication-approved training portfolios and exports     |
| `/forbidden`                                               | Access-denied state                                      |

Student and mentor workspaces show real database activity with clear empty states. Original style-guide role previews retain illustrative placeholders. Future navigation is visibly marked “Soon” and is not presented as a functioning workflow. Form validation and clipboard actions in the style guide are local component demonstrations. Applications and sandbox checkout have real server endpoints. Checkout is disabled until genuine test credentials and approved business content are configured; no runtime mock payment integration exists.

## Design system

CSS variables in `src/app/globals.css` and typed tokens in `src/config/design-tokens.ts` define palette, type, spacing, radii, shadows and motion. Public pages use navy surfaces, violet/coral light, bold headings and original CSS/vector art. Workspaces use the same tokens with restrained color and flat, readable surfaces. System fonts avoid network font requests and font-related layout shifts. No third-party image assets or Rockstar intellectual property are included.

`components.json` supports adding shadcn/ui components. Primitives live in source for direct ownership and customization. GSAP enhances the cinematic public introduction and scroll storytelling; Framer Motion handles workspace preview transitions. Both respect reduced motion. No scroll hijacking, video backgrounds, or backdrop blur.

## Database

See [schema](prisma/schema.prisma) and [initial migration](prisma/migrations/20261119090000_foundation/migration.sql). The schema includes:

- Auth users, role enum, OAuth accounts, revocable database sessions and verification tokens.
- Courses → cohorts, lessons, projects and assessments.
- Users → cohort enrollments → payments with minor-unit amounts, provider references and idempotency keys.
- Cohorts → Agile pods → membership; cohort/project assignments → learner submissions.
- Assessment attempts; mentor profiles and cohort assignments.
- Employer profiles → opportunities; learner applications to exactly one course or opportunity.
- Anonymous inquiries with explicit consent, idempotent submissions and hashed rate buckets; see [Phase 2](docs/phase2.md).

Unique keys, foreign keys, query indexes and SQL checks protect core records. Financial relationships use restrictive deletion. Retention and anonymization are future operational concerns. The initial migration includes manual CHECK constraints; preserve these when generating later migrations. Cross-record workflow rules (for example pod enrollment, assignment/course consistency and assessment score ceilings) must be enforced by future transactional services before those write workflows are exposed.

## Authentication and authorization

Stable `next-auth` (Auth.js) uses GitHub OAuth, PrismaAdapter and database sessions. Each protected page calls `requireRole` on the server; session callbacks read the current role from PostgreSQL on every request. Role changes and session deletion take effect without waiting for a JWT to expire. OAuth IDs and secrets must be configured together with database URL, canonical URL and session secret. Unconfigured auth endpoints return HTTP 503, and protected pages redirect to sign-in. Public shell builds require no real secrets.

Server-only modules isolate database access and authentication. Phase 3 handlers use server session/role guards plus resource-level ownership checks; layout gating alone is insufficient. Auth.js owns OAuth state and CSRF protection. Logs whitelist event names and sanitized error codes, excluding tokens, email addresses and raw errors. Add centralized observability, rate limiting at the hosting layer, and runtime secret rotation before opening production enrollment.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Install browser binaries with `npx playwright install chromium` if needed. The build uses Next.js's supported Webpack bundler because Turbopack's CSS worker IPC is blocked in this execution environment.

Database checks use an isolated database whose name includes `nexora_phase1`; never point tests at production. Apply migrations to it first:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run db:migrate
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run test:db
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 npm run test:e2e
```

The configured browser test server uses explicit, nonfunctional OAuth test identifiers and a test-only session secret. Session tests create isolated user/session fixtures in PostgreSQL and clean them up; they do not claim to test GitHub's external consent flow. DB constraint tests roll back all writes. CI runs a fresh server to avoid accidentally testing against another process's configuration.

## Deployment and limits

Run `npm run build` then `npm start` on a Node-compatible Next.js host with PostgreSQL connectivity and configured runtime secrets. Run `npm run db:migrate` as a release step using a migration-capable database role; use a least-privileged database role for application requests. Use HTTPS and the correct canonical OAuth URL. The current Sites hosting contract requires a Cloudflare Worker or static export and cannot directly host this native Next.js/PostgreSQL server; no incompatible deployment was created.

Remaining scope includes approved business content, genuine external sandbox verification, production payment activation, refund initiation, real GitHub provider verification, production operations, interviews, job matching and placement workflows. OAuth consent requires real operator credentials for end-to-end external verification. Automated accessibility checks target WCAG 2.2 AA and do not replace manual assistive-technology testing. No placement guarantees or unverified hiring partnerships are claimed.

Phase 3 routes, data models, operator workflow and sandbox setup are documented in [docs/phase3.md](docs/phase3.md). Phase 4 learning workflows and their operational limits are documented in [docs/phase4.md](docs/phase4.md). Phase 5 delivery workflows and boundaries are documented in [docs/phase5.md](docs/phase5.md). Phase 6 career and employer hiring workflows are documented in [docs/phase6.md](docs/phase6.md). Production launch remains gated; the full finance/operations suite belongs to Phase 7.
