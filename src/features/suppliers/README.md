# Suppliers

Supplier screens and persistence are implemented in the sibling `features/purchases` module because supplier payable balances and history are defined by purchase and payment records. Suppliers store only their explicit opening balance; current payable is derived from that value plus non-cancelled purchase balances.
