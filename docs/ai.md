# AI Analyst

## The design constraint

The AI feature exists under one rule: **the model never computes a business
metric.**

It chooses which analytics tool to call and interprets what comes back. Every
number that reaches a user has been produced by the same deterministic engines
that render the rest of the product. There is no path by which the model can
invent revenue, a conversion rate, or a confidence level.

This is not a stylistic preference. A language model asked to "work out the
conversion rate" will produce a plausible number, and a plausible wrong number
in a revenue decision is worse than no number at all.

## Everything works without it

No feature outside this page depends on AI. With no provider configured, the
page says so and the rest of the product is unaffected. The executive summary
on the Overview is generated from templates, not from a model, for the same
reason: a summary that only appears when someone has paid for an API key is not
a summary anyone can rely on.

## Providers

Configured through environment variables, or per-organization with a
bring-your-own key stored encrypted at rest.

| Provider | Notes |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Ollama | `OLLAMA_BASE_URL`, no key needed, runs locally |

The adapters are plain HTTP rather than provider SDKs. The surface needed is
one call with tool definitions, and three SDKs would be three dependencies to
maintain for a feature the product is designed to work without.

## The loop

```
question
   ↓
model selects tools
   ↓
tools run against the tenant-scoped query layer
   ↓
results returned to the model
   ↓
model may call more tools  ──┐
   ↓                         │
answer                    (max 6 iterations)
```

Arguments from the model are validated with the same Zod schemas used for any
other untrusted input. A tool failure is handed back to the model rather than
thrown, so it can correct itself or choose differently. The loop is capped, and
a run that hits the cap says so rather than presenting a partial answer as
final.

## Tenant scoping

Each tool is bound to a `TenantContext` by the caller before the model sees it.
The model cannot widen that scope: passing a different project id as an
argument changes nothing, because the tool never reads a project id from its
arguments. This is covered by a test that seeds two organizations and asks the
model to read the other one's revenue.

## The toolset

| Tool | Returns |
|---|---|
| `get_overview_metrics` | Visitors, leads, customers, revenue, AOV, MRR |
| `compare_periods` | The same, against the preceding period |
| `get_funnel_metrics` | Per-step conversion, drop-off, variance to target |
| `get_opportunities` | Ranked upside with score components and confidence |
| `get_channel_performance` | Attributed revenue by channel, one model |
| `compare_attribution_models` | Four models side by side, plus disagreement |
| `get_cohorts` | Cohort LTV, CAC and payback |
| `detect_anomalies` | Unusual days against a weekday-aware baseline |
| `get_tracking_health` | Data quality score and failing checks |
| `get_top_journeys` | Most common observed paths |
| `get_customer_journey` | One person's full timeline |
| `list_top_customers` | Highest lifetime value customers |
| `simulate_funnel_change` | What-if arithmetic on supplied inputs |

Every tool result carries a `note` field stating the caveats that apply to it —
that attributed revenue is not revenue, that a simulation is not a forecast,
that Attribution Confidence is not a statistical confidence interval. These
travel with the data so the model cannot lose them.

## Answer format

What happened · Why it matters · Likely drivers · Evidence · Recommended
investigation · Suggested experiment · Potential upside · Confidence

Headings with nothing real to put under them are omitted rather than padded.

## Auditability

Every answer stores an execution trace: which tools ran, with what arguments,
what they returned, and how long each took. The UI shows it under **Evidence**,
so any figure in an answer can be traced to the tool output it came from.

The trace records tool calls and results. It does not record the model's
reasoning, which is neither reliable nor necessary for verifying a claim.

## Confidence

The model is forbidden from generating a confidence percentage. Confidence
comes from tool output, and is derived from sample size, whether downstream
revenue was observed at all, and tracking health. Where it cannot be computed,
the tool reports `UNAVAILABLE` and the model is instructed to say so.

## Verification status

The agent loop, tool dispatch, argument validation, tenant scoping, trace
recording, failure recovery and the iteration cap are covered by integration
tests using a scripted provider, against a real database.

The HTTP wire format of the Anthropic and OpenAI adapters has **not** been
exercised against a live provider — both available API keys were out of credit
at the time of writing. That code is therefore the least proven part of this
feature, and the first thing to check when enabling it.
