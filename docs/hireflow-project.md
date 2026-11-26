# HireFlow — supervised product delivery brief

HireFlow is the product learners build; NEXORA is the academy and project-delivery system. This phase implements NEXORA's delivery engine, not an ATS inside the academy database. Create HireFlow in a separate repository, database, authentication configuration, secrets store and deployment. Register only the selected repository in NEXORA. No real applicant records, resumes, hiring partners or employer credentials are seeded.

Use synthetic candidates, job descriptions and applications. Product acceptance may include a typed application API, applicant workflow and internal dashboard, with synthetic event instrumentation. Each item is a planned project brief, not a claim that the HireFlow product is deployed.

| Track          | Example supervised responsibility                                         | Reviewable evidence                                                                        |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Full-Stack     | Validated application APIs, product auth, accessible dashboards           | Scoped PR, regression tests, API contract and design explanation                           |
| QA/SDET        | Risk-based test plans, API checks, automation and regression              | Test plan, automation artifact, defect reproduction and QA acceptance                      |
| AI Engineering | Synthetic resume analysis, retrieval/matching experiments and evaluations | Evaluation dataset provenance, model limitations, reproducible tests and approved analysis |
| Data Analytics | Synthetic event taxonomy, metrics and internal reporting                  | Metric definitions, reproducible queries, chart artifact and interpretation                |

Assign actual responsibilities per pod membership and ticket. Do not infer contribution from track enrollment. Require acceptance criteria, Definition of Done, an inspectable artifact and supervisor review. AI outputs need human review and must not become automatic real hiring decisions. Keep synthetic experiment/evaluation assets in the HireFlow product repository, not learner account tables.

A Done ticket requires lead review, QA acceptance, Definition of Done, security review and approved assignee evidence. Release readiness also rechecks current evidence and unresolved blockers. Deployment is separately attested with actual evidence; NEXORA does not deploy HireFlow or automatically certify that a release reached production. Training participation produces reviewed project summaries, not employment, internship or apprenticeship letters.
