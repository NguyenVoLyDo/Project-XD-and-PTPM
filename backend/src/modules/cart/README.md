# Cart module — Workflow 1

Contract: `docs/contracts/cart.md`. The module owns its DTO, ports, local mocks and fixtures. `CartReaderPort.getForCheckout` returns only `cartId`, `listingId` and `quantity`; displayed price is a projection, never a checkout price. `InMemoryCartStore` is a test adapter, not persistent storage.

Run from repository root: `pnpm.cmd --dir backend exec vitest run src/modules/cart/tests`. Compile independently with `pnpm.cmd --dir backend exec tsc -p src/modules/cart/tsconfig.json`. Nest's `CartModule` is a shell; Workflow 2 adds behavior and HTTP routes.
