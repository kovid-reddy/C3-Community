import { describe, it, expect, beforeEach } from 'vitest';
import {
  IPC_CHANNELS,
  type IpcResponseSuccess,
  type IpcResponseFailure,
  type User,
  type HardwareInfo,
} from '../../../packages/contracts/src';
import {
  createIpcSuccessResponse,
  createIpcErrorResponse,
  createIpcHandler,
  isIpcSuccess,
  isIpcFailure,
} from '../../../packages/foundation/src/ipc';
import {
  deserializeError,
  AppError,
  StructuredLogger,
} from '../../../packages/foundation/src';
import {
  registerShellIpcHandlers,
  unregisterShellIpcHandlers,
  type IpcMainLike,
  type ApplicationServices,
} from '../../../apps/desktop/src/main/ipc-handlers';

describe('Stage 2B — Typed IPC Contracts & Boundary', () => {
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

  describe('Envelope Helpers', () => {
    it('createIpcSuccessResponse creates success envelope', () => {
      const res = createIpcSuccessResponse('hello');
      expect(res.success).toBe(true);
      expect(res.data).toBe('hello');
      expect(isIpcSuccess(res)).toBe(true);
      expect(isIpcFailure(res)).toBe(false);
    });

    it('createIpcErrorResponse serializes thrown error', () => {
      const err = new AppError({
        code: 'ERR_TEST',
        category: 'VALIDATION_ERROR',
        message: 'Invalid parameters',
      });
      const res = createIpcErrorResponse(err);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error.code).toBe('ERR_TEST');
      expect(isIpcFailure(res)).toBe(true);
      expect(isIpcSuccess(res)).toBe(false);
    });

    it('deserializeError reconstructs AppError instance from serialized response error', () => {
      const originalErr = new AppError({
        code: 'ERR_AUTH_EXPIRED',
        category: 'AUTH_ERROR',
        message: 'Session token expired',
        retryable: true,
      });
      const res = createIpcErrorResponse(originalErr);
      const reconstructed = deserializeError(res.error);

      expect(reconstructed).toBeInstanceOf(AppError);
      expect(reconstructed.code).toBe('ERR_AUTH_EXPIRED');
      expect(reconstructed.category).toBe('AUTH_ERROR');
      expect(reconstructed.message).toBe('Session token expired');
      expect(reconstructed.retryable).toBe(true);
    });
  });

  describe('createIpcHandler Wrapper', () => {
    it('wraps successful execution into success envelope', async () => {
      const handler = createIpcHandler<'shell:ping'>(async () => 'pong');
      const envelope = await handler({}, undefined);

      expect(envelope.success).toBe(true);
      if (envelope.success) {
        expect(envelope.data).toBe('pong');
      }
    });

    it('catches synchronous exception and wraps into error envelope', async () => {
      const handler = createIpcHandler<'shell:ping'>(() => {
        throw new Error('Sync failure inside service');
      });
      const envelope = await handler({}, undefined);

      expect(envelope.success).toBe(false);
      if (!envelope.success) {
        expect(envelope.error.code).toBe('ERR_INTERNAL_ERROR');
        expect(envelope.error.message).toBe('Sync failure inside service');
      }
    });

    it('catches async promise rejection and wraps into error envelope', async () => {
      const handler = createIpcHandler<'shell:ping'>(async () => {
        throw new AppError({
          code: 'ERR_SERVICE_DOWN',
          category: 'NETWORK_ERROR',
          message: 'Backend service unavailable',
        });
      });
      const envelope = await handler({}, undefined);

      expect(envelope.success).toBe(false);
      if (!envelope.success) {
        expect(envelope.error.code).toBe('ERR_SERVICE_DOWN');
        expect(envelope.error.category).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('Main IPC Handler Registration & Delegation', () => {
    it('registers all allowed IPC channels', () => {
      registerShellIpcHandlers(logger, mockIpcMain);

      expect(handlers.has(IPC_CHANNELS.SHELL_PING)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.SHELL_GET_VERSION)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.AUTH_GET_CURRENT_USER)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.HARDWARE_GET_INFO)).toBe(true);
      expect(handlers.has(IPC_CHANNELS.PROVIDER_GET_STATUS)).toBe(true);
    });

    it('shell:ping handler returns enveloped pong', async () => {
      registerShellIpcHandlers(logger, mockIpcMain);
      const pingFn = handlers.get(IPC_CHANNELS.SHELL_PING)!;
      const res: IpcResponseSuccess<string> = await pingFn({}, undefined);

      expect(res.success).toBe(true);
      expect(res.data).toBe('pong');
    });

    it('delegates to injected AuthService for auth:get-current-user', async () => {
      const mockUser: User = {
        id: 'usr_123',
        email: 'test@c3.cloud',
        username: 'c3dev',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const services: ApplicationServices = {
        authService: {
          getCurrentUser: async () => mockUser,
          register: async () => mockUser,
          confirmRegistration: async () => true,
          login: async () => ({ token: 'tkn', refreshToken: 'rtkn', expiresAt: new Date(), user: mockUser }),
          logout: async () => {},
          restoreSession: async () => null,
        },
      };

      registerShellIpcHandlers(logger, mockIpcMain, services);
      const getUserFn = handlers.get(IPC_CHANNELS.AUTH_GET_CURRENT_USER)!;
      const res = await getUserFn({}, undefined);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockUser);
    });

    it('returns null when service is not injected', async () => {
      registerShellIpcHandlers(logger, mockIpcMain, {});
      const getUserFn = handlers.get(IPC_CHANNELS.AUTH_GET_CURRENT_USER)!;
      const res = await getUserFn({}, undefined);

      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    });

    it('unregisters all handlers cleanly', () => {
      registerShellIpcHandlers(logger, mockIpcMain);
      expect(handlers.size).toBe(5);

      unregisterShellIpcHandlers(mockIpcMain);
      expect(handlers.size).toBe(0);
    });
  });
});
