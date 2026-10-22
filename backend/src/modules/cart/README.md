# Cart module — Workflow 2

Contract: `docs/contracts/cart.md`. Customer identity comes from `CurrentActorPort`; the module never accepts a customer ID from a request. `GET /api/v1/cart`, `PUT /api/v1/cart/items/{listingId}` and `DELETE /api/v1/cart/items/{listingId}` use the module-owned ports and return the contract `CartView`.

PUT sets the final quantity, rejects missing or unavailable listings, and updates an existing listing item in place. DELETE is idempotent. GET creates an empty cart for a first-time customer and projects current listing data; an item whose listing no longer has a projection remains visible as unavailable. Price and availability are display-only. `CartReaderPort.getForCheckout` returns `cartId`, `listingId`, `quantity` and the internal `lastViewedUnitSalePrice`.

Workflow 3: every returned CartView records each item's displayed `unitSalePrice` as `lastViewedUnitSalePrice` (saved only after the view is built; dropped for items without a projection). It is not part of the public `CartView` and is not a locked price; Orders only compares it with the server quote to raise `PRICE_CHANGED`. See `../orders/README.md` for the full decision.

`InMemoryCartStore` is a module-local Phase A adapter, not persistent storage. The composition root supplies the three port adapters through `CartModule.register({ currentActor, store, listingProjection })`; real database and identity/listing adapters remain Workflow 8 integration work.

Run the existing contract harness from repository root with `pnpm.cmd --dir backend exec vitest run src/modules/cart/tests`. Compile independently with `pnpm.cmd --dir backend exec tsc -p src/modules/cart/tsconfig.json`.
