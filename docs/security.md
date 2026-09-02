# Security

- Sessions use Auth.js signed HTTP-only cookies and server-side verification.
- Passwords are hashed with bcrypt cost 12; plaintext passwords are never stored.
- RBAC is centralized in `hasPermission`.
- All forms use Zod runtime validation.
- Project services enforce organization membership and compound tenant predicates.
- Audit metadata must never contain passwords, tokens or provider secrets.
- Public errors are intentionally generic; health output never includes connection details.
- Production requires unique `AUTH_SECRET`, `DATABASE_URL` and canonical `APP_URL`.

