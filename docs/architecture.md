# Architecture decisions

- App Router server components render public content and secure dashboard shells. Small client boundaries handle animation, clipboard, local form validation and OAuth actions.
- Public and learning experiences share primitives and tokens but have distinct layout compositions. Public workspace previews are isolated, static component data.
- PostgreSQL is the source of truth for identities, roles and revocable sessions. Auth.js's stable package line is selected over its beta major. Prisma 7.10.1 is selected over the current release-candidate tag. The lockfile pins the complete resolved dependency graph.
- Prisma's PostgreSQL driver adapter uses a process-wide lazy client. Configuration is validated without requiring a live database during public builds. Routes that depend on authorization are explicitly dynamic.
- `Role` is a single-role enum; Visitor is an anonymous audience, not a stored account. Multi-role organizations and fine-grained permissions can be introduced through join tables when actual requirements justify them.
- Phase 3 domain services validate ownership, application assessment/approval, published content, fee/terms versions and capacity in serializable transactions. Future learning/project services must independently enforce their resource relationships; the schema alone does not authorize writes.
- API inputs use explicit Zod DTOs. Never pass request bodies to Prisma wholesale. Never allow self-assignment of roles, payment status, verification or assessment results.
- Payments store integer minor units and provider references, not card data. Phase 3 adds raw-byte signed webhooks, durable deduplication, server reconciliation and transactional activation. The adapter is test-only and disabled without real keys. See [Phase 3 architecture and operations](phase3.md).
- Original CSS illustration and vector accents keep Phase 1 self-contained, lightweight and free of externally copied game artwork.

- Phase 4 extends the existing learning models with versioned lesson progress, submissions, assessments, schedules and private support. Every learning mutation rechecks enrollment ownership or mentor cohort assignment. Media links require configured external hosting; small private assignment attachments use a bounded PostgreSQL adapter. See [Phase 4](phase4.md).

- Phase 5 extends Project/AgilePod/PodMember for cross-course collaboration without merging HireFlow's product data/auth/deployment. Project and pod authorization sits above verified enrollment checks. Evidence approval, provider identity verification, portfolio publication and deployment attestation remain separate states; private source URLs are omitted from portfolio exports. See [Phase 5](phase5.md).

- Phase 6 introduces a separate HiringApplication domain, tenant-scoped verified employers, current candidate consent, moderated jobs and independently verified offers/joining. Career/public sharing reuses approved nonconfidential Phase 5 portfolios with a further privacy DTO. Recruitment billing stays disabled. See [Phase 6](phase6.md).
