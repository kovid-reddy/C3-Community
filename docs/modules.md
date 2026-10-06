# Module Responsibilities

| Module | Location | Responsibilities | Dependencies |
| :--- | :--- | :--- | :--- |
| **Foundation** | `packages/foundation` | Shared infrastructure: error model, logging contracts, config interface, ID generators, common utilities. No C3 business logic. | `@c3/contracts` |
| **Contracts** | `packages/contracts` | Shared TypeScript domain interfaces, types, and core public service contracts. Zero logic or side effects. | None |
| **Authentication** | `packages/auth` | User registration, login, logout, session restoration, identity interfaces. Replaceable via `AuthProviderAdapter`. | `@c3/contracts`, `@c3/foundation` |
| **Cloud** | `packages/cloud` | Cloud persistence & repository abstractions (users, providers, sessions, credits, jobs). Database-agnostic interfaces. | `@c3/contracts`, `@c3/foundation` |
| **Hardware** | `packages/hardware` | Local machine resource inspection (CPU, GPU, RAM, Disk, OS). Completely decoupled from React/AWS/K8s/Ray. | `@c3/contracts`, `@c3/foundation` |
| **Provider** | `packages/provider` | Provider-side lifecycle management (start/stop provider, accept/decline consumer requests, status, resources). | `@c3/contracts`, `@c3/foundation` |
| **Discovery** | `packages/discovery` | Node discovery and advertisement interfaces across LAN, cloud, or overlay networks. | `@c3/contracts`, `@c3/foundation` |
| **Cluster** | `packages/cluster` | Cluster lifecycle orchestration (create, start, stop, node join/leave). Hides container/K8s details from UI. | `@c3/contracts`, `@c3/foundation` |
| **Compute** | `packages/compute` | Generic distributed compute orchestration (start/stop compute, submit job). Decoupled from Ray. | `@c3/contracts`, `@c3/foundation` |
| **Jobs** | `packages/jobs` | C3-level job lifecycle management (submit, track status, logs, results). Hides engine specifics. | `@c3/contracts`, `@c3/foundation` |
| **Desktop UI** | `apps/desktop` | Electron shell + React renderer. Displays app state, collects input, invokes IPC bridge. | All packages |
