# C3 Desktop Shell Specification & Architecture (Stage 2A)

## Overview

The `@c3/desktop` package provides the Electron desktop runtime shell for the Community Compute Cloud (C3) application. It establishes a secure, multiprocess platform foundation built on Electron, React, and Vite, strictly adhering to the C3 security and process separation principles established in Stage 0 and Stage 1.

---

## Process Topology & Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             Main Process                                 │
│  (Node.js runtime, full system access, window management, lifecycle)      │
│                                                                          │
│  • BaseLifecycle integration                                            │
│  • StructuredLogger (@c3/foundation)                                    │
│  • Window factory (BrowserWindow, webPreferences hardening)              │
│  • IPC Handler Registry (shell:ping, shell:get-version)                  │
└───────────────────┬──────────────────────────────────▲───────────────────┘
                    │                                  │
         Preload    │ contextBridge                    │ IPC invoke
         Boundary   │ (window.c3Shell)                 │ (allowlist only)
                    ▼                                  │
┌──────────────────────────────────────────────────────────────────────────┐
│                           Renderer Process                               │
│  (Chromium sandbox, React 18 UI, no Node.js access)                       │
│                                                                          │
│  • Strict CSP meta tag                                                  │
│  • Context isolated (`contextIsolation: true`)                           │
│  • Sandbox enforced (`sandbox: true`)                                    │
│  • Node integration disabled (`nodeIntegration: false`)                  │
│  • Exclusively uses window.c3Shell for IPC                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Security Model

The desktop shell enforces defense-in-depth across 5 layers:

| Layer | Implementation | Description |
|-------|----------------|-------------|
| **1. Context Isolation** | `contextIsolation: true` | Prevents renderer JavaScript from accessing Node.js runtime or preload internal prototypes. |
| **2. Node Integration** | `nodeIntegration: false` | Disables Node.js globals (`require`, `process`, `Buffer`, `global`) inside the renderer window. |
| **3. Chromium Sandbox** | `sandbox: true` | Runs the renderer in an OS-level Chromium sandbox with restricted system access. |
| **4. Content Security Policy** | Enforced via `<meta>` tag in `index.html` | Blocks unauthorized inline scripts (`script-src 'self'`), object execution (`object-src 'none'`), and external frame navigation (`base-uri 'none'`). |
| **5. IPC Allowlist Bridge** | `contextBridge.exposeInMainWorld('c3Shell', ...)` | Exposes ONLY safe, typed methods (`ping()`, `getVersion()`) rather than raw `ipcRenderer`. |

---

## Build Topology (Vite + Electron)

The desktop app uses Vite for bundling both the renderer app and the Electron main/preload scripts:

```
apps/desktop/
├── index.html                 ← Vite HTML entry point
├── vite.config.ts             ← Multi-target Vite configuration
├── src/
│   ├── main/                  ← Electron Main process code
│   │   ├── index.ts           ← Entry point (BrowserWindow, lifecycle, security)
│   │   └── ipc-handlers.ts    ← Shell IPC handler registration
│   ├── preload/               ← Preload script
│   │   └── index.ts           ← contextBridge definition & C3ShellAPI type
│   └── renderer/              ← React 18 UI application
│       ├── main.tsx           ← React root mount
│       ├── App.tsx            ← Shell diagnostic & security status UI
│       ├── styles.css         ← Theme & shell layout styling
│       └── index.ts           ← Renderer public exports
└── dist-electron/             ← Output directory for Electron main/preload
│   ├── main/index.js
│   └── preload/index.js
└── dist-renderer/            ← Output directory for bundled React renderer UI
    ├── index.html
    └── assets/
```

### Build Commands

- `pnpm --filter @c3/desktop run build` — Compiles TypeScript types (`tsc --build`) and bundles all targets via Vite (`vite build`).
- `pnpm --filter @c3/desktop run dev` — Launches Vite dev server with hot reload for the renderer and auto-restarts Electron on main/preload edits.

---

## Inter-Process Communication (IPC) Protocol

### Permitted Channels

Only two IPC channels are defined in Stage 2A:

| Channel | Direction | Request Payload | Response Payload | Description |
|---------|-----------|-----------------|------------------|-------------|
| `shell:ping` | Renderer → Main | `undefined` | `'pong'` | Verifies that the IPC bridge and main process event loop are active. |
| `shell:get-version` | Renderer → Main | `undefined` | `string` (e.g. `'0.1.0'`) | Queries the application package version from main process. |

### API Surface Exposed to Renderer (`window.c3Shell`)

```typescript
export interface C3ShellAPI {
  ping(): Promise<string>;
  getVersion(): Promise<string>;
  platform: string;
}
```

---

## Application Startup Sequence

1. **Initialization:** Electron `app.whenReady()` triggers `BaseLifecycle.start()`.
2. **IPC Wiring:** `registerShellIpcHandlers()` attaches `shell:ping` and `shell:get-version` listeners.
3. **Window Creation:** `createMainWindow()` instantiates `BrowserWindow` with security flags and attaches the preload script (`dist-electron/preload/index.js`).
4. **Renderer Loading:** Main process loads `http://localhost:5173` (in dev) or `dist-renderer/index.html` (in prod).
5. **Ready-to-Show:** `ready-to-show` fires on `BrowserWindow`, displaying the window without visual flash.
6. **Shutdown:** `window-all-closed` triggers `BaseLifecycle.stop()`, cleanly unregistering IPC handlers and closing active windows.

---

## Verification & Test Suite

- **Unit Tests:** `tests/unit/desktop/desktop.test.ts` verifies IPC registration, ping/pong execution, version retrieval, and handler unregistration using dependency injection.
- **Runtime Security Checks:** `App.tsx` performs runtime inspection of `window.process`, `window.require`, and `window.module`, reporting isolation status directly on the UI dashboard.
