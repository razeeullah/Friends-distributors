# Retail POS

Production-oriented Point of Sale foundation for a retail business in Pakistan. The project uses Next.js App Router, strict TypeScript, PostgreSQL, Prisma ORM, Tailwind CSS, shadcn/ui, Zod, React Hook Form, Server Actions, first-party cookie sessions, and server-side role/permission authorization.

## Current scope: Phase 8

The application now includes the platform/security foundation and authorized user administration:

- Normalized relational schema for organization, authorization, catalog, customers, suppliers, purchases, inventory, sales, cash management, expenses, auditing, and document sequences.
- PostgreSQL migrations with tenant/location indexes, Decimal financial checks, inventory arithmetic checks, finalized-sale protections, and immutable-ledger triggers.
- Idempotent demo seed for one business, main location/register, owner and cashier, default authorization, categories, units, supplier, customer, products, variants, prices, barcodes, and opening inventory.
- Argon2id password hashing, opaque session tokens, SHA-256 token storage, strict HTTP-only cookies, expiration, logout, disabled-user blocking, account lockout, per-IP attempt throttling, and login audit history.
- Email-or-username login, optional remembered sessions, database-backed location context, password rotation, and other-session revocation.
- Reusable `getCurrentUser()`, `requireUser()`, `requirePermission()`, `requireAnyPermission()`, `requireRole()`, and `requireLocationAccess()` server guards.
- Effective permissions from multiple roles and permission-filtered navigation; protected routes still enforce authorization on the server.
- User list, search, status/role/location filters, sorting, pagination, details, creation, editing, invited/disabled states, default locations, and administrative password reset.
- System and custom role management with module-grouped permissions, module selection, sensitive-grant confirmation, immutable system identifiers, and anti-escalation checks.
- User session inventory with device summaries, last activity, expiration, individual revocation, and bulk revocation.
- Last-admin protection serialized per business, automatic session revocation when users are disabled or passwords reset, and immutable audit records for every sensitive administration action.
- Responsive login and protected application shell with desktop/mobile navigation, account menu, breadcrumbs, page titles, and loading/error/empty states.
- Product list and detail views with tenant/location-scoped search, category/brand/status/low-stock filters, database sorting, pagination, image placeholders, variant counts, prices, and current stock from `inventory_balances`.
- Product create/edit/archive workflows with variants, default-variant support, Decimal-safe prices, business-wide SKU/barcode validation, held-sale archive protection, and audit history.
- Category, brand, and unit management with permission-checked Server Actions and immutable audit records.
- Supplier list, create, edit, and detail workflows with contact/tax information, opening payable balances, active status, purchase history, payment history, and derived current payable balances.
- Draft purchase creation/editing, server-calculated totals, number sequencing, order transitions, partial/full stock receiving, separate supplier payments, and unreceived-purchase cancellation.
- Receipt transactions lock purchase and inventory rows, update `inventory_balances`, and append immutable `PURCHASE` stock movements carrying both purchase and purchase-item references.
- Current inventory, immutable movement ledger, low-stock report, stored-cost valuation, stock-adjustment drafts/details, and protected adjustment posting.
- Transaction-aware inventory primitives lock or create the current balance safely, enforce product negative-stock policy, and create movement rows carrying adjustment references.
- POS checkout is available at `/pos`: product/SKU/barcode search, category filtering, keyboard shortcuts, cart controls, customer selection/quick creation, discounts, price overrides, hold, cash/card/bank/mobile-wallet/credit payment, and receipt printing.
- Checkout reloads product prices, recalculates Decimal totals and tax server-side, requires an open register session, locks inventory balances, appends immutable `SALE` movements, snapshots COGS/profit, records payments/cash movement, audits sensitive pricing/discount changes, and uses an idempotency key.
- Shared PKR money, Asia/Karachi date, pagination, validation, error-normalization, and action-result contracts.
- Unit tests for money handling, dates, pagination, server results, input validation, permission definitions, lockout policy, session tokens, and password hashing.

Sale returns, sales history, register-session opening/closing, and financial reports remain dedicated future phases.

## Requirements

- Node.js 24 or newer
- npm
- PostgreSQL 15 or newer, or Docker with Compose

## Production deployment

Deploy the Next.js application to Vercel or run the supplied Docker image with a managed PostgreSQL service. Configure `DATABASE_URL` with a pooled runtime connection where supplied by the provider; use a direct, SSL-protected connection for migrations when the provider distinguishes the two. Never run the development seed in production: create the first owner through a controlled bootstrap procedure or a one-time, audited administrative script.

Before each release, run `npx prisma migrate deploy`; do not use `prisma migrate dev` in production. Roll back application code independently of database migrations, and use a forward corrective migration for data/schema issues. Take a verified point-in-time backup before migration and test restore procedures at least quarterly.

Required runtime environment variables are `DATABASE_URL`, `AUTH_SESSION_TTL_HOURS`, `AUTH_REMEMBER_ME_TTL_DAYS`, `AUTH_LOCKOUT_ATTEMPTS`, and `AUTH_LOCKOUT_MINUTES`. Seed variables are development-only and must not be set in deployed environments. Configure error tracking through the hosting provider or an approved SDK; do not send passwords, session tokens, payment references, or audit-log payloads to third parties.

`/api/health` is a liveness endpoint; `/api/readiness` verifies database connectivity and should gate traffic. Retain audit logs according to legal/accounting requirements (recommended minimum: seven years for financial activity); archive operational logs separately and test encrypted backups plus point-in-time restore regularly.

The Docker image is multi-stage, uses Node 24, runs as a non-root user, and exposes a liveness health check. `compose.yaml` is intended for local development only; replace its credentials and storage strategy in non-development environments.

## Local setup

1. Install packages:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Set unique `SEED_ADMIN_PASSWORD` and `SEED_CASHIER_PASSWORD` values in `.env`. Each must contain at least 12 characters. Also replace the seed emails, business name, and slug as appropriate. No default password is embedded in the codebase.

4. Start local PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

5. Apply the committed migration and seed the database:

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

6. Start the application:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seed email and password from `.env`.

## Environment variables

All server environment values are validated with Zod on first use. Copy `.env.example` to `.env`; never commit the resulting file.

| Variable                    | Required    | Purpose                                              |
| --------------------------- | ----------- | ---------------------------------------------------- |
| `DATABASE_URL`              | Yes         | PostgreSQL connection string                         |
| `SEED_ADMIN_EMAIL`          | For seeding | Initial owner email                                  |
| `SEED_ADMIN_PASSWORD`       | For seeding | Initial owner password; minimum 12 characters        |
| `SEED_CASHIER_EMAIL`        | For seeding | Initial cashier email                                |
| `SEED_CASHIER_PASSWORD`     | For seeding | Initial cashier password; minimum 12 characters      |
| `SEED_BUSINESS_NAME`        | For seeding | Initial business display name                        |
| `SEED_BUSINESS_SLUG`        | For seeding | Unique initial business slug                         |
| `AUTH_SESSION_TTL_HOURS`    | No          | Session lifetime; defaults to 12 hours               |
| `AUTH_REMEMBER_ME_TTL_DAYS` | No          | Trusted-device session lifetime; defaults to 30 days |
| `AUTH_LOCKOUT_ATTEMPTS`     | No          | Failed-login threshold; defaults to 5                |
| `AUTH_LOCKOUT_MINUTES`      | No          | Temporary lockout duration; defaults to 15 minutes   |

PKR, `Asia/Karachi`, and `en-PK` are application defaults stored in business data or shared utilities rather than environment variables.

## Database commands

```bash
# Create and apply a development migration
npm run db:migrate

# Apply committed migrations in production or CI
npm run db:migrate:deploy

# Seed the complete local demo dataset
npm run db:seed

# Regenerate the Prisma client after schema changes
npm run prisma:generate

# Inspect data locally
npm run db:studio
```

## Development commands

```bash
npm run dev
npm run lint
npm run lint:fix
npm run typecheck
npm run build
npm start
```

`GET /api/health` is a no-store process health endpoint. It intentionally does not claim database readiness.

## Testing and verification commands

```bash
npm run prisma:validate
npm run lint
npm run typecheck
npm run test
npm run test:auth
npm run test:db
npm run test:users
npm run test:catalog
npm run test:purchases
npm run test:inventory
npm run build
```

`npm run check` runs Prisma validation, linting, strict TypeScript checks, and tests together.

## Architecture

```text
prisma/
  schema.prisma              Domain model and indexes
  migrations/                Committed PostgreSQL migration and invariants
  seed.ts                    Idempotent authorization, catalog, and stock bootstrap
src/
  app/                       App Router route groups, API, loading/error states
    (auth)/                  Public authentication routes
    (app)/                   Authenticated shell and module placeholders
    api/health/              Process health route handler
  components/ui/             Owned shadcn/ui component source
  components/layout/         Shell, navigation, breadcrumbs, page titles
  components/forms/          Shared form compositions (reserved boundary)
  components/tables/         Shared table compositions (reserved boundary)
  features/auth/             Validation, password, lockout, session, and RBAC
  features/users/            User/role/session queries, forms, policies, actions, and services
  features/products/         Product catalog queries, forms, policies, actions, and services
  features/purchases/        Supplier, purchasing, receiving, payment, and payable workflows
  features/inventory/        Balance reads, ledger, valuation, and adjustment workflows
  features/audit/            Reusable immutable audit writer
  features/*/                Reserved, isolated business-module boundaries
  generated/prisma/          Generated client (not committed)
  lib/auth/                  Server authentication facade
  lib/db/                    Prisma client boundary
  lib/permissions/           Permission registry facade
  lib/validation/            Zod error utilities
  lib/money/                 BigInt/decimal-string money helpers
  lib/dates/                 en-PK and Asia/Karachi date helpers
  lib/pagination/            Validated pagination inputs and metadata
  lib/audit/                 Audit facade
  lib/server/                Action results and safe error normalization
  lib/services/              Application orchestration boundary (reserved)
  lib/repositories/          Persistence abstraction boundary (reserved)
  types/                     Cross-cutting TypeScript-only types
```

Read [docs/architecture.md](docs/architecture.md) for domain boundaries, security decisions, and database invariants.

## Financial and inventory rules

- Money is stored as PostgreSQL `DECIMAL(20,2)` and exposed as Prisma `Decimal` values.
- Financial services must construct and calculate Prisma Decimal values from strings. JavaScript floating-point arithmetic remains prohibited.
- Fractional stock quantities use PostgreSQL `DECIMAL(20,4)`.
- `inventory_balances` is the fast lookup table; `stock_movements` is the permanent ledger.
- The migration prevents stock movement updates/deletes and verifies `quantityAfter = quantityBefore + quantityChange`.
- The seed creates a matching `OPENING_STOCK` movement for every opening balance and is safe to rerun.
- Completed sales cannot be deleted. Corrections must be represented as a void or return and corresponding reversal movements.
- Sale items snapshot product identity, charged price, unit cost, COGS, and gross profit.
- Product forms cannot edit stock. Catalog reads use `inventory_balances`; future purchases, returns, transfers, and adjustments must write both balances and immutable ledger movements transactionally.
- Gross profit is persisted from backend-owned sale calculations. Net profit will be derived in the reporting phase from recognized gross profit and approved expenses.

## Authentication and authorization

- Passwords use Argon2id with a 64 MiB memory cost and three iterations.
- Browsers receive a random 256-bit session token. PostgreSQL stores only its SHA-256 hash.
- Production uses a `__Host-` prefixed, Secure, HTTP-only, SameSite=Strict cookie.
- Sessions expire after 12 hours by default and are rejected immediately for disabled or archived users.
- Remembered sessions expire after 30 days by default and use the same hashed-token and cookie controls.
- Five failed password attempts lock an account for 15 minutes by default. Environment values can tune both limits.
- Repeated failures from one IP are throttled independently.
- Password changes require the current password, enforce a strong replacement, revoke every old session, rotate the current token, and create an immutable audit record.
- Users may inherit permissions from multiple roles and may access only their assigned active locations.
- User management requires `user.manage`; role changes require `role.manage`. Only `role.manage.unrestricted` may grant permissions beyond the actor's own effective access.
- The final active `SUPER_ADMIN` or `OWNER` cannot be disabled or stripped of protected access. The check and update share a business-scoped transaction lock.
- Disabling a user or resetting a password revokes active sessions in the same transaction. Administrative session revocations are also audited.
- UI visibility never grants access. Every sensitive Server Action or handler must call `requirePermission()` before reading or mutating protected data.
- Login success, failure, lockout, blocked login, logout, and the seed bootstrap create audit evidence.

## Default roles

- `SUPER_ADMIN`
- `OWNER`
- `MANAGER`
- `CASHIER`
- `INVENTORY_STAFF`
- `ACCOUNTANT`

The seed assigns least-privilege defaults from the central permission registry in `src/features/auth/permissions.ts`. Roles and permissions remain business-scoped except for the global permission catalog.

## Production deployment notes

- Use a managed PostgreSQL service with TLS, backups, point-in-time recovery, and connection limits appropriate for the application plan.
- Set `DATABASE_URL` only in the deployment environment; never commit `.env` files.
- Apply migrations with `npm run db:migrate:deploy` before promoting application traffic.
- Run the seed only for a new business, then change the owner password through the account or user-management screen.
- Serve production exclusively over HTTPS so the `__Host-` session cookie is accepted.
- Treat `stock_movements`, `audit_logs`, `login_attempts`, and cash-register movements as append-only records. Corrections use compensating entries.
- Back up the database before every migration and test restore procedures regularly.
