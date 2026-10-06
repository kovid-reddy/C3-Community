/**
 * C3 Desktop Shell — IPC Handlers (Main Process)
 *
 * Registers strongly-typed IPC channel handlers permitted by the preload bridge.
 * All handlers use transport wrappers (`createIpcHandler`) from Foundation.
 *
 * ARCHITECTURAL MANDATE:
 *   - Zero business logic in IPC handlers.
 *   - Handlers act strictly as transport adapters between IPC channel requests
 *     and domain service contracts.
 */

import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, type AuthService, type HardwareService, type ProviderService } from '@c3/contracts';
import { createIpcHandler, type StructuredLogger } from '@c3/foundation';

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export interface ApplicationServices {
  readonly authService?: AuthService;
  readonly hardwareService?: HardwareService;
  readonly providerService?: ProviderService;
}

export function registerShellIpcHandlers(
  logger: StructuredLogger,
  ipcMainTarget: IpcMainLike = ipcMain,
  services: ApplicationServices = {}
): void {
  // shell:ping
  ipcMainTarget.handle(
    IPC_CHANNELS.SHELL_PING,
    createIpcHandler<'shell:ping'>(async () => {
      logger.debug('IPC shell:ping received');
      return 'pong';
    })
  );

  // shell:get-version
  ipcMainTarget.handle(
    IPC_CHANNELS.SHELL_GET_VERSION,
    createIpcHandler<'shell:get-version'>(async () => {
      const version = app ? app.getVersion() : '0.1.0';
      logger.debug('IPC shell:get-version received', { metadata: { version } });
      return version;
    })
  );

  // auth:get-current-user
  ipcMainTarget.handle(
    IPC_CHANNELS.AUTH_GET_CURRENT_USER,
    createIpcHandler<'auth:get-current-user'>(async () => {
      logger.debug('IPC auth:get-current-user received');
      if (services.authService) {
        return await services.authService.getCurrentUser();
      }
      return null;
    })
  );

  // hardware:get-info
  ipcMainTarget.handle(
    IPC_CHANNELS.HARDWARE_GET_INFO,
    createIpcHandler<'hardware:get-info'>(async () => {
      logger.debug('IPC hardware:get-info received');
      if (services.hardwareService) {
        return await services.hardwareService.getHardware();
      }
      return null;
    })
  );

  // provider:get-status
  ipcMainTarget.handle(
    IPC_CHANNELS.PROVIDER_GET_STATUS,
    createIpcHandler<'provider:get-status'>(async () => {
      logger.debug('IPC provider:get-status received');
      if (services.providerService) {
        return await services.providerService.getStatus();
      }
      return null;
    })
  );
}

export function unregisterShellIpcHandlers(ipcMainTarget: IpcMainLike = ipcMain): void {
  ipcMainTarget.removeHandler(IPC_CHANNELS.SHELL_PING);
  ipcMainTarget.removeHandler(IPC_CHANNELS.SHELL_GET_VERSION);
  ipcMainTarget.removeHandler(IPC_CHANNELS.AUTH_GET_CURRENT_USER);
  ipcMainTarget.removeHandler(IPC_CHANNELS.HARDWARE_GET_INFO);
  ipcMainTarget.removeHandler(IPC_CHANNELS.PROVIDER_GET_STATUS);
}
