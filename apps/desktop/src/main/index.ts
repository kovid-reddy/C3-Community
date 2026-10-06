/**
 * C3 Desktop Shell - Main Process
 * Electron security enforcement and IPC boundary handlers.
 */

export interface BrowserWindowOptions {
  width: number;
  height: number;
  webPreferences: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    preload: string;
  };
}

export function createSecureWindowConfig(preloadPath: string): BrowserWindowOptions {
  return {
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  };
}

export type IpcChannel =
  | 'auth:get-current-user'
  | 'hardware:get-info'
  | 'provider:get-status'
  | 'cluster:get-status'
  | 'compute:get-status'
  | 'job:list';

export interface IpcBridgeContract {
  invoke<T>(channel: IpcChannel, payload?: unknown): Promise<T>;
}
