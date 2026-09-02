# Architecture

Funnel Intelligence OS is a Next.js modular monolith. Server-rendered UI and server actions call a service layer, which enforces authorization and delegates persistence to PostgreSQL through Drizzle.

The existing Business Native dashboard is preserved as a clearly labelled sample-data overview. It is isolated from the canonical domain model; later tracking phases must not adopt its PostHog-shaped types.

Boundaries: UI → server actions/pages → services and authorization → Drizzle → PostgreSQL.

Phase 2 will add project-scoped API keys, events, sessions and identity without changing the organization/project ownership model.

