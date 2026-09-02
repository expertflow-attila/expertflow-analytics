# Tenancy rules

Every user-facing data access starts with the authenticated server session, resolves an organization membership, and then resolves a project that belongs to that organization.

**Never query user-facing project data without organization scope.**

Browser-provided user, organization or project IDs are not authority. Services must re-resolve membership and use compound organization/project predicates. Direct URL manipulation must return not found or forbidden without revealing whether another tenant's record exists.

