import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredLogger } from '../../../packages/foundation/src';
import { registerShellIpcHandlers, unregisterShellIpcHandlers, type IpcMainLike } from '../../../apps/desktop/src/main/ipc-handlers';

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

    expect(handlers.has('shell:ping')).toBe(true);
    expect(handlers.has('shell:get-version')).toBe(true);
  });

  it('should return pong for shell:ping', async () => {
    registerShellIpcHandlers(logger, mockIpcMain);

    const pingHandler = handlers.get('shell:ping');
    expect(pingHandler).toBeDefined();

    const result = await pingHandler!({}, undefined);
    expect(result).toBe('pong');
  });

  it('should return app version for shell:get-version', async () => {
    registerShellIpcHandlers(logger, mockIpcMain);

    const versionHandler = handlers.get('shell:get-version');
    expect(versionHandler).toBeDefined();

    const result = await versionHandler!({}, undefined);
    expect(typeof result).toBe('string');
  });

  it('should unregister all handlers cleanly', () => {
    registerShellIpcHandlers(logger, mockIpcMain);
    expect(handlers.size).toBe(2);

    unregisterShellIpcHandlers(mockIpcMain);
    expect(handlers.size).toBe(0);
  });
});
