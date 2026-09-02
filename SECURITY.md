# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's security advisory
feature on this repository rather than opening a public issue.

Include the affected version or commit, reproduction steps, and the impact you
believe it has. You will get an acknowledgement, and a fix or an explanation of
why the behaviour is intended.

## Scope

This is self-hosted software. The maintainers do not operate an instance
holding anyone else's data, so reports concern the code rather than a service.

Particularly interested in:

- Cross-tenant data access
- Authentication or authorization bypass
- Insecure direct object references
- Ingestion endpoint abuse
- Secret exposure through logs, errors or the client bundle

## Deploying safely

- Set a strong, unique `AUTH_SECRET` and `ENCRYPTION_KEY`
- Never commit `.env`
- Serve over HTTPS
- Treat secret API keys (`sk_`) as credentials; they can write events on behalf
  of a project
- Publishable keys (`pk_`) are safe in a browser and can only write events
- Rotating `ENCRYPTION_KEY` requires re-encrypting stored integration secrets
