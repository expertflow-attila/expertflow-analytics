# Funnel Intelligence OS

Open-source customer journey, funnel analytics and revenue intelligence for
businesses that sell through a funnel — consultants, coaches, course creators,
memberships, B2B services and high-ticket offers.

Most analytics tools tell you what happened. This one is built to answer the
question after that: **where is the next largest amount of money, and what
should I fix first?**

## What it does

| | |
|---|---|
| **Observe** | Visitors, leads, customers, revenue, funnel conversion |
| **Diagnose** | What changed, against a rolling seasonal baseline |
| **Explain** | Which channels and journeys produced the revenue |
| **Prioritise** | Ranked opportunities with an estimated monthly upside |
| **Act** | The evidence and assumptions behind every number |

It is not a GA4 clone, a PostHog clone, or a BI dashboard.

## Design principles

**No invented numbers.** Where a figure cannot be computed it says
`Unavailable`. CAC without ad spend, LTV at a horizon that has not elapsed,
attribution for a purchase with no resolvable person — all reported as missing
rather than estimated into existence.

**The maths is visible.** Opportunity scoring shows its components and its
formula. Attribution shows four models side by side and how far apart they are.
Nothing important happens inside a black box.

**Data quality is a first-class citizen.** A Tracking Health score gates how
confidently the rest of the product speaks. Sample data is labelled as sample
data on every screen that reads it.

**AI is optional.** Every feature works without an API key. When AI is enabled
it interprets numbers the backend computed; it never computes them itself.

## Quick start

Requires Node 20+, pnpm and PostgreSQL 14+.

```bash
git clone <your-fork>
cd funnel-intelligence-os
cp .env.example .env

# generate the two required secrets
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> .env

pnpm install
pnpm db:migrate
pnpm db:seed      # optional: ~180k events of labelled demo data
pnpm dev
```

Then sign in at http://localhost:3000 with `demo@funnelintelligence.dev` /
`demo1234`.

New accounts must confirm their email address before signing in. Configure
`RESEND_API_KEY` and `EMAIL_FROM` with a verified sending domain. Pending accounts
can request another message at `/verify-email`. See
[email verification](docs/email-verification.hu.md).

### With Docker

`docker compose up -d` starts PostgreSQL and Redis. The app itself runs from
`Dockerfile`, or locally with `pnpm dev` against the containers.

## Project configuration

Administrators can create and revoke API keys in Integrations. Copy a new server
secret immediately: it is returned once and only its hash is stored. The same page
saves encrypted Stripe and generic-webhook signing configuration and can disconnect
an integration. Settings saves workspace names, timezone and attribution options.
Base currency stays fixed to avoid relabelling historical money.

Funnels includes an editor for ordered steps, event names, targets, matching mode
and conversion window. Saving updates the analytics canvas. The editor preserves
existing event filters; a dedicated filter builder is not included.

Local browser/API/security regression tests: [evals/README.md](evals/README.md).

## Tracking

Add the script to every page:

```html
<script src="https://your-app.com/sdk.js" data-project-key="pk_..."></script>
```

```js
funnel.page()
funnel.identify({ email: "buyer@example.com" })
funnel.track("lead_created", { leadMagnet: "AI Guide" })
funnel.track("purchase_completed", {}, {
  revenue: { amount: 149.0, currency: "EUR" }
})
funnel.reset()   // on logout
```

The SDK is dependency-free, queues events through page unload, deduplicates on
a client-generated id, persists UTM parameters across the attribution window,
and can be gated behind consent.

Server-side, for revenue you cannot afford to lose to an ad blocker:

```bash
curl -X POST https://your-app.com/api/v1/events \
  -H "Authorization: Bearer sk_..." \
  -H "Content-Type: application/json" \
  -d '{"event_name":"purchase_completed","identify":{"email":"a@b.com"},
       "revenue":{"amount":149.00,"currency":"EUR"}}'
```

## Architecture

A modular monolith: one Next.js application, with the analytics domain kept in
dependency-free modules that can be extracted later.

```
src/lib/analytics/     pure calculation engines, no database
src/lib/events/        event envelope, taxonomy, channel classification
src/server/analytics/  queries feeding the engines from Postgres
src/server/ingest/     idempotent event ingestion
src/server/identity/   deterministic identity resolution
src/app/(app)/         authenticated analytics surfaces
public/sdk.js          browser tracking SDK
```

The calculation engines take plain data and return plain data. That is what
makes the funnel and attribution rules provable against fixtures rather than
merely plausible.

See [docs/architecture.md](docs/architecture.md),
[docs/analytics.md](docs/analytics.md),
[docs/attribution.md](docs/attribution.md),
[docs/ai.md](docs/ai.md) and
[docs/privacy.md](docs/privacy.md).

## Tests

```bash
pnpm test              # unit + integration
pnpm typecheck
```

Integration tests need a database; they default to
`postgres://fios:fios@localhost:5432/fios_test`, overridable with
`TEST_DATABASE_URL`.

The suite includes golden fixtures: a funnel whose conversion rates are known
by hand, and an attribution journey whose credit split is known to the cent for
every model.

## Status

Implemented: multi-tenant foundation, registration and workspace setup, event
ingestion, identity resolution, the browser SDK, Stripe and generic webhook
ingestion with revenue reconciliation, the funnel, attribution, LTV,
opportunity, anomaly and tracking-health engines, the AI Analyst, and every
surface listed in the navigation.

Not yet implemented: CSV import and export, the experiments module, the MCP
server, and the scheduled jobs for data retention and subject requests. These
are modelled in the schema or described in the docs but have no implementation,
and are deliberately absent from the navigation rather than shown as pages that
do nothing.

One caveat worth stating plainly: the HTTP adapters for the Anthropic and
OpenAI providers have not been exercised against a live API, because both
available keys were out of credit. The agent loop around them is covered by
tests. See [docs/ai.md](docs/ai.md).

## Licence

AGPL-3.0-only. See [LICENSE](LICENSE).
