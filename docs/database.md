# Database

```mermaid
erDiagram
  USER ||--o{ MEMBERSHIP : has
  ORGANIZATION ||--o{ MEMBERSHIP : grants
  ORGANIZATION ||--o{ PROJECT : owns
  ORGANIZATION ||--o{ AUDIT_LOG : records
  PROJECT ||--o{ AUDIT_LOG : scopes
```

All external identifiers are UUIDs. Timestamps are stored with timezone in UTC. A project belongs to exactly one organization. Membership is unique per user and organization.

Future events, people, sessions, funnels, orders, integrations and attribution records will carry both project and organization scope.

