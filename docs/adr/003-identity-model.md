# 3. Deterministic-only identity resolution

**Status:** accepted

## Context

Joining anonymous behaviour to known people is what makes attribution and LTV
possible. Vendors commonly extend this with probabilistic matching — IP,
fingerprint, name similarity.

## Decision

Merge only on identifiers the customer's own systems assert: external user id,
payment customer id, CRM contact id, verified email. Never on anything
probabilistic.

## Consequences

Some journeys stay split across devices, so first-touch attribution is
conservative. That is the right direction to be wrong in: a false merge joins
two real humans, corrupting every downstream number in a way that is
effectively unrecoverable and is also a privacy failure.

Every merge is recorded in `identity_links` and is therefore explainable.
