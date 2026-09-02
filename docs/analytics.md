# Analytics definitions

Every metric in the product is defined here. Where a definition is ambiguous in
the wider industry, the choice made here is stated along with the reason.

## Vocabulary

These four are consistently distinguished and never used interchangeably.

| Term | Definition |
|---|---|
| **Visitor** | A distinct actor. Resolved to a person when possible, otherwise the anonymous browser id. |
| **Session** | A run of activity from one browser, ending after 30 minutes of inactivity. |
| **Person** | A human identified by at least one deterministic identifier. |
| **Customer** | A person with at least one non-refunded order. |

Similarly:

| Term | Definition |
|---|---|
| **Event** | One recorded action. |
| **Touchpoint** | An event that carried a marketing channel signal. |
| **Conversion** | Reaching a defined funnel step, or a purchase, depending on context — always stated. |
| **Revenue** | Money recorded against orders. |
| **Attributed revenue** | Revenue after being distributed across touchpoints by a model. Never the same number as revenue. |

## The effective actor

An event may carry a person id, or only the anonymous id of a browser later
linked to a person. Both resolve to the same actor:

```
actor = coalesce(event.person_id, identity.person_id, event.anonymous_id)
```

Without this collapse one human is counted twice — once anonymously at the top
of a funnel and once identified further down — and every step after the first
appears to convert nobody.

## Funnel metrics

```
entered(n)      unique actors matching node n while still eligible
converted(n)    entered(n) actors who matched node n+1 within the window
conversion(n)   converted(n) / entered(n)
dropoff(n)      entered(n) - converted(n)
```

An actor is counted **at most once per node**, regardless of how many times
they fire the matching event. Funnels measure people, not events.

The final node has no conversion rate: there is no step after it. It is
reported as `—`, never as 0% or 100%.

### Conversion window

The window is anchored on the actor's entry into the **first** node, not on
each step. A "30 day funnel" means the whole journey completed within 30 days.
Anchoring per step would allow unbounded total duration while still calling
itself a 30 day funnel.

### Matching modes

| Mode | Meaning |
|---|---|
| `STRICT` | The very next recorded event must match the next node. |
| `ORDERED` | The next node must occur after the current one; intervening events are ignored. |
| `FLEXIBLE` | As ordered, without requiring the actor to be new to the node. |

`ORDERED` is the default, because real journeys contain email opens, page views
and other noise between funnel steps.

### Time to convert

The **median** seconds between entering a node and entering the next. Median
rather than mean: a single actor who converts eight months late would otherwise
dominate the figure.

## Plan versus reality

Each node may carry a target conversion rate, meaning the planned rate **from
that node to the next**.

```
variance = actual conversion − target conversion
```

Reported in **percentage points**, never as a percentage. An 8.2% actual
against a 14% target is −5.8 pp, not −41%. Conflating the two is one of the
most common ways analytics reports mislead.

## Revenue

All money is stored and computed in **minor units** (cents) as integers.
Division by 100 happens only at formatting time; floating-point currency
arithmetic never reaches the database.

```
Gross revenue     sum of order gross
Refunded revenue  sum of refunds, on the date the refund occurred
Net revenue       gross − refunded
AOV               gross / order count
Revenue per visitor   net / distinct actors
MRR               sum of active subscription monthly value
ARR               MRR × 12
```

Refunds are subtracted at the date they happened, not back-dated to the
original order. Back-dating would make previously reported figures change
retroactively.

When a server-side payment source is connected, browser `purchase_completed`
events are **not** canonical; the payment record is.

## LTV and cohorts

Cohort LTV is cumulative **net** revenue per acquired customer at fixed day
offsets from acquisition (30, 60, 90, 180, 365 days, and lifetime).

A horizon is reported only for customers whose horizon has **fully elapsed**.
Averaging a 365-day LTV over customers acquired last week understates it. Where
no customer in a cohort has reached the horizon, the cell reads `—`.

### Payback

The number of days until a cohort's cumulative net revenue per customer exceeds
its CAC. Requires marketing spend. Without spend data, CAC and payback are both
reported as `Unavailable` — never estimated.

## Opportunity estimation

```
additionalConversions = eligibleUsers × improvementPoints
additionalRevenue     = additionalConversions × downstreamRevenuePerConversion
monthlyUpside         = additionalRevenue ÷ periodDays × 30
additionalProfit      = additionalRevenue − incrementalCosts
```

`downstreamRevenuePerConversion` is **measured**, not assumed: it is the
revenue observed for actors who cleared that step during the period.

### Opportunity score

```
score = (revenueImpact × confidence × reach × persistence) ÷ effort
```

| Component | Meaning |
|---|---|
| `revenueImpact` | Log-scaled monthly upside |
| `reach` | Actors entering the step, capped at 1000 |
| `persistence` | Inverse volatility of the step's historical rate |
| `effort` | 1 (trivial) to 5 (major project) |

Each component is displayed alongside the score. A ranking nobody can
interrogate is a ranking nobody should act on.

### Confidence

Derived from the data, never chosen:

| Band | Condition |
|---|---|
| `UNAVAILABLE` | No actors entered, or no downstream revenue observed |
| `LOW` | Fewer than 100 actors entered |
| `MEDIUM` | Fewer than 500 actors entered |
| `HIGH` | 500+ actors entered, with observed downstream revenue |

This is **not** a statistical confidence interval, and the product never claims
the improvement is achievable — only what it would be worth.

## Anomaly detection

Rolling mean and standard deviation over a 28 day lookback. Where at least
three weeks of history exist, the baseline uses the **same weekday**, so a
quiet Sunday is not reported as a crash.

A point is reported only when it is both statistically unusual (|z| ≥ 2.5) and
materially different (|change| ≥ 15%). Both conditions are required: a large
move within normal variance is noise, and a tiny move outside it is trivia.

When the baseline is perfectly flat, relative change is used instead of an
infinite z-score.

## Tracking Health

A 0–100 score, starting at 100 and losing a check's weight on failure, half on
warning.

| Check | Weight | Warn | Fail |
|---|---|---|---|
| Purchase reconciliation | 25 | 2% | 10% |
| Unknown traffic source | 20 | 10% | 30% |
| Duplicate events | 15 | 2% | 10% |
| Identity coverage | 15 | 70% | 90% |
| Ingest errors | 15 | 1% | 5% |
| UTM coverage on paid | 10 | 5% | 20% |

The score exists so the product can refuse to present confident insights on top
of broken data.

## Timezones

Every timestamp is stored in UTC. Day bucketing uses the **organization's**
timezone, never the viewer's browser. Two people in different countries looking
at the same dashboard must see the same numbers.
