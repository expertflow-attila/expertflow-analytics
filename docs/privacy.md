# Privacy

This document describes what the software stores and the controls it provides.
It is **not** a compliance certification. The project is built to be
privacy-conscious; whether a given deployment is GDPR-compliant depends on how
it is configured, hosted and operated, and that assessment is the operator's.

## What is stored

| Category | Fields |
|---|---|
| Behaviour | Event name, timestamp, page URL and path, referrer |
| Acquisition | UTM parameters, derived channel |
| Context | Device type, browser family, two-letter country, locale |
| Identity | Anonymous browser id; and, once identified, email, name, your own user id, payment customer id, CRM contact id |
| Commerce | Orders, payments, refunds, subscriptions |

## What is deliberately not collected

- No browser or canvas fingerprinting
- No cross-site tracking
- No full IP address storage (IP is used transiently at most; projects carry an
  anonymisation flag)
- No automatic capture of form field values
- No session recording or heatmaps

## Identity

A person record is created only when a **deterministic** identifier appears —
one your own systems asserted. Probabilistic matching is not implemented, by
design: a wrong merge joins two real humans' histories, which is both a privacy
failure and an analytics failure.

Identity decisions are appended to `identity_links`, so any merge can be traced
and explained.

## Storage

Data is stored in your own PostgreSQL database. This is self-hosted software;
no telemetry is sent anywhere by the application.

Secrets — integration credentials and bring-your-own AI keys — are encrypted at
rest with AES-256-GCM. API keys are stored hashed. Nothing sensitive is placed
in browser storage; the SDK keeps only an anonymous id, a session id, captured
UTM parameters, a pending event queue and a consent flag, all in the visitor's
own `localStorage`.

## Consent

The SDK supports consent gating:

```html
<script src="/sdk.js" data-project-key="pk_..." data-require-consent="true"></script>
```

```js
funnel.consent.grant()    // start sending
funnel.consent.revoke()   // stop sending and discard the queue
funnel.consent.status()
```

With `data-require-consent="true"` no event leaves the browser until consent is
granted. Revoking discards anything queued.

## Retention

Each project carries a retention setting: 30, 90, 180, 365 days or unlimited.
Deletion is intended to run as a scheduled job.

**Current limitation:** the retention setting is stored and displayed but the
cleanup job is not yet implemented, so no data is currently deleted
automatically. This is stated plainly rather than implied to work.

## Subject requests

The data model supports export and deletion per person — events, sessions,
touchpoints, orders and identity links all reference `person_id`, and person
deletion cascades.

**Current limitation:** there is no user interface or endpoint for export or
deletion yet. Today these require direct database access.

## Cookies

The application itself sets one cookie, for your team's authentication session.
The tracking SDK sets **no cookies**; it uses `localStorage` on the tracked
site's own origin.
