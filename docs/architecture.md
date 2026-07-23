# Architecture and invariants

## Modular boundaries

The App Router is the delivery layer. Server Components perform internal reads directly, and Server Actions own UI mutations. Route handlers should be added only for external clients, webhooks, or HTTP-cacheable APIs.

Feature code lives below `src/features`. Authentication and auditing are already isolated. Future phases should add sibling modules such as `features/sales`, `features/purchases`, `features/inventory`, and `features/expenses`. A feature owns its Zod contracts, permission guard, transaction service, and tests. Pages should orchestrate those services rather than reproduce business rules.

## Tenant boundary

All operational records belong to a `Business`. Locations belong to one business. Service functions must derive `businessId` from the authenticated session, never from submitted form data, and include it in every lookup. Submitted record IDs must be re-queried within that business boundary before use.

## Financial representation

Money fields use PostgreSQL `DECIMAL(20,2)` and Prisma `Decimal`. Backend services will calculate line subtotals, discounts, taxes, totals, COGS, change, gross profit, and refunds from trusted product, tax, and inventory records. Frontend totals are presentation-only and must be ignored on write.

Quantities use fixed precision `DECIMAL(20,4)`. Transaction services must create Prisma Decimal values from validated decimal strings and keep all monetary and quantity arithmetic in Decimal space. Converting either to JavaScript `number` is prohibited in financial logic.

## Inventory write contract

Every inventory mutation must run in one PostgreSQL transaction:

1. Lock or atomically update the relevant `inventory_balances` row.
2. Validate sufficient stock and the source document state.
3. Calculate quantity before and after.
4. Update the balance.
5. Insert one immutable `stock_movements` record with the user and document reference.
6. Update the source document status.
7. Insert an audit record.

Transfers create paired `TRANSFER_OUT` and `TRANSFER_IN` ledger entries. Voids and refunds create compensating entries; they never edit old movements. The migration enforces movement arithmetic and blocks updates/deletes.

Stock adjustments are two-stage. A draft stores the entered counted quantity and a read-only system snapshot but writes no balance or movement. Posting locks the adjustment record and balance row, re-reads live stock, verifies the selected direction and negative-stock policy, updates the balance, snapshots the live system quantity, inserts exactly one immutable adjustment movement for each item, completes the adjustment, and inserts an audit record. A completed adjustment is never edited or reposted; a correction is a new adjustment.

## Product catalog contract

Catalog mutations validate decimal strings with Zod and construct `Prisma.Decimal` values directly from those strings. SKU and barcode checks are tenant-scoped and serialized with a business-level PostgreSQL advisory transaction lock; database unique constraints remain the final race-condition defense. Products with no submitted variants receive one default variant.

Catalog forms never accept current stock. Product reads join the selected location's `inventory_balances` records, while all future inventory-changing workflows must follow the inventory write contract above. Products are archived with their variants rather than deleted. An item referenced by a held sale cannot be archived until that held cart is resolved.

## Purchase write contract

Draft purchase line totals are recalculated on the server with `Prisma.Decimal`. Marking a draft as ordered does not change inventory. Receiving locks the purchase row and each applicable `inventory_balances` row, verifies the remaining ordered quantity, updates the balance and weighted average cost, increments `PurchaseItem.receivedQuantity`, and inserts an immutable `PURCHASE` movement in the same transaction. Each movement identifies the purchase in `referenceId` and the purchase item in `referenceLineId`.

Only draft purchases can be edited. Ordered or partially/fully received purchases cannot have historical lines or costs silently rewritten. Unreceived and unpaid draft/ordered purchases may be cancelled. Supplier payments are separate records and update `paidAmount` and `balance` under a purchase row lock.

## Sales write contract

A future sale service must ignore submitted totals, reload each active variant, authorize discounts/overrides, obtain current inventory cost, and calculate all values in the transaction. Every `SaleItem` stores product identity snapshots, original and charged unit prices, the cost used at sale time, COGS, and gross profit. A completed sale and its items are historical records. The database blocks deletion, and application code must expose only void/refund paths.

## Authorization contract

Layouts provide navigation protection, but they are not the authorization boundary. Each server read and mutation calls `requirePermission()` with a central typed permission key. Services then enforce business and location ownership. The browser may hide unavailable controls for usability, but no backend decision depends on that state.

User administration uses `user.manage`, while role and permission mutation uses `role.manage`. A role manager may grant only permissions already present in their effective permission set unless they hold `role.manage.unrestricted`. Submitted role, permission, location, user, and session identifiers are always resolved within the authenticated business.

`SUPER_ADMIN` and `OWNER` are protected administrative roles. Removing the last active protected administrator is checked after acquiring a business-scoped PostgreSQL transaction lock, preventing concurrent updates from bypassing the invariant. System role codes are never accepted as editable input.

## Authentication contract

The login Server Action validates email-or-username input, uses a constant dummy hash for unknown accounts, records every attempt, applies user lockout and an IP failure ceiling, and issues an opaque session token only after a successful transaction. Only the token hash is persisted. Session resolution rejects expired, revoked, disabled, or archived accounts on every request and loads effective roles, permissions, and active location assignments.

Remember-me changes only the bounded session lifetime; it does not weaken cookie or token controls. Password changes require the current password, revoke all existing sessions, create a rotated session, and write an audit record in the same transaction. Navigation filtering is a usability layer only—every protected server read and mutation must still call the relevant permission or location guard.

Administrative password resets and user disabling revoke all target sessions atomically. Session management exposes metadata and identifiers but never the stored token hash. `lastSeenAt` is refreshed at a bounded interval during valid session resolution.

## Audit contract

Sensitive operations insert an `audit_logs` row in the same database transaction as the protected change. The row records actor, action, entity, optional before/after JSON, request metadata, and timestamp. Database triggers make audit records immutable. Secrets, passwords, raw session tokens, and full payment credentials must never be placed in audit metadata.

## Recommended implementation phases

1. Inventory transfers.
2. Cash-register sessions and backend-calculated sales.
3. Customer returns, refunds, and sale voids.
4. Expenses and approvals.
5. Business settings.
6. Sales, inventory, gross-profit, and net-profit reports.

Each phase should include schema changes only when necessary, Zod validation, permission tests, transaction integration tests against PostgreSQL, audit assertions, UI states, lint, typecheck, unit tests, and a production build.
