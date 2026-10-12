# Orders module — Workflow 1

Contract: `docs/contracts/orders.md`, with consumer ports shaped by Common, Cart, Listings, Inventory, Fulfillment and Payments v1. All mocks and fixtures live here. Checkout prices come from `ListingsQuotePort`, never from Cart. The two checkout fixtures use one Supplier and two Sellers. `CheckoutTransactionContext` is intentionally opaque; Common's adapter will replace the local mock in Phase B.

Run from repository root: `pnpm.cmd --dir backend exec vitest run src/modules/orders/tests`. Compile independently with `pnpm.cmd --dir backend exec tsc -p src/modules/orders/tsconfig.json`. Nest's `OrdersModule` is a shell. Mocks prove wiring and contract shapes only; `MockTransaction` does not provide rollback, locking or outbox-after-commit semantics. Those are verified in later workflows and PostgreSQL integration.
