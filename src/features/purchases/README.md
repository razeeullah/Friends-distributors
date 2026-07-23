# Purchases and suppliers

This feature owns supplier profiles, draft purchase orders, receiving, supplier payments, payable summaries, and purchase state transitions.

- Zod contracts accept money and quantities as fixed-precision decimal strings.
- Services recalculate every line and header total with `Prisma.Decimal`; submitted totals are never accepted.
- Drafts can be edited, but ordered or received purchase lines are historical and cannot be silently rewritten.
- Receipt transactions lock the purchase and each inventory balance, update `inventory_balances`, increment the item receipt quantity, and append an immutable `PURCHASE` stock movement.
- Purchase payments are separate records and update paid/balance values under a purchase row lock.
- Server Components own reads, while independently authorized Server Actions own mutations.
