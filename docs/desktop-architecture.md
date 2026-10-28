# C3 Desktop Architecture & Stage 2 Specification

## Overview

The `@c3/desktop` package provides the Electron desktop runtime environment for the Community Compute Cloud (C3) platform. Stage 2 establishes a hardened, multiprocess architecture based on Electron, React 18, and Vite, adhering to strict process isolation, typed IPC contracts, and defense-in-depth security.

---

## Process Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Electron Main Process                         │
│  (Node.js host, full OS access, window management, app lifecycle)     │
│                                                                        │
│  • App Lifecycle (BaseLifecycle)                                       │
│  • StructuredLogger (@c3/foundation)                                  │
│  • BrowserWindow Factory & webPreferences hardening                    │
│  • IPC Handler Registry (shell:ping, shell:get-version, etc.)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Preload    │ contextBridge (window.c3Shell)
                         Boundary   │ safeInvoke allowlist
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Chromium Renderer Process                       │
│  (Chromium Sandbox, React 18 UI, contextIsolation: true)              │
│                                                                        │
│  • Strict CSP Enforcement                                              │
│  • Node Integration Disabled (`nodeIntegration: false`)                │
│  • OS Sandbox Enforced (`sandbox: true`)                               │
│  • Renderer App Boundary & ErrorBoundary                               │
│  • useShellInit & shellService layer                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Process Responsibilities

### 1. Main Process (`apps/desktop/src/main/`)
- Manages application lifecycle (`BaseLifecycle`) and native window creation (`BrowserWindow`).
- Registers IPC handlers (`registerShellIpcHandlers`) to service renderer requests.
- Enforces runtime navigation guards (`will-navigate`, `setWindowOpenHandler`).
- Contains **ZERO** business logic. Delegates requests to application services.

### 2. Preload Script (`apps/desktop/src/preload/`)
- Runs in an isolated JS context (`contextIsolation: true`) with access to `contextBridge`.
- Exposes ONLY approved, strongly-typed methods via `window.c3Shell`.
- Filters IPC requests against a strict allowlist (`ALLOWED_INVOKE_CHANNELS`).
- Unwraps IPC response envelopes and deserializes `AppError` instances cleanly across the process boundary.

### 3. IPC Contract Boundary (`packages/contracts/src/ipc.ts`)
- Defines standard message envelopes (`IpcResponseSuccess`, `IpcResponseFailure`).
- Maps strongly-typed request/response payloads (`IpcChannelMap`).
- Standardizes IPC channel names (`IPC_CHANNELS`).

### 4. React Renderer Process (`apps/desktop/src/renderer/`)
- Pure presentation and renderer lifecycle layer built with React 18.
- Communicates with desktop capabilities strictly via `window.c3Shell`.
- Implements explicit discriminated state transitions (`initializing` → `ready` | `error`).
- Traps uncaught visual rendering errors using `ErrorBoundary`.

---

## Application Startup Sequence

```
1. Electron app.whenReady()
         ↓
2. appLifecycle.start()
         ↓
3. registerShellIpcHandlers() attaches IPC listeners
         ↓
4. createMainWindow() instantiates BrowserWindow with hardened webPreferences
         ↓
5. Preload script (dist-electron/preload/index.js) loaded & contextBridge exposed
         ↓
6. loadRenderer() loads dist-renderer/index.html (prod) or VITE_DEV_SERVER_URL (dev)
         ↓
7. React Renderer mounts, useShellInit calls window.c3Shell.ping() and getVersion()
         ↓
8. Renderer reaches Ready state; BrowserWindow fires 'ready-to-show' and displays UI
```

---

## Application Shutdown Sequence

```
1. Window close / Quit event triggered
         ↓
2. window-all-closed handler calls appLifecycle.stop()
         ↓
3. unregisterShellIpcHandlers() removes all IPC listeners
         ↓
4. mainWindow.close() cleanly destroys window references
         ↓
5. app.quit() terminates Electron main process cleanly
```

---

## Development vs Production Runtimes

| Aspect | Development Runtime | Production Runtime |
|--------|---------------------|--------------------|
| **Renderer Source** | Vite Dev Server (`VITE_DEV_SERVER_URL` or `http://localhost:5173`) | Bundled static HTML (`dist-renderer/index.html`) |
| **Main Process** | Transpiled on-the-fly via `vite-plugin-electron` | Compiled CJS bundle (`dist-electron/main/index.js`) |
| **Preload Script** | Transpiled on-the-fly (`src/preload/index.ts`) | Compiled CJS bundle (`dist-electron/preload/index.js`) |
| **DevTools** | Opened automatically in detached mode | Disabled by default |
| **Logger Output** | Debug-level verbose console output | Structured JSON logs (level `info` and above) |

---

## Security Model & Hardening

1. **`contextIsolation: true`:** Prevents renderer code from accessing Node.js runtime or preload internal prototypes.
2. **`nodeIntegration: false`:** Disables Node globals (`require`, `process`, `Buffer`, `module`) in the renderer process.
3. **`sandbox: true`:** Executes renderer inside OS Chromium sandbox.
4. **Content Security Policy (CSP):** `<meta>` tag strictly restricts script, style, connection, and object sources (`object-src 'none'`, `script-src 'self'`).
5. **IPC Channel Allowlist:** `safeInvoke` rejects any unapproved IPC channel invocation with `ERR_IPC_BLOCKED`.
6. **Navigation Guarding:** `will-navigate` blocks unauthorized external URL redirects. `setWindowOpenHandler` routes external links to system default browser.

---

## Testing Strategy

- **Unit Tests (`tests/unit/`):** Test isolated foundation logic, logger, error models, renderer state machine, and IPC handler adapters.
- **Integration Tests (`tests/integration/`):** Test multi-component interactions, IPC envelope serialization/deserialization, security allowlist enforcement, build output bundles, and real Electron process execution.
- **Real Electron Test Runner (`scripts/test-electron-runner.js`):** Spawns real `electron.exe` with compiled production bundles (`dist-electron/main/index.js`), verifying main startup, window creation, preload injection, IPC dispatch, and clean exit.

---

## Rules for Future Feature Stages

> **CRITICAL ARCHITECTURAL MANDATE:**
> Stage 3 and later feature modules must communicate through application-service contracts and the existing desktop boundaries. Feature logic must not be placed directly into Electron main, preload, or React bootstrap code.

1. **Dependency Direction:**
   `Renderer → Preload Bridge (window.c3Shell) → IPC Transport → Application Services → Contracts → Infrastructure`
2. **No Direct Node/Electron Imports:** Renderer components must NEVER import `electron`, `node:*`, `fs`, `child_process`, `aws-sdk`, `dockerode`, etc.
3. **IPC Channel Extensions:** Any new IPC capability must be defined first in `@c3/contracts`, registered in `ipc-handlers.ts`, and exposed via `C3ShellAPI` in preload.
