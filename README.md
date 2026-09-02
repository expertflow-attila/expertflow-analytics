# Funnel Intelligence OS

An open-source, revenue-focused funnel analytics system. Phase 1 provides the secure SaaS foundation: authentication, organizations, projects, RBAC, tenant isolation, settings and audit logs.

## Local setup

Requirements: Node.js 22+, npm and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Development seed login: `demo@funnel.local` / `DemoPassword123!`. Never use this seed in production.

## Validation

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Environment

- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: random secret, minimum 32 characters
- `APP_URL`: canonical application URL

See `docs/architecture.md`, `docs/database.md`, `docs/tenancy.md` and `docs/security.md`.

