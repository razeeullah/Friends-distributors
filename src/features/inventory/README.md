# Inventory

This feature owns the current-balance read model, immutable movement ledger, valuation, low-stock views, and stock adjustment workflow.

- `service.ts` contains transaction-aware server-only primitives: balance lock/create, increase, decrease, adjustment-set, movement creation, and negative-stock enforcement.
- `services.ts` owns adjustment drafts and posting. Posting locks the adjustment and every affected balance, re-reads stock, writes a movement for each item, and completes the adjustment atomically.
- Draft adjustments never alter inventory. Completed adjustments cannot be reposted or edited; corrections must be separate adjustments.
- `inventory_balances` remains the fast current-state lookup; `stock_movements` remains the permanent ledger.
