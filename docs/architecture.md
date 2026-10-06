# C3 — Community Compute Cloud: Architecture Specification

## Overview

C3 (Community Compute Cloud) is a desktop application designed to allow users to contribute and consume distributed computing resources securely and efficiently.

## Core Architectural Principles

1. **Clean Layering & Dependency Inversion**:
   The codebase is organized into strict layers where inner domain contracts are isolated from outer infrastructure details.

```
React UI (apps/desktop/renderer)
    ↓
Application Services (Preload / IPC Bridge)
    ↓
Domain / Contracts (packages/contracts, packages/*)
    ↓
Infrastructure Adapters (Concrete implementations in future stages)
    ↓
External Systems (AWS, Docker, K3s, Ray, Tailscale)
```

2. **Strict Layer Isolation**:
   - The React UI **NEVER** communicates directly with infrastructure (AWS SDK, Docker, Kubernetes, Ray, filesystem).
   - Every infrastructure component must be behind a replaceable adapter interface.
   - Core domain contracts are completely independent of vendor or technology specifics (e.g. no Docker container IDs or K8s pod names in `@c3/contracts`).

3. **Monorepo Modularization**:
   - Domain logic and interfaces are split into standalone, independent workspace packages under `packages/`.
   - The desktop shell resides under `apps/desktop`.
