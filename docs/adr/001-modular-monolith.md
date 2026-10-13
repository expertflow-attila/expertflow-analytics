# 1. Modular monolith over microservices

**Status:** accepted

## Context

The system spans ingestion, identity resolution, several analytics engines, a
UI and an optional AI layer. That decomposition invites a service per concern.

## Decision

Build one Next.js application. Keep the analytics domain in modules with no
database dependency, and keep every business table scoped by organization and
project so a later split does not require a data migration.

## Consequences

A single deployment, a single database, and `docker compose up` as the whole
development environment. Cross-module calls are function calls, so a change to
a funnel rule cannot silently break a consumer at runtime.

The cost is that horizontal scaling is all-or-nothing for now. That trade is
right at this stage: the target user runs one business, not a data platform.
Extraction stays available because the engines are already pure.
