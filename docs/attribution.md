# Attribution

## What attribution is here

Attribution distributes the revenue of a conversion across the touchpoints that
preceded it. It is a **modelling choice**, not a measurement. This product's
position is that showing one model's answer as if it were the truth is the
central failure of most marketing analytics, so it shows several and quantifies
how much they disagree.

## Models

Given touchpoints ordered by time, each model returns weights summing to 1.

| Model | Weights |
|---|---|
| **First touch** | 100% to the earliest touchpoint |
| **Last touch** | 100% to the latest touchpoint |
| **Linear** | Split evenly across all touchpoints |
| **U-shaped** | 40% first, 40% lead-conversion, 20% split across the rest |
| **Position based** | As U-shaped, with configurable first and lead weights |

### The lead position

For U-shaped and position-based models, the "lead" position is the touchpoint
flagged as having produced the lead. When no touchpoint carries that flag, the
last touchpoint is used instead — which keeps the model a genuine U rather than
silently collapsing it into first-touch.

If there are no middle touchpoints, the first and lead weights are
renormalised so credit is not leaked.

## Worked example

The journey used in the test suite:

```
Facebook (day 0) → Email (day 1, lead) → YouTube (day 5) → purchase €100 (day 10)
```

| Model | Facebook | Email | YouTube |
|---|---|---|---|
| First touch | €100.00 | €0.00 | €0.00 |
| Last touch | €0.00 | €0.00 | €100.00 |
| Linear | €33.34 | €33.33 | €33.33 |
| U-shaped | €40.00 | €40.00 | €20.00 |

## Credit conservation

Every model distributes **exactly** the conversion's revenue, to the minor
unit. Weights are fractional, so amounts are split with an explicit remainder
rule: floor each share, then hand the remaining units to the largest fractional
parts, breaking ties by position.

`33.34 + 33.33 + 33.33 = 100.00`, always. A reconciliation report that is off
by a cent is a report nobody trusts. This is enforced by tests across many
revenue values and every model.

## Window and eligibility

Touchpoints are eligible when they fall within the attribution window before
the conversion. The default is 90 days.

Direct and unknown-source touchpoints can be excluded, as can organic ones.
They are included by default: excluding them silently redistributes their
credit to paid channels and flatters paid performance.

## Refunds

Refunded amounts are removed before attribution. Crediting a channel for money
that was given back is a straightforward way to overstate channel ROI.

## Unattributable conversions

A purchase with no resolvable person has no touchpoint history and cannot be
attributed by any model. Such purchases are **excluded** from attribution
totals and **counted separately** on the Attribution page, so the gap between
reported revenue and attributed revenue is visible rather than mysterious.

## Attribution Confidence

A product-specific metric, and deliberately not called a confidence interval.

```
disagreement = (max across models − min across models) ÷ max
```

| Band | Disagreement |
|---|---|
| `HIGH` agreement | < 20% |
| `MEDIUM` | 20–50% |
| `LOW` | > 50% |

A single-touch journey has zero disagreement: every model necessarily agrees.
A channel that only ever appears first will show total disagreement between
first-touch and last-touch, which is exactly the situation where a single
number would mislead.

The purpose is to make the reader aware that a choice was made on their behalf.

## What this does not do

- It does not claim causality. A touchpoint receiving credit was present, not
  proven responsible.
- It does not do incrementality testing or media mix modelling.
- It does not fingerprint browsers or attempt cross-device matching beyond
  deterministic identifiers.
