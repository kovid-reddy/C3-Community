# C3 — Community Compute Cloud

C3 is a desktop application enabling users to contribute and consume distributed computing resources securely and efficiently.

## Stage 0 Architecture

This repository is currently in **Stage 0 (Architecture & Contracts Foundation)**. No concrete infrastructure or cloud services are implemented in this stage.

### Monorepo Structure

- **`apps/desktop`**: Electron + React + Vite desktop shell.
- **`packages/contracts`**: Pure interface definitions and domain types.
- **`packages/foundation`**: Shared utilities, structured logger contracts, centralized config interfaces, and common `AppError` taxonomy.
- **`packages/auth`**: Authentication service contracts & interfaces.
- **`packages/cloud`**: Cloud persistence repository contracts.
- **`packages/hardware`**: Hardware inspection service contracts.
- **`packages/provider`**: Provider-side lifecycle interfaces.
- **`packages/discovery`**: Compute provider discovery & advertisement contracts.
- **`packages/cluster`**: Cluster management contracts.
- **`packages/compute`**: Distributed compute orchestrator interfaces.
- **`packages/jobs`**: Job lifecycle interfaces.
- **`docs/`**: Comprehensive architectural specifications and design rules.
- **`tests/`**: Unit, integration, and E2E test suites.

## Getting Started

```bash
npm install
npm run build
npm test
```
