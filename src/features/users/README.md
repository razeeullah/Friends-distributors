# Users, roles, and sessions

This feature owns business-scoped user administration, custom and system role editing, permission assignment policy, session management, Zod contracts, Server Actions, and React Hook Form screens.

Key invariants:

- `user.manage` protects every user mutation and session revocation.
- `role.manage` protects every role or permission mutation.
- Without `role.manage.unrestricted`, an actor cannot grant permissions they do not possess.
- The last active `SUPER_ADMIN` or `OWNER` cannot lose protected access.
- Disabling users and resetting passwords revoke sessions transactionally.
- Password hashes and raw session tokens are never selected for administration views or written to audit metadata.
