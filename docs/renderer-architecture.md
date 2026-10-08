# C3 Renderer Architecture & Foundation Specification (Stage 2C)

## Overview

Stage 2C establishes the clean React renderer foundation for the C3 TypeScript Electron desktop application. The renderer sits strictly on top of the secure preload/IPC boundary established in Stage 2A and Stage 2B.

The renderer is exclusively a **presentation & renderer lifecycle layer**. It does not perform business logic, nor does it access infrastructure, Node.js, Electron internals, or native resources directly.

---

## Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React UI Layer                                │
│   (App, ShellLayout, StatusCard, SecurityCheckCard, LoadingView, etc.) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Renderer Application & Service Layer                  │
│       (AppBoundary, ErrorBoundary, useShellInit, shellService)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Typed Preload Bridge API                        │
│                         (window.c3Shell)                               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ contextBridge (safeInvoke allowlist)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           IPC Transport                                │
│                     (shell:ping, shell:get-version, etc.)              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                           │
│                 (Application Services & Runtime Host)                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Process Boundaries & Security Rules

### Forbidden Renderer Imports & Globals

To preserve process isolation, security, and web sandbox constraints:
1. **Forbidden Imports:** Renderer code MUST NOT import `electron`, `ipcRenderer`, `ipcMain`, `node:*`, `fs`, `child_process`, or feature packages (`@c3/auth`, `@c3/cloud`, `@c3/hardware`, `@c3/provider`, `@c3/cluster`, `@c3/compute`, `@c3/jobs`, `@c3/discovery`).
2. **Forbidden Globals:** Direct usage of `(window as any)`, `process`, `require`, or `module` is prohibited.
3. **Desktop Capabilities Access:** Desktop capabilities are accessed strictly via `window.c3Shell` (typed by `C3ShellAPI` defined in preload).

---

## Renderer Application Structure

The renderer source is organized within `apps/desktop/src/renderer/`:

```
apps/desktop/src/renderer/
├── main.tsx                   ← Bootstraps React 18 onto DOM root element (#root)
├── App.tsx                    ← Root component rendering AppBoundary composition
├── styles.css                 ← Responsive layout, dark theme, and state styling
├── index.ts                   ← Renderer public exports
├── app/
│   └── AppBoundary.tsx        ← Root composition (ErrorBoundary + Shell initialization)
├── components/
│   ├── ErrorBoundary.tsx      ← React Error Boundary for render exception trapping
│   ├── LoadingView.tsx        ← Visual loading spinner during shell initialization
│   ├── ErrorView.tsx          ← Safe error fallback view for initialization failure
│   ├── StatusCard.tsx         ← IPC shell runtime metrics panel
│   ├── SecurityCheckCard.tsx  ← Sandbox isolation verification panel
│   └── ShellLayout.tsx        ← Minimal shell layout composition
├── services/
│   ├── shellService.ts        ← Access layer for window.c3Shell & security inspection
│   └── useShellInit.ts        ← React hook managing initialization lifecycle
└── types/
    └── rendererState.ts       ← Discriminated union types for renderer state
```

---

## Initialization Flow & State Machine

The renderer initialization state machine governs application startup:

```
                  ┌──────────────────────┐
                  │     Initializing     │
                  └──────────┬───────────┘
                             │
                  initializeShell() execution
                (window.c3Shell.ping & getVersion)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │      Ready      │               │      Error      │
   └─────────────────┘               └─────────────────┘
```

### State Definitions (`types/rendererState.ts`)

```typescript
export type RendererState =
  | { status: 'initializing' }
  | { status: 'ready'; info: ShellInfo }
  | { status: 'error'; error: RendererErrorInfo };
```

1. **`initializing`:** Renderer displays `LoadingView` while `useShellInit` verifies `window.c3Shell`, executing `ping()` and `getVersion()`.
2. **`ready`:** IPC bridge confirmed. Renderer displays `ShellLayout` populated with runtime metrics.
3. **`error`:** IPC bridge unavailable or ping failed. Renderer displays `ErrorView` with safe error code and optional retry trigger.

---

## Error Handling & Error Boundary

- **Unexpected Render Errors:** Handled by `ErrorBoundary` (`components/ErrorBoundary.tsx`).
- **User Safety:** Exposes zero stack traces or internal secrets to user UI. Displays safe, actionable messaging.
- **Diagnostic Logging:** Logs sanitized diagnostic info locally to `console.error` for troubleshooting.
- **Recovery:** Provides a `Reset Interface` button to clear error state.

---

## Verification & Testing

Renderer tests reside in `tests/unit/desktop/renderer.test.ts`.

Verification coverage includes:
- **Root Application Rendering:** Asserts `ShellLayout`, `StatusCard`, `SecurityCheckCard` render expected content.
- **Initialization Lifecycle:** Verifies transition through loading, successful `ping()` and `getVersion()` consumption, and ready state.
- **Failure States:** Confirms missing bridge or IPC failure results in safe `ErrorView`.
- **Error Boundary:** Verifies render crash recovery and stack trace sanitization.
- **Security Boundary:** Asserts renderer runtime security check correctly flags presence/absence of Node globals.

### Commands

```bash
pnpm --filter @c3/desktop run build
pnpm run build
npx vitest run
node scripts/verify-deps.js
```

---

## Guidance for Future Developers

1. **Where should future UI features be implemented?**
   Future feature components belong in modular subdirectories inside `apps/desktop/src/renderer/` (e.g. `views/`, `features/`). They must remain pure React components.

2. **How should future UI features communicate with backend logic?**
   Components must NEVER import backend packages, Node APIs, or Electron modules. Features call IPC handlers exposed through `window.c3Shell` (or domain-specific services that wrap `window.c3Shell`).
