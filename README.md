# Funnel Intelligence OS

An open-source customer journey, funnel analytics and revenue intelligence workspace designed around one question: **what should we fix next?**

The deployed interface uses an explicitly labelled seed dataset. It is a functional product walkthrough, not a claim that sample metrics are live customer data. Event ingestion stays fail-closed until a production `EventStore` is configured.

## Features

- Executive decision summary and core business metrics
- Interactive funnel canvas with node analytics
- Customer journey explorer and identity-linked timelines
- First-touch, last-touch, linear and U-shaped attribution comparison
- Cohort LTV and payback analysis with incomplete-window handling
- Deterministic opportunity scoring and what-if simulation
- Experiment ledger using “observed change” language
- Tracking health diagnostics with affected data and recommended fixes
- Tool-traceable analyst demo with no invented calculations
- Browser SDK and validated server event envelopes
- Light/dark Business Native design system

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Run quality gates with:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Self-hosting

`docker compose up -d` starts PostgreSQL and Redis for a connected deployment. The public demo deliberately does not accept events; install a production EventStore adapter before enabling ingestion. See `docs/architecture.md`.

## Tracking

```html
<script src="https://your-domain.com/funnel-sdk.js"
        data-project-key="pk_live_xxx"
        data-consent="required"></script>
```

```js
funnel.consent(true)
funnel.page()
funnel.identify({ email: "person@example.com" })
funnel.track("lead_created", { leadMagnet: "AI Systems Guide" })
```

## Architecture and limitations

The repository is a modular Next.js application. Calculation logic is deterministic and covered by golden tests. A production deployment still requires auth, tenant-scoped storage, migrations, queue workers and webhook verification before event ingestion is enabled. The UI communicates this boundary instead of pretending the seed data is live.

See `docs/architecture.md`, `docs/analytics.md`, `docs/attribution.md` and `docs/privacy.md`.

## CSV import / export

Demo data can be exported as CSV from the Revenue page (Export report button). The utility in `src/lib/csv.ts` supports round-trip parsing and is covered by tests. Production import will land on the event ingestion endpoint once a real EventStore is configured.
