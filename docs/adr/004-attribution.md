# 4. Show several attribution models, and their disagreement

**Status:** accepted

## Context

Every attribution model is a modelling choice. Products usually pick one,
present its output as fact, and leave the reader unaware a choice was made.

## Decision

Compute four models over the same conversions and surface an Attribution
Confidence band derived from how far apart they are.

## Consequences

The reader sees when the answer is stable and when it depends entirely on the
model. Channels that only ever appear first — brand awareness, video — stop
being invisible to a last-touch report.

The cost is a more demanding interface: there is no single number to quote.
That honesty is the point.

Credit is conserved to the minor unit under every model, enforced by tests. A
reconciliation that is off by a cent is a reconciliation nobody trusts.
