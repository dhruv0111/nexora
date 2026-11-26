# Phase 5 — Project delivery engine and Agile pods

NEXORA now tracks supervised products, cross-functional pods, sprints, tickets, evidence, reviews, quality gates, release attestations and portfolio publication. HireFlow remains a separate logical/application boundary; no applicant-tracking tables, product authentication or deployment are merged into NEXORA. See the [HireFlow delivery brief](hireflow-project.md).

## Architecture and routes

Existing Project, AgilePod and PodMember models are extended. Project.courseId and AgilePod.cohortId become nullable to permit a product/pod spanning actual enrolled cohorts; existing references and records remain. New tables hold project staff, sprints, tickets, comments, contribution evidence/revisions, private files, concerns, releases, repositories, webhook receipts and portfolio entries. The [additive migration](../prisma/migrations/20261120170000_project_delivery/migration.sql) drops no table, column or record. CHECK constraints bound states/files/evaluations and a partial unique index allows one active sprint per pod.

`src/lib/projects/` separates authorization, delivery services, evidence/portfolio, GitHub, private files and bounded read models. `src/components/projects/` reuses the learning shell and validated form infrastructure. Learning progress remains independent of project delivery. No new dependencies were installed.

| Route                          | Purpose                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `/projects`                    | Authorized project/pod discovery; staff creation and repository/mentor assignment                  |
| `/projects/[podId]`            | Filterable Kanban, sprint timeline, members, blockers, releases, activity and staff planning       |
| `/projects/tickets/[id]`       | Requirements/criteria, transitions, evidence/files, review, comments, quality and portfolio review |
| `/projects/portfolio`          | Owned contribution history and publication-approved summaries                                      |
| `/api/projects/export`         | Student-owned approved portfolio JSON; private/no-store                                            |
| `/api/projects/[action]`       | Independent role/resource authorization for reads and mutations                                    |
| `/api/projects/github-webhook` | Exact-byte signed optional GitHub webhook, durable deduplication and reconciliation                |
| `/api/projects/files/[id]`     | Authorized private attachment download                                                             |

Navigation links are added to student/mentor learning shells, including the mobile menu. The existing public website, applications, checkout, LMS and style-guide previews are preserved.

Assigned staff can edit and publish drafts with an optimistic version and recorded rationale. Publication requires an assigned mentor; confidentiality changes and reopening archived projects require an administrator. Metadata changes return associated portfolio entries to draft for publication review.

## Permission and evidence rules

- Students need an active pod membership tied to their own verified paid enrollment in an approved published course/cohort. Discovery uses the same payment/publication predicates. Leaving a pod, an enrollment/payment revocation or project archival blocks workspace access. A learner in another pod of the same product still cannot read this pod.
- Project mentors are explicitly assigned by ADMIN. Mentor-created projects are restricted to their assigned courses. Assigning a learner requires an actual eligible enrollment and an assigned supervisor who also has access to that learner's cohort. The learner discipline comes from the course record, not client input. Cross-track pods are supported without fabricating roles.
- Leads author tickets and assignments. Students move only their own assigned tickets READY → IN_PROGRESS → IN_REVIEW. Further transitions are server-controlled; invalid/stale transitions fail. Requirements, criteria, deadlines and assignees use optimistic versions. Editing development requirements resets review gates, invalidates affected evidence approvals and returns portfolio entries to draft.
- QA_TESTING requires lead review. DONE additionally requires QA, security and Definition of Done sign-off, approved assignee evidence and no unresolved pod security concern. Release readiness rechecks current gates/evidence and all open concerns; Done alone never records deployment. DEPLOYED requires an actual HTTPS evidence link and explicit manual supervisor attestation. No deployment API is connected.
- Evidence preserves learner identity, ticket/product, actual submission/review timestamps, reviewer, evaluation and feedback. A link or retained file is mandatory for approval; a summary alone cannot be certified. Requested changes remain in history; a student submits a new artifact instead of rewriting reviewed records. Exact submission retries reuse their request key. Students cannot approve or edit another learner's evidence.
- Membership start/end dates are recorded by the server. Reports include actual participation dates and assigned/reviewing supervisors. Hours are omitted because no reliable time-recording process is connected. Engagement is constrained to SUPERVISED_TRAINING. No attendance-based employment/internship/apprenticeship certificate or letter endpoint exists.
- Portfolio drafts need owned approved evidence, then a separate publication review of the description, challenges and substantiated outcomes. Editing a draft removes publication approval. Exports include only currently approved, nonconfidential published projects. Raw evidence/repository/demo URLs, filenames, internal acceptance text and unreviewed claims are excluded; code links remain inside the authorized workspace. This deliberate redaction avoids leaking private repository names/paths or confidential artifacts through downloads.

Portfolio exports are human-reviewed training evidence, not independently certified employment history or a public verification service. Reviewers must actually inspect artifacts and substantiate descriptions/outcomes; the application cannot establish semantic truth solely from text or a link.

## Optional GitHub integration

The manual link/private-artifact workflow works without GitHub credentials. GitHub verification is separately disabled until a genuine server-only `GITHUB_PROJECT_TOKEN` is configured. Use an expiring GitHub App installation token or fine-grained token selected for the exact authorized repositories, with metadata read, pull requests read, and contents read (commit verification). No write/admin scope is needed. This token is separate from Auth.js OAuth sign-in secrets. Token provisioning/rotation remains an operator responsibility; no OAuth permission expansion or automatic installation-token minting was added.

Only ADMIN authorizes repository owner/name pairs. Resource URLs are parsed against the exact github.com origin, PR/issue numeric identifiers and full commit SHAs. The adapter calls only api.github.com, with timeouts, no redirects, no-store and bounded DTOs. Verification fetches the repository and PR/commit server-side, compares the actual author ID to the student's authenticated GitHub Account ID and records the checked SHA/time. Commit verification additionally requires a GitHub-verified valid signature and matching authenticated author/committer identities; unsigned or differently attributed commits remain manual evidence. See [GitHub commit signature fields](https://docs.github.com/en/rest/commits/commits). PR review state is displayed separately, using the latest explicit decisions within the first 100 returned reviews; it is not a complete GitHub branch-protection evaluator. A matching author alone does not approve a contribution or issue a certificate.

Configure `GITHUB_PROJECT_WEBHOOK_SECRET` and a reachable HTTPS `/api/projects/github-webhook` endpoint for pull_request and pull_request_review events. HMAC-SHA256 verifies the exact raw bytes before parsing. Unique delivery IDs and payload hashes reject collisions; atomic processing leases prevent concurrent duplicate work, with a five-minute abandoned-lease recovery window. Normalized receipts and failure state persist without raw webhook bodies. Redeliver failed events after configuration/recovery; there is no background queue service. Matching evidence is re-fetched from GitHub rather than trusting webhook claims. Head changes revoke affected approvals/publication and reopen review gates. Webhook reconciliation is bounded to 100 matching records per delivery; administrators can use the per-evidence verification control for additional records.

Official references: [signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [PR API and read permissions](https://docs.github.com/en/rest/pulls/pulls), [fine-grained permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).

**No genuine repository token or webhook delivery was supplied.** Local provider-contract fixtures test parsing, identity and deduplication; they are not real GitHub activity. Remote API authorization, actual webhook delivery, private-repository configuration and token rotation remain unverified. No commit or PR activity is fabricated.

## Files, retention and operations

Project attachments reuse the Phase 4 TXT/PDF validation: 1 byte–2 MB, simple names, UTF-8/PDF signature checks, three active files per contribution, bounded multipart streams and private PostgreSQL byte storage. Downloads recheck pod permissions and use attachment/octet-stream, private/no-store, nosniff and a restrictive sandbox policy. Approved evidence cannot receive extra files. There is no public artifact bucket.

ADMIN retention controls archive project access or retire a specific attachment with a required reason. Retirement erases its bytes while retaining hash/metadata/audit, revokes associated approvals/publication and reopens review. This is explicit, scoped administration; no scheduled bulk deletion is performed. Backups, encryption, legal retention/erasure procedures, malware scanning and object-store capacity planning remain operator work. Signature checks are not malware scanning.

Board reads use 24-item pagination; history, member pickers and review panels are bounded. A pod supports 500 tickets. Larger installations need extended selectors/reporting beyond these operational windows. Updates use serializable transactions, recognized conflict retries, fresh server sessions, resource checks, strict inputs, canonical-origin protection, body limits, persistent action rate limits and audit history. No raw evidence, credentials or provider payloads enter client logs.

## Local setup

Use the existing README's Node/PostgreSQL/Auth.js setup, then run `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run build`, and `npm start`. The seed still creates only missing illustrative course drafts; it does not seed project achievements, payments, real cohorts or GitHub events. An operator must create real mentor profiles/assignments and approve course content; verified enrollments are still mandatory. Default project confidentiality is enabled.

New optional server-only variables are documented in `.env.example`. Keep actual credentials in the ignored environment or secret store. Live Razorpay remains unsupported and disabled. No deployment was performed. The existing native Next.js/PostgreSQL application remains local and requires a compatible production host.

## Verification

All test learners, payments and project artifacts are isolated synthetic fixtures, removed afterward; their approvals are not commercial content approval or genuine external provider verification.

### Acceptance evidence — 20 November 2026

| Scenario                                | Verification                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project/pod creation, mentor assignment | Browser/admin creation and real PostgreSQL service tests                                                         |
| Cross-functional membership             | QA and AI learners in one pod; supervisor cohort access required                                                 |
| Sprint lifecycle                        | Planned/active states, one-active constraint and required retrospective                                          |
| Assigned work and transitions           | Browser keyboard controls; invalid jumps and unauthorized edits rejected                                         |
| Contributions and review                | Inspectable artifact required; requested changes retained; current approval/evaluation recorded                  |
| Cross-pod protection                    | Unrelated users and a different pod in the same project rejected; unpaid discovery/access blocked                |
| GitHub webhooks                         | Raw signature rejection, concurrent duplicate lease, replay without extra provider calls                         |
| GitHub identity                         | OAuth account ID matched; unsigned commits rejected; signed author/committer path checked with contract fixtures |
| Changed evidence                        | PR head change reopens review; attachment retirement erases bytes and revokes approval/publication               |
| Portfolio publication                   | Contribution approval alone does not export; separate review required; confidential projects excluded            |
| Release readiness                       | Current review/QA/security/DoD and evidence rechecked; Done does not create deployment                           |
| Existing functionality                  | Full Phase 1–5 responsive regression passed                                                                      |

Verification: **58 unit/component/security tests**, **45 real PostgreSQL integration tests**, and **105 browser regression tests passed**, zero browser skips. The final scoped Phase 5 changes were followed by a fresh production build and a rerun of all five project viewport journeys, including draft publication. Strict TypeScript, ESLint without warnings, formatting and build passed. All six migrations were applied from scratch to the fresh isolated database; Prisma's database-to-schema diff reports no difference.

Browser coverage uses 375, 390, 768, 1440 and 1920 CSS px, with matching student/mentor/admin contexts. Automated axe checks report no WCAG A/AA violations in the tested board/review screens and existing tested surfaces. Native selects/buttons provide keyboard and mobile alternatives to drag-and-drop; no document overflow was reported. The Kanban scroll region is focusable on desktop and stacks columns on mobile. Screenshots are synthetic fixtures and do not show genuine commercial work or remote GitHub/payment activity. Manual screen-reader and additional-browser audits remain launch work.

Reproduce using the existing setup:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npm run test:db
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 CAPTURE_PREVIEWS=1 npm run test:e2e -- --workers=4
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npx prisma migrate status
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Never point fixture tests at production. Apply migrations to the isolated `nexora_phase1` database first. Browser tests own port 3100 and leave the user's server on 3000 untouched. Test sessions and provider responses are confined to the isolated harness; there is no runtime test-login or fake-provider route.

### Responsive previews

| Experience             | Desktop                                          | Mobile                                          |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Pod delivery board     | [Preview](previews/phase5-board-desktop.png)     | [Preview](previews/phase5-board-mobile.png)     |
| Mentor evidence review | [Preview](previews/phase5-review-desktop.png)    | [Preview](previews/phase5-review-mobile.png)    |
| Approved portfolio     | [Preview](previews/phase5-portfolio-desktop.png) | [Preview](previews/phase5-portfolio-mobile.png) |

All captured fixtures are removed after verification. Desktop boards scroll horizontally; mobile boards stack all six states, including the fixture's delivered ticket. No delivery state is invented for presentation.

### Performance and blockers

No Phase 5 homepage LCP fix is claimed. The last measured production-build local mobile baseline remains **2.76 s LCP**, **CLS 0**, **94 performance / 100 accessibility**, recorded in the [Phase 4 audit](performance/phase4-mobile.report.html). The ≤2.5 s target remains open. This phase adds route-scoped project CSS and lightweight form controls, with no new dependency or marketing redesign. No new Lighthouse run or field INP measurement was made for Phase 5.

Still required: approved commercial curricula/prerequisites, fees/cohort dates and legal/privacy/retention terms; genuine Razorpay sandbox capture and webhook delivery; GitHub repository credentials and external verification; real media/conferencing/email configuration; production hosting/database/secrets, backups, malware scanning and operational monitoring. Production payments remain disabled and no external deployment was performed. HireFlow's separate product implementation/deployment is not claimed by this academy workflow phase.

The supervised delivery/evidence foundation is ready for a separately scoped Phase 6 employer/placement portal. Production launch remains gated on the listed operator and integration work. No employment/internship/apprenticeship letters or guaranteed-placement claims were introduced.
