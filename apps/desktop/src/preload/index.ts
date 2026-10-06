/**
 * C3 Desktop Shell — Preload Script (Security Boundary)
 *
 * Security topology:
 *   - Isolated JS context (`contextIsolation: true`)
 *   - No Node.js APIs, no Electron internals exposed directly to window
 *   - Strict IPC channel allowlist via typed `safeInvoke` transport wrapper
 *   - Transport envelope unwrapping and AppError deserialization across boundary
 *
 * The renderer can ONLY communicate via window.c3Shell.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type IpcChannelMap,
  type IpcResponseEnvelope,
  type User,
  type HardwareInfo,
  type ProviderStatus,
} from '@c3/contracts';
import { deserializeError, isIpcSuccess, AppError } from '@c3/foundation';

// ── Allowed IPC channels (Strict Security Allowlist) ─────────────────────────

const ALLOWED_INVOKE_CHANNELS: ReadonlySet<string> = new Set<string>([
  IPC_CHANNELS.SHELL_PING,
  IPC_CHANNELS.SHELL_GET_VERSION,
  IPC_CHANNELS.AUTH_GET_CURRENT_USER,
  IPC_CHANNELS.HARDWARE_GET_INFO,
  IPC_CHANNELS.PROVIDER_GET_STATUS,
]);

// ── Safe IPC Invoke Transport Wrapper ──────────────────────────────────────

async function safeInvoke<K extends keyof IpcChannelMap>(
  channel: K,
  payload?: IpcChannelMap[K]['request']
): Promise<IpcChannelMap[K]['response']> {
  if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
    throw new AppError({
      code: 'ERR_IPC_BLOCKED',
      category: 'AUTH_ERROR',
      message: `IPC channel '${channel}' is blocked by preload security allowlist.`,
    });
  }

  const response = (await ipcRenderer.invoke(channel, payload)) as IpcResponseEnvelope<IpcChannelMap[K]['response']>;

  if (isIpcSuccess(response)) {
    return response.data;
  }

  throw deserializeError(response.error);
}

// ── Type-safe API Surface Exposed to Renderer ─────────────────────────────

export interface C3ShellAPI {
  /** Ping main process — verifies IPC bridge status */
  ping(): Promise<string>;

  /** Query application version from main process */
  getVersion(): Promise<string>;

  /** Query current authenticated user (contracts signature) */
  getCurrentUser(): Promise<User | null>;

  /** Query local hardware info metrics (contracts signature) */
  getHardwareInfo(): Promise<HardwareInfo | null>;

  /** Query provider status (contracts signature) */
  getProviderStatus(): Promise<ProviderStatus | null>;

  /** Static safe platform identifier (e.g. 'win32', 'darwin', 'linux') */
  readonly platform: string;
}

const c3ShellAPI: C3ShellAPI = {
  ping: () => safeInvoke('shell:ping'),
  getVersion: () => safeInvoke('shell:get-version'),
  getCurrentUser: () => safeInvoke('auth:get-current-user'),
  getHardwareInfo: () => safeInvoke('hardware:get-info'),
  getProviderStatus: () => safeInvoke('provider:get-status'),
  platform: process.platform,
};

// ── contextBridge Expose ───────────────────────────────────────────────────

contextBridge.exposeInMainWorld('c3Shell', c3ShellAPI);

// ── Renderer TypeScript Global Augmentation ───────────────────────────────

declare global {
  interface Window {
    c3Shell: C3ShellAPI;
  }
}
