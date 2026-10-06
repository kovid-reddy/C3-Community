/**
 * C3 Desktop Shell — IPC Handlers (Main Process)
 *
 * Registers only the shell-level IPC channels permitted by the preload bridge.
 * These handlers answer basic lifecycle queries from the renderer.
 * No C3 business logic here.
 */

import { ipcMain, app } from 'electron';
import type { StructuredLogger } from '@c3/foundation';

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export function registerShellIpcHandlers(
  logger: StructuredLogger,
  ipcMainTarget: IpcMainLike = ipcMain
): void {
  ipcMainTarget.handle('shell:ping', () => {
    logger.debug('IPC shell:ping received');
    return 'pong';
  });

  ipcMainTarget.handle('shell:get-version', () => {
    const version = app ? app.getVersion() : '0.1.0';
    logger.debug('IPC shell:get-version received', { metadata: { version } });
    return version;
  });
}

export function unregisterShellIpcHandlers(ipcMainTarget: IpcMainLike = ipcMain): void {
  ipcMainTarget.removeHandler('shell:ping');
  ipcMainTarget.removeHandler('shell:get-version');
}
