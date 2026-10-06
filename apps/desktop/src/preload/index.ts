/**
 * C3 Desktop Shell — Preload Script
 *
 * Security design:
 *   - Runs with Node.js access (preload context) but is isolated from the renderer
 *   - Only explicitly allowlisted APIs are exposed to the renderer via contextBridge
 *   - ipcRenderer is never exposed directly; only a controlled invoke wrapper is provided
 *   - No Node modules, no Electron internals, no process object is forwarded
 *
 * The renderer can ONLY call the methods listed here.
 * Any future IPC channels MUST be explicitly registered here.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ── Allowed IPC channels ──────────────────────────────────────────────────────
// This is the complete allowlist. The renderer cannot send arbitrary messages.
// Future stages will expand this list deliberately.

type AllowedChannel =
  | 'shell:ping'
  | 'shell:get-version';

const ALLOWED_INVOKE_CHANNELS: ReadonlySet<string> = new Set<AllowedChannel>([
  'shell:ping',
  'shell:get-version',
]);

// ── Type-safe API surface exposed to renderer ─────────────────────────────────

export interface C3ShellAPI {
  /** Ping the main process — verifies IPC bridge is functioning */
  ping(): Promise<string>;
  /** Get application version from main process */
  getVersion(): Promise<string>;
  /**
   * Platform identifier — exposed as a static safe value, not process.platform
   * This does NOT expose the process object.
   */
  platform: string;
}

const c3ShellAPI: C3ShellAPI = {
  ping: () => safeInvoke<string>('shell:ping'),
  getVersion: () => safeInvoke<string>('shell:get-version'),
  platform: process.platform,
};

// ── Safe invoke wrapper ────────────────────────────────────────────────────────

function safeInvoke<T>(channel: string, payload?: unknown): Promise<T> {
  if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`IPC channel '${channel}' is not permitted.`));
  }
  return ipcRenderer.invoke(channel, payload) as Promise<T>;
}

// ── contextBridge registration ─────────────────────────────────────────────────
// This is the ONLY way data crosses the process boundary.
// window.c3Shell is the ONLY renderer-accessible API.

contextBridge.exposeInMainWorld('c3Shell', c3ShellAPI);

// ── Global type augmentation (for renderer TypeScript) ─────────────────────────
// Exported so the renderer can import this type safely.
declare global {
  interface Window {
    c3Shell: C3ShellAPI;
  }
}
