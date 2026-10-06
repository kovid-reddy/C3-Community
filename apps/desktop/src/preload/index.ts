/**
 * C3 Desktop Shell - Preload Script
 * Exposes isolated IPC interface to the renderer process.
 * Security enforcement: Node APIs and native modules are NOT exposed directly.
 */

import { IpcChannel } from '../main';

export interface C3ElectronAPI {
  invokeService<T>(channel: IpcChannel, payload?: unknown): Promise<T>;
}

declare global {
  interface Window {
    c3API?: C3ElectronAPI;
  }
}

export const preloadBridge: C3ElectronAPI = {
  async invokeService<T>(_channel: IpcChannel, _payload?: unknown): Promise<T> {
    // Stage 0 bridge definition contract
    throw new Error('IPC Bridge not initialized in Stage 0 architecture shell.');
  },
};
