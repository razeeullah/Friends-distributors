# Product catalog

This feature owns product, variant, category, brand, and unit management.

- `schemas.ts` validates all form and query inputs, including decimal-string money and quantity values.
- `policy.ts` contains pure duplicate, archive, and permission rules.
- `services.ts` owns transactional writes, tenant-scoped uniqueness checks, default variants, and audit events.
- `queries.ts` owns tenant/location-scoped reads, including database-level filtering, sorting, and pagination.
- `actions.ts` is the Server Action boundary and independently enforces permissions before invoking services.
- The React forms never accept current stock. Inventory remains writable only through inventory workflows.

Prices cross the client boundary as canonical decimal strings and are converted directly to `Prisma.Decimal` in the service layer. The product list reads current stock from `inventory_balances`; it never derives stock from a product field.
