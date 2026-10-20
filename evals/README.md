# Regression evals

These are **local tests**, not production smoke tests. They create accounts, projects,
keys, integrations and events in the isolated database at `127.0.0.1:55432/fios`.
Never point them at a database containing real customer data. Generated artifacts,
including local test cookies in traces, are ignored by Git.

Prerequisites: the repository's pinned pnpm/Node toolchain, Chromium (default
`/usr/bin/chromium`, or `CHROMIUM_PATH`), and PostgreSQL 17. Use a dedicated container:

```sh
docker run -d --name fios-eval-postgres -e POSTGRES_USER=fios -e POSTGRES_PASSWORD=fios \
  -e POSTGRES_DB=fios -p 127.0.0.1:55432:5432 postgres:17-alpine
# After pg_isready succeeds:
docker exec fios-eval-postgres createdb -U fios fios_test
```

Create a local `.env` using `.env.example`. Set DATABASE_URL to
`postgres://fios:fios@127.0.0.1:55432/fios`, TEST_DATABASE_URL to the same host/port
with database `fios_test`, NEXT_PUBLIC_APP_URL and AUTH_URL to `http://localhost:3100`,
and AUTH_TRUST_HOST to `true`. Generate fresh AUTH_SECRET and ENCRYPTION_KEY locally.
An empty optional CRON_SECRET is supported. Do not configure live AI
keys for this suite. The second app process below uses a completely local mock.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm test:engines
pnpm typecheck
pnpm lint
NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 pnpm build
pnpm exec next start --port 3100
```

In a second terminal, from the repository root:

```sh
OPENAI_API_KEY=audit-local-mock NODE_OPTIONS="--require $(pwd)/evals/mock-provider.cjs" \
  AUTH_URL=http://localhost:3101 NEXT_PUBLIC_APP_URL=http://localhost:3101 \
  pnpm exec next start --port 3101
```

In a third terminal:

```sh
pnpm test:e2e
```

`mock-provider.cjs` intercepts provider requests locally; do not use it in deployment.
The security test verifies a foreign conversation is unchanged and its history is
never sent to this mock. A positive test separately verifies own-project AI still
works. This does not certify a real Anthropic/OpenAI/Ollama service.

Results: `evals/artifacts/results.json`; screenshots and optional failure traces are
in that directory. To run one scenario, pass `--grep` to the Playwright CLI. For a
fresh workspace run the full suite; the account/workspace test supplies fixtures
used by subsequent security cases. API tests create their own fixture when needed.

The protocol and findings are in `docs/evals/`. Six negative regression cases must
stay green before a release; a successful route render cannot substitute for them.
