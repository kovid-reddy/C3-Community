# C3 Desktop IPC Contracts & Security Boundary (Stage 2B)

## Overview

Stage 2B establishes the formal, strongly-typed Inter-Process Communication (IPC) transport boundary for the C3 Desktop application. It enforces strict separation of concerns between the unsandboxed Electron Main process and the sandboxed React Renderer process.

---

## Architectural Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          React Renderer (UI)                                │
│                                                                             │
│   Calls typed methods on window.c3Shell (e.g. window.c3Shell.ping())        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    Preload Boundary   │ safeInvoke<K>(channel, payload)
                    (Security Shield)  │ Checks ALLOWED_INVOKE_CHANNELS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Electron Preload Script                               │
│                                                                             │
│   • Calls ipcRenderer.invoke(channel, payload)                             │
│   • Receives IpcResponseEnvelope<T>                                         │
│   • Unwraps success data OR deserializes AppError failure and throws        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    IPC Transport      │ Electron IPC channel transport
                    (Channel Bus)      │ (SerDes JSON-compatible envelopes)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Main Process IPC Router                             │
│                                                                             │
│   • Handlers registered via registerShellIpcHandlers()                      │
│   • Wrapped with createIpcHandler() transport adapter                        │
│   • Catches all exceptions & serializes into IpcResponseFailure envelope   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    Domain Delegation  │ Direct function call
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Application Services Layer                           │
│  (AuthService, HardwareService, ProviderService, ClusterService, etc.)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

1. **IPC is Transport Only:** IPC handlers MUST NOT contain application or business logic. They serve strictly as transport adapters that decode request payloads, delegate execution to injected domain services, and return typed response envelopes.
2. **Preload is a Security Shield:** Preload scripts run in an isolated JS context (`contextIsolation: true`) with Node.js access. They MUST NOT expose `ipcRenderer`, Node modules (`fs`, `child_process`), or raw process globals to `window`.
3. **Strict Allowlist:** Renderer processes cannot send arbitrary IPC messages. Only channels present in `ALLOWED_INVOKE_CHANNELS` can be invoked across the bridge.
4. **Normalized Error Propagation:** Errors thrown anywhere in the service layer are normalized into `AppError` instances, serialized into `IpcResponseFailure` envelopes, and deserialized back into true `AppError` instances when re-thrown in the renderer.

---

## Message Envelope Specifications

All IPC responses are wrapped in a standard `IpcResponseEnvelope<T>` envelope defined in `@c3/contracts`:

### Success Envelope

```typescript
export interface IpcResponseSuccess<T = unknown> {
  readonly success: true;
  readonly data: T;
  readonly error?: undefined;
}
```

### Failure Envelope

```typescript
export interface IpcResponseFailure {
  readonly success: false;
  readonly data?: undefined;
  readonly error: Record<string, unknown>; // SerializedAppError
}
```

---

## Error Handling & Serialization Flow

```
Main Process Service Execution
      │ (Throws AppError or unexpected Error)
      ▼
createIpcHandler Transport Wrapper
      │ Calls serializeError(err) from @c3/foundation
      ▼
Returns IpcResponseFailure { success: false, error: SerializedAppError }
      │ IPC Transport
      ▼
Preload Script (safeInvoke)
      │ Detects response.success === false
      │ Calls deserializeError(response.error)
      ▼
Reconstructs & Throws AppError Instance to Renderer Caller
```

---

## Channel Registry (`IpcChannelMap`)

Defined centrally in `@c3/contracts` (`packages/contracts/src/ipc.ts`):

| Channel Name | Request Payload | Response Data | Description |
|--------------|-----------------|---------------|-------------|
| `shell:ping` | `void` | `string` (`'pong'`) | Diagnostic round-trip check |
| `shell:get-version` | `void` | `string` (e.g. `'0.1.0'`) | Application package version query |
| `auth:get-current-user` | `void` | `User \| null` | Authenticated user query |
| `hardware:get-info` | `void` | `HardwareInfo \| null` | Local hardware metrics query |
| `provider:get-status` | `void` | `ProviderStatus \| null` | Local provider daemon status query |

---

## Handler Registration & Dependency Injection

IPC handlers are registered in the main process using dependency injection (`ApplicationServices`), decoupling IPC transport from domain implementations:

```typescript
export function registerShellIpcHandlers(
  logger: StructuredLogger,
  ipcMainTarget: IpcMainLike = ipcMain,
  services: ApplicationServices = {}
): void {
  ipcMainTarget.handle(
    IPC_CHANNELS.SHELL_PING,
    createIpcHandler<'shell:ping'>(async () => {
      logger.debug('IPC shell:ping received');
      return 'pong';
    })
  );

  ipcMainTarget.handle(
    IPC_CHANNELS.AUTH_GET_CURRENT_USER,
    createIpcHandler<'auth:get-current-user'>(async () => {
      if (services.authService) {
        return await services.authService.getCurrentUser();
      }
      return null;
    })
  );
}
```

---

## Verification & Test Suite

- **IPC Boundary Unit Tests (`tests/unit/desktop/ipc-boundary.test.ts`):** Tests envelope creation, success/failure type guards, `createIpcHandler` exception handling, error deserialization, channel allowlist enforcement, and service delegation.
- **Desktop Shell Unit Tests (`tests/unit/desktop/desktop.test.ts`):** Tests IPC registration and response envelope generation.
- **Monorepo Dependency Verification (`scripts/verify-deps.js`):** Confirms `@c3/contracts` has 0 runtime dependencies and `@c3/desktop` imports zero forbidden feature modules.
