# Business Native analytics UI

## Scope and reference

This is the redesign of the existing sample-data dashboard, not the missing Funnel Intelligence OS v2 application. The user approved this UI work separately from the paused full product implementation.

The palette and typefaces come from the Business Native tokens already present in this repository. The live businessnative.hu website could not be inspected from this environment (proxy HTTP 403), so exact parity with its current design system remains unverified. Compare against the live site before claiming brand approval.

## Visual rules

The user accepted the redesign and explicitly removed the upper-left `bn.` monogram. Keep only the `business native` wordmark and `ANALITIKAI RUTIN` subtitle. In the compact tablet layout the wordmark moves to the topbar.

- Dark background `#0a0a0b`, warm foreground `#f6f3ec`, card `#121212`, lavender accent `#c0c0e7`.
- Light mode uses warm off-white backgrounds and a darker lavender plot color for legibility.
- Geist for headings, interface text and key values. Geist Mono for dates, small category labels and chart axes.
- Numbers use tabular figures, Hungarian formatting, explicit digit grouping and a decimal comma. KPI values are approximately 32–39px; headings 26–36px.
- Panel radius 12px, control radius approximately 8px, chart details 3–4px. Subtle borders, restrained accent fills, no grain overlay or content-hidden-on-scroll animation.
- Desktop sidebar 224px; tablet icon navigation; mobile horizontally scrollable, labelled navigation. Tables scroll inside their panel rather than widening the page.
- Layout order: overview metrics → traffic and sources → funnel → pages → filtered audience details → events → planned measurement tools.

## Interaction and data honesty

- All displayed data remains illustrative. The sample date range is derived from the supplied data, not labelled as current traffic.
- Traffic chart switches between pageviews and visitors, supports pointer inspection, and has an expandable HTML data table for keyboard/touch access.
- Page-row links select the appropriate page and navigate to audience details. The filter affects the detailed sources/devices/browsers/subpages/events panels. The overview and city data remain explicitly labelled as all-page values.
- The funnel is an independent sample dataset; its drop-off note is calculated from those funnel values. It is not presented as a joined analysis of the overview dataset.
- Google Analytics and Plausible are labelled as planned, unconnected integrations; no fake connection action is shown.
- Theme switching persists via the existing theme provider. Controls have focus outlines and accessible names, including collapsed sidebar links. Reduced-motion preferences are respected.

## Validation

The redesign was checked with Playwright at 320, 390, 768, 1024, 1440 and 1920px widths. Checks cover document overflow, chart switching, its 45-day data table, page selection/reset, theme persistence and browser runtime errors. These are targeted UI checks, not proof of Funnel Intelligence OS functionality.

In this cloud environment, Next.js font downloads require the system trust store:

```sh
NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 npm run build
```

This preserves TLS verification. Do not disable certificate verification or replace actual fonts with mocks to pass the build. Both Geist and Geist Mono were verified as loaded in Chromium.

Local review artifacts and the Playwright script are under `/workspace/design-review/`. The handoff document is `/workspace/handoff/GROGBOT-ATADAS.md`. Those directories are outside the Git checkout and need to be transferred separately if required. No push or deployment is implied by this work.
