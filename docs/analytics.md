# Analytics definitions

- **Funnel conversion rate** = unique persons reaching the destination node / unique persons entering the source node within the configured window.
- **Drop-off** = source entrants − destination entrants. It is not automatically a failure: optional paths may be valid.
- **Net revenue** = canonical successful purchase and recurring payment amounts + upsells − refunds.
- **Attributed revenue** redistributes canonical revenue across eligible touchpoints. It does not create revenue.
- **LTV** is cumulative net revenue per customer measured to an explicit cohort age. Incomplete windows are shown as incomplete.
- **Opportunity value** = eligible users × conversion-rate improvement × expected downstream revenue per added conversion.
- **Opportunity score** normalizes revenue impact × confidence × reach ÷ effort. Each component must remain visible.
- **Tracking health** combines duplicate rate, missing identity/source, unmatched purchases, delay, schema errors and reconciliation completeness.

All timestamps are stored in UTC; daily reporting uses the organization timezone.
