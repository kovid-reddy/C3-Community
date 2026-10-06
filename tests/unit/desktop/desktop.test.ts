import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredLogger } from '../../../packages/foundation/src';
import { registerShellIpcHandlers, unregisterShellIpcHandlers, type IpcMainLike } from '../../../apps/desktop/src/main/ipc-handlers';
import { IPC_CHANNELS } from '../../../packages/contracts/src';

describe('Desktop Shell IPC Handlers', () => {
  let logger: StructuredLogger;
  let handlers: Map<string, Function>;
  let mockIpcMain: IpcMainLike;

  beforeEach(() => {
    handlers = new Map<string, Function>();
    mockIpcMain = {
      handle: (channel: string, listener: any) => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel: string) => {
        handlers.delete(channel);
      },
    };
    logger = new StructuredLogger({ module: 'test', minLevel: 'error' });
  });

  it('should register shell:ping and shell:get-version handlers', () => {
    registerShellIpcHandlers(logger, mockIpcMain);

    expect(handlers.has(IPC_CHANNELS.SHELL_PING)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.SHELL_GET_VERSION)).toBe(true);
  });

  it('should return enveloped pong for shell:ping', async () => {
    registerShellIpcHandlers(logger, mockIpcMain);

    const pingHandler = handlers.get(IPC_CHANNELS.SHELL_PING);
    expect(pingHandler).toBeDefined();

    const result = await pingHandler!({}, undefined);
    expect(result).toEqual({ success: true, data: 'pong' });
  });

  it('should return app version for shell:get-version', async () => {
    registerShellIpcHandlers(logger, mockIpcMain);

    const versionHandler = handlers.get(IPC_CHANNELS.SHELL_GET_VERSION);
    expect(versionHandler).toBeDefined();

    const result = await versionHandler!({}, undefined);
    expect(result.success).toBe(true);
    expect(typeof result.data).toBe('string');
  });

  it('should unregister all handlers cleanly', () => {
    registerShellIpcHandlers(logger, mockIpcMain);
    expect(handlers.size).toBe(5);

    unregisterShellIpcHandlers(mockIpcMain);
    expect(handlers.size).toBe(0);
  });
});
