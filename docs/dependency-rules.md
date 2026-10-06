# Dependency & Import Rules

1. **No Circular Dependencies**:
   Modules must maintain a directed acyclic graph (DAG). No package under `packages/` may import another package in a cyclic loop.

2. **No Direct Infrastructure Access from UI**:
   The `renderer` process in `apps/desktop` is strictly isolated. It must NEVER import AWS SDK, Docker clients, K8s libraries, Ray APIs, or Node `fs`/`child_process` modules.

3. **No Infrastructure Implementation Details in Contracts**:
   Types in `@c3/contracts` must remain technology-agnostic. No Docker container IDs, K3s tokens, Ray job IDs, or DynamoDB hash keys.

4. **Public API Enclosure**:
   No module may import another module's internal source files directly (e.g. import from `@c3/auth` root index only, never `@c3/auth/src/internal/xxx`).

5. **Communication Boundary**:
   Modules interact via public TypeScript contracts and interfaces defined in `@c3/contracts` or exported from package roots.

6. **Replaceable Infrastructure**:
   All external systems (AWS, Docker, K8s, Ray, Tailscale) must be encapsulated behind abstract strategy adapters.
