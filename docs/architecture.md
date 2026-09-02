# Architecture

## Shape

A modular monolith. One Next.js application serves the UI, the authenticated
backend and the public ingestion API. The analytics domain lives in modules
with no database dependency, so it can be extracted into a service later
without rewriting the rules.

```
                    browser SDK          server-side API
                         │                      │
                         └──────────┬───────────┘
                                    ▼
                          POST /api/v1/events
                                    │
                    ┌───────────────┴───────────────┐
                    │        ingest service         │
                    │  validate → dedupe → store    │
                    │  → session → touchpoint       │
                    │  → identity resolution        │
                    └───────────────┬───────────────┘
                                    ▼
                              PostgreSQL
                                    │
                    ┌───────────────┴───────────────┐
                    │         query layer           │
                    │   tenant-scoped, typed         │
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │    pure calculation engines    │
                    │  funnel · attribution · LTV    │
                    │  opportunity · anomaly · health│
                    └───────────────┬───────────────┘
                                    ▼
                          server-rendered pages
```

## Why pure engines

`src/lib/analytics/*-core.ts` take plain data and return plain data. No
database, no network, no clock beyond what is passed in.

This is the single most important structural decision in the codebase. Funnel
and attribution rules are subtle, and the cost of getting them wrong is that
someone makes a business decision on a false number. Pure functions can be
proven against fixtures whose correct answers are known by hand, which is what
`__tests__/funnel-core.test.ts` and `attribution-core.test.ts` do.

## Multi-tenancy

Every business row carries `organization_id` and `project_id`.

`TenantContext` cannot be constructed without passing a membership check —
`requireProject()` joins projects to memberships and throws otherwise. Pages
and services take a context, never a bare project id, so there is no code path
that runs an analytics query unscoped.

A missing membership returns `NOT_FOUND` rather than `FORBIDDEN`: confirming
that an organization id exists to a non-member is itself a leak.

Cross-tenant isolation is covered by integration tests, including the case of
the same email address appearing in two projects — which must produce two
separate people and never be merged.

## Identity resolution

```
anonymous visitor → anonymous_id
                         ↓  (email / user id / payment customer appears)
                    identity link
                         ↓
                      person
```

Merges happen **only** on identifiers a customer's own systems assert:
external user id, payment customer id, CRM contact id, or verified email.
Never on name similarity, IP or device fingerprint. A false merge silently
corrupts every downstream number and is effectively unrecoverable, so the bar
is deliberately high.

When an identity is linked, prior anonymous events, sessions and touchpoints
are back-filled onto the person. Without that back-fill, first-touch
attribution would be blind to everything before the email was given.

Every decision is written to `identity_links`, making merges auditable.

## Ingestion guarantees

- **Idempotent.** Events carry a client-generated `event_id`; a repeat is
  counted as a duplicate and never double-stored. This is what makes retries
  safe.
- **Atomic.** Each event is ingested in a transaction covering the event row,
  its session, its touchpoint and identity resolution.
- **Isolated.** One malformed event never aborts the rest of a batch.
- **Bounded.** Timestamps are clamped rather than rejected: a wrong client
  clock should not lose data, but must not create data in the future either.

## Storage

PostgreSQL for everything. An `EventStore` abstraction is described in the
roadmap for ClickHouse at higher volumes, but the Postgres implementation is
the only one built — a second implementation that is not exercised is a
liability, not an option.

Redis is optional. Without it, rate limiting falls back to an in-process
counter, correct for single-instance self-hosting and development but not
across serverless instances. This is a guard rail against runaway clients, not
a billing boundary.

## Measured performance

Against the seeded dataset — 61k visitors, ~180k events, 19k people, 100
orders over 150 days, on a local Postgres 17:

| Query | Time |
|---|---|
| Overview | ~560 ms |
| Funnel, 8 steps | ~190 ms |
| Conversions with touchpoints | ~5 ms |
| Cohorts | ~1 ms |
| Tracking health | ~35 ms |
| Observed paths | ~60 ms |

Measured with `pnpm tsx scripts/benchmark.ts`. These are figures from one
machine, not a service level commitment. The overview query is the slowest
because it counts distinct actors across the full event range; it is the first
candidate for the materialised daily rollup tables already present in the
schema.

## Security

- Server-side authorization on every data path
- Zod validation at the API boundary
- Publishable keys stored in clear (they ship to browsers, and can only write);
  secret keys stored as SHA-256 hashes and shown once
- Integration credentials and bring-your-own AI keys encrypted at rest with
  AES-256-GCM
- Rate limiting on ingestion
- Error text sanitised before logging: database errors quote the offending
  parameters, which can include bytes Postgres itself refuses to store

## Decisions

See `docs/adr/` for the reasoning behind the modular monolith, the event store,
the identity model and attribution.
