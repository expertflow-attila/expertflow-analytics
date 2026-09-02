# Contributing

## Setup

```bash
cp .env.example .env
# generate AUTH_SECRET and ENCRYPTION_KEY, see README
pnpm install
docker compose up -d      # or a local PostgreSQL
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Before opening a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Integration tests need a database. They default to
`postgres://fios:fios@localhost:5432/fios_test`; override with
`TEST_DATABASE_URL`.

## What this project asks of a change

**Analytics changes need a test with a known answer.** If you change a funnel,
attribution, LTV or opportunity rule, add or update a fixture whose correct
result can be worked out by hand. The existing golden tests are the model.

**Keep the calculation engines pure.** Anything in `src/lib/analytics/` takes
plain data and returns plain data — no database, no network, no clock it was
not given. Database work belongs in `src/server/analytics/`.

**Never invent a number.** If a metric cannot be computed from available data,
return `null` and let the interface say so. Guessing at a CAC, extrapolating an
LTV horizon that has not elapsed, or defaulting a confidence score are all
treated as bugs.

**Every query is tenant-scoped.** Take a `TenantContext`, never a bare project
id.

**Document new metrics.** A metric that is not defined in `docs/analytics.md`
does not exist as far as this project is concerned.

## Commits

Conventional commits: `feat(scope):`, `fix(scope):`, `docs:`, `test:`,
`refactor:`. Say what changed and why the change was needed.

## Reporting a wrong number

Bugs where the software reports an incorrect figure are the highest priority
issue this project has. Please include the metric, what it showed, what you
expected, and enough of the underlying data to reproduce it.
