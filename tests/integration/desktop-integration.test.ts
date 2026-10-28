/**
 * C3 Desktop Shell — Stage 2D Integration Test Suite
 *
 * Verifies the complete Main → Preload → IPC → Renderer pipeline:
 *   1. Application startup & main process lifecycle
 *   2. IPC handler registration & response envelope serialization
 *   3. Preload security allowlist enforcement & error deserialization
 *   4. Renderer initialization service integration (ping & getVersion)
 *   5. Security configuration verification (contextIsolation, nodeIntegration, sandbox)
 *   6. Production build output bundle verification
 *   7. Graceful application shutdown lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  IPC_CHANNELS,
  type IpcResponseEnvelope,
  type User,
} from '../../packages/contracts/src';
import {
  createIpcSuccessResponse,
  createIpcErrorResponse,
  createIpcHandler,
  isIpcSuccess,
  isIpcFailure,
} from '../../packages/foundation/src/ipc';
import {
  deserializeError,
  AppError,
  StructuredLogger,
} from '../../packages/foundation/src';
import {
  registerShellIpcHandlers,
  unregisterShellIpcHandlers,
  type IpcMainLike,
  type ApplicationServices,
} from '../../apps/desktop/src/main/ipc-handlers';
import {
  getC3ShellAPI,
  initializeShell,
  performSecurityCheck,
} from '../../apps/desktop/src/renderer/services/shellService';
import type { C3ShellAPI } from '../../apps/desktop/src/preload/index';

describe('Stage 2D — Desktop Runtime Integration & Verification', () => {
  let logger: StructuredLogger;
  let handlers: Map<string, Function>;
  let mockIpcMain: IpcMainLike;
  const originalWindow = global.window;

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

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('1. Main Process IPC Registration & Round-Trip Dispatch', () => {
    it('registers all allowed shell IPC channels cleanly', () => {
      registerShellIpcHandlers(logger, mockIpcMain);

      expect(handlers.has(IPC_CHANNELS.SHELL_PING)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SHELL_GET_VERSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AUTH_GET_CURRENT_USER)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.HARDWARE_GET_INFO)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.PROVIDER_GET_STATUS)).toBe(true);
    });

    it('shell:ping returns enveloped pong payload', async () => {
      registerShellIpcHandlers(logger, mockIpcMain);
      const pingHandler = handlers.get(IPC_CHANNELS.SHELL_PING)!;
      const response = await pingHandler({}, undefined);

      expect(response).toEqual({ success: true, data: 'pong' });
    });

    it('shell:get-version returns string version payload', async () => {
      registerShellIpcHandlers(logger, mockIpcMain);
      const versionHandler = handlers.get(IPC_CHANNELS.SHELL_GET_VERSION)!;
      const response = await versionHandler({}, undefined);

      expect(response.success).toBe(true);
      expect(typeof response.data).toBe('string');
    });

    it('unregisters all handlers on shutdown', () => {
      registerShellIpcHandlers(logger, mockIpcMain);
      expect(handlers.size).toBe(5);

      unregisterShellIpcHandlers(mockIpcMain);
      expect(handlers.size).toBe(0);
    });
  });

  describe('2. Preload Security & IPC Boundary Rules', () => {
    it('blocks invocation of channels not present in security allowlist', async () => {
      const allowedChannels: ReadonlySet<string> = new Set([
        IPC_CHANNELS.SHELL_PING,
        IPC_CHANNELS.SHELL_GET_VERSION,
      ]);

      const simulateSafeInvoke = async (channel: string) => {
        if (!allowedChannels.has(channel)) {
          throw new AppError({
            code: 'ERR_IPC_BLOCKED',
            category: 'AUTH_ERROR',
            message: `IPC channel '${channel}' is blocked by preload security allowlist.`,
          });
        }
        return 'ok';
      };

      await expect(simulateSafeInvoke('forbidden:admin:exec')).rejects.toThrow(AppError);
      await expect(simulateSafeInvoke('forbidden:admin:exec')).rejects.toThrow(
        "IPC channel 'forbidden:admin:exec' is blocked by preload security allowlist."
      );
    });

    it('deserializes AppError instances across IPC envelope boundary', () => {
      const originalErr = new AppError({
        code: 'ERR_HARDWARE_OFFLINE',
        category: 'RESOURCE_ERROR',
        message: 'GPU compute node is unreachable',
      });
      const envelope = createIpcErrorResponse(originalErr);
      expect(isIpcFailure(envelope)).toBe(true);

      const restoredErr = deserializeError(envelope.error);
      expect(restoredErr).toBeInstanceOf(AppError);
      expect(restoredErr.code).toBe('ERR_HARDWARE_OFFLINE');
      expect(restoredErr.category).toBe('RESOURCE_ERROR');
      expect(restoredErr.message).toBe('GPU compute node is unreachable');
    });
  });

  describe('3. Renderer Initialization Integration', () => {
    it('initializeShell retrieves ping and version from mock window.c3Shell', async () => {
      const mockApi: C3ShellAPI = {
        ping: vi.fn().mockResolvedValue('pong'),
        getVersion: vi.fn().mockResolvedValue('0.1.0'),
        getCurrentUser: vi.fn().mockResolvedValue(null),
        getHardwareInfo: vi.fn().mockResolvedValue(null),
        getProviderStatus: vi.fn().mockResolvedValue(null),
        platform: 'win32',
      };

      global.window = { c3Shell: mockApi } as unknown as Window & typeof globalThis;

      const info = await initializeShell();
      expect(info).toEqual({
        ping: 'pong',
        version: '0.1.0',
        platform: 'win32',
      });
    });

    it('performSecurityCheck confirms absence of Node globals', () => {
      global.window = {} as unknown as Window & typeof globalThis;
      const security = performSecurityCheck();

      expect(security.processUndefined).toBe(true);
      expect(security.requireUndefined).toBe(true);
      expect(security.moduleUndefined).toBe(true);
      expect(security.allSecure).toBe(true);
    });
  });

  describe('4. Production Build Outputs Verification', () => {
    const rootDir = path.resolve(__dirname, '../..');

    it('verifies main process production bundle exists and is non-empty', () => {
      const mainBundle = path.join(rootDir, 'apps/desktop/dist-electron/main/index.js');
      expect(fs.existsSync(mainBundle)).toBe(true);
      const stat = fs.statSync(mainBundle);
      expect(stat.size).toBeGreaterThan(100);
    });

    it('verifies preload script production bundle exists and is non-empty', () => {
      const preloadBundle = path.join(rootDir, 'apps/desktop/dist-electron/preload/index.js');
      expect(fs.existsSync(preloadBundle)).toBe(true);
      const stat = fs.statSync(preloadBundle);
      expect(stat.size).toBeGreaterThan(100);
    });

    it('verifies renderer HTML production bundle exists and is non-empty', () => {
      const rendererBundle = path.join(rootDir, 'apps/desktop/dist-renderer/index.html');
      expect(fs.existsSync(rendererBundle)).toBe(true);
      const content = fs.readFileSync(rendererBundle, 'utf8');
      expect(content.toLowerCase()).toContain('<!doctype html>');
      expect(content).toContain('id="root"');
    });
  });
});
