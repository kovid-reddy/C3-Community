# Electron Security & IPC Architecture

## Security Boundary Rules

1. **Context Isolation**: `contextIsolation` MUST be enabled (`true`) in electron webPreferences.
2. **Node Integration Disabled**: `nodeIntegration` MUST be disabled (`false`).
3. **No Direct System Access**: The React Renderer process MUST NOT:
   - Access Node.js APIs directly (`fs`, `child_process`, `net`, `path`).
   - Execute arbitrary shell commands.
   - Access Docker, Kubernetes/K3s, Ray, or AWS SDKs directly.
   - Read or write local filesystem paths directly.
4. **Sensitive Operations**: All sensitive compute, file, network, or authentication operations MUST take place strictly within the main process or background service worker.

## Typed IPC Boundary

Communication between React UI and Main process follows strict channels:

```
Renderer UI
    ↓ window.c3API.invokeService(channel, payload)
Preload Script (Bridge)
    ↓ ipcRenderer.invoke(channel, payload)
Main Process IPC Router
    ↓ Validation (Zod/Schema)
Application Service Handler
```
