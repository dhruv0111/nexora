# Phase 2 — Cinematic homepage

The homepage uses the original Phase 1 tokens, primitives, App Router and database foundation. Protected dashboard pages, Auth.js configuration and server authorization code are unchanged. Public layout navigation/footer now support the marketing journey; the style guide remains at `/style-guide`.

## Public experience

All twelve requested sections are implemented in order: sticky disclosure navigation, original cinematic hero, four career tracks, Learn/Build/Launch, HireFlow, six benefits, course comparison, illustrative learning preview, career support, FAQ, final CTA with inquiry form, and footer. `/interest?program=qa-sdet` selects a program; `?intent=career_call` requests a conversation. Call requests require personal confirmation and do not fabricate calendar bookings.

`src/components/marketing/` contains reusable compositions. `src/config/marketing.ts` extends existing course data with suggested starting points. Final durations, prices, schedules and formal entry requirements have not been supplied, so the UI identifies those as unconfirmed and offers an inquiry instead of checkout. `src/app/(public)/marketing.css` scopes the cinematic styling to public compositions. It is imported once from the root layout alongside the foundation stylesheet so the critical CSS is delivered as one request rather than through a nested layout stylesheet boundary. All meaningful copy is server rendered. GSAP is dynamically imported after initial paint; its context owns transforms and ScrollTriggers. Reduced-motion media queries disable animation and parallax. No motion hides readable text.

HireFlow tasks and learning progress are explicitly illustrative. They contain no student records and do not represent formal employment, internships or an implemented LMS. No hiring logos, placement figures, testimonials or scarcity claims are invented.

Artwork source, optimized asset and the exact built-in imagegen prompt are recorded in [asset provenance](phase2-assets.md).

## Functional inquiry capture

Apply the additive migration, then configure the runtime:

```sh
npm run db:migrate
# Generate a separate signing/hash secret; keep it in the secret store or ignored .env.
openssl rand -base64 32
```

Set `DATABASE_URL`, `LEAD_FORM_SECRET` (32+ characters), and `INQUIRY_ORIGIN` to the exact browser origin including scheme and port, for example `http://localhost:3000`. `NEXTAUTH_URL` is a canonical-origin fallback when `INQUIRY_ORIGIN` is absent. Always browse the configured hostname consistently. Production must use HTTPS and its real public origin. Restart after environment changes. Public builds work without credentials; unconfigured inquiry endpoints return 503 and the form displays the unavailable state.

- `GET /api/inquiries/challenge` returns a no-store signed nonce, valid after 1.5 seconds for up to one hour.
- `POST /api/inquiries` validates the public origin, media type, streamed 8 KB body limit, normalized fields, explicit consent, honeypot, signature and timing.
- PostgreSQL stores the inquiry, consent timestamp and notice version. No payment or enrollment is created. Success returns a real persisted receipt.
- A unique nonce and keyed payload fingerprint make identical retries idempotent; changed payloads with an already used nonce receive 409.
- Transactional rate buckets allow three inquiries per normalized email per ten-minute window. Optional IP limits allow twenty requests per window and store only keyed hashes.
- Set `INQUIRY_TRUST_PROXY=true` only when a trusted reverse proxy overwrites `x-forwarded-for`; otherwise leave it false. Add deployment-edge bot controls before a broad public launch. This is layered spam resistance, not a CAPTCHA or a claim to prevent every automated submission.
- Expired rate buckets are cleaned on successful submissions. Configure operator-approved inquiry retention, exports and deletion processes before launch. No public lead-list endpoint is exposed.

Operators can review `Inquiry` through an authorized database/admin process. Notification emails, a CRM, calendar booking and a lead-management UI are not connected. Names, email and optional messages are not sent to analytics or stored in browser draft storage. A failed request retains the user’s input in memory for retry.

`nexora:marketing` CustomEvents expose `cta_click` and `inquiry_submitted` hooks with allowlisted location/program/intent metadata. No analytics vendor is installed. No email, name, message, signed form token or receipt is included.

## Honest policy status

`/policies/privacy` describes the implemented inquiry data flow and the limited consent notice. The organization’s formal privacy policy, retention schedule, privacy contact, enrollment terms and refund policy have not been supplied. Policy pages disclose this status instead of inventing legal terms. The contact link opens the functional inquiry flow; no address, email or social account is fabricated.

## Verification and preview

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nexora_phase1 CI=1 npm run test:e2e -- --workers=4
```

Apply both migrations to the isolated `nexora_phase1` database before browser tests. Playwright owns port **3100**, preserving a development server on 3000. Its configured test server supplies test-only signing/OAuth values; external GitHub consent is not exercised. The tests create and clean isolated lead and session fixtures. Use `CAPTURE_PREVIEWS=1` for desktop/mobile homepage captures and `CAPTURE_STYLE_GUIDE=1` for design-system captures.

Five viewports: desktop 1440, wide 1920, tablet 768, mobile 375 and mobile 390 CSS pixels. Accessibility checks use axe for WCAG A/AA; manual screen-reader and cross-browser checks remain separate launch work.

Final verification: strict TypeScript, ESLint without warnings, Prettier, production build, 31 unit tests and four database integrity tests passed. The full five-viewport browser suite passed 77 cases with three intentional mobile-only skips on larger viewports. Ten desktop/mobile cases were rerun after the image-priority improvement, followed by the full five-width suite after consolidating critical CSS. Coverage includes every CTA destination, menu disclosures, course selection, FAQ keyboard controls, reduced motion, overflow, persistence, consent, replay safety, rate limits, PII-free events, and all existing role/session boundaries.

Screenshots: [desktop 1440 px](previews/phase2-desktop.png), [mobile 390 px](previews/phase2-mobile.png).

### Measured mobile performance

Final Lighthouse 13.6.0 navigation audit on the local production build, Chrome 157 headless on macOS, using the default simulated Moto G Power mobile profile: 412×823 CSS pixels, DPR 1.75, 4× CPU slowdown, 150 ms RTT and 1,638.4 Kbps throughput. Browser tests were finished before auditing. The production server was running, the Next.js image cache was retained across audits, and Lighthouse used its default fresh browser storage/profile behavior. No deployment/CDN or real mobile device was measured.

| Metric              | Final result | Target                                             |
| ------------------- | ------------ | -------------------------------------------------- |
| Performance         | 93           | ≥90 — met in this run                              |
| Accessibility       | 100          | ≥95 — met                                          |
| LCP                 | 2.74 s       | ≤2.5 s — **not met**                               |
| CLS                 | 0            | ≤0.1 — met                                         |
| Total Blocking Time | 186 ms       | Lab responsiveness diagnostic; not INP             |
| INP                 | Not measured | Requires representative field interactions/traffic |

[Final HTML report](performance/phase2-mobile-stylesheet.report.html) · [Final JSON](performance/phase2-mobile-stylesheet.report.json) · [Machine-readable summary](performance/summary.json).

The first audit scored 62 with a 4.13 s blocking-time outlier. A second profile of unchanged code scored 93 with 150 ms TBT, showing substantial host/run variability. The retained trace identified a missing high-priority hint for the hero image; that hint was corrected and that run scored 95. Consolidating critical CSS reduced the render-blocking stylesheets from two requests to one (18 KB transferred); the final build scored 93 with a 2.74 s LCP. Scores and blocking times vary between local runs. The image discovery check now passes. Retained baseline/profile reports make this history reviewable; the final number is not a median or a production guarantee. LCP remains approximately 0.24 s above target and needs further profiling on the chosen production host/CDN. No unsupported claim is made that all performance targets are achieved. Lighthouse is an audit-only npm-cached CLI, not a new application dependency. Local lab results do not constitute field performance or measured production INP.

## Phase 3 readiness

The acquisition journey now ends in a persisted inquiry. Next: operator-approved curriculum/duration/pricing and policies, inquiry triage/notifications, and separately scoped enrollment, billing/webhooks and learning workflows. Existing Phase 1 models and authorization remain the basis for those services. Native Next.js deployment still requires a Node-compatible host and PostgreSQL; current Sites Worker/static hosting does not directly host this server. No deployment was created.
