/**
 * C3 Desktop Renderer — Unit Tests
 *
 * Verifies Stage 2C React Renderer Foundation:
 *   1. Application rendering (App, ShellLayout, StatusCard, SecurityCheckCard)
 *   2. Shell Initialization flow (loading, ping(), version retrieval, ready state)
 *   3. Failure handling (IPC initialization failure, ErrorBoundary error trapping)
 *   4. Security boundary (relies on window.c3Shell, checks Node isolation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { C3ShellAPI } from '../../../apps/desktop/src/preload/index';
import {
  getC3ShellAPI,
  initializeShell,
  performSecurityCheck,
} from '../../../apps/desktop/src/renderer/services/shellService';
import { LoadingView } from '../../../apps/desktop/src/renderer/components/LoadingView';
import { ErrorView } from '../../../apps/desktop/src/renderer/components/ErrorView';
import { StatusCard } from '../../../apps/desktop/src/renderer/components/StatusCard';
import { SecurityCheckCard } from '../../../apps/desktop/src/renderer/components/SecurityCheckCard';
import { ShellLayout } from '../../../apps/desktop/src/renderer/components/ShellLayout';
import { ErrorBoundary } from '../../../apps/desktop/src/renderer/components/ErrorBoundary';

describe('Stage 2C — React Renderer Foundation', () => {
  let mockShellApi: C3ShellAPI;
  const originalWindow = global.window;

  beforeEach(() => {
    mockShellApi = {
      ping: vi.fn().mockResolvedValue('pong'),
      getVersion: vi.fn().mockResolvedValue('0.2.3'),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      getHardwareInfo: vi.fn().mockResolvedValue(null),
      getProviderStatus: vi.fn().mockResolvedValue(null),
      platform: 'win32',
    };

    // Mock window context for renderer testing
    const fakeWindow = {
      c3Shell: mockShellApi,
    } as unknown as Window & typeof globalThis;

    global.window = fakeWindow;
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('Initialization & Shell Service', () => {
    it('getC3ShellAPI returns window.c3Shell when present', () => {
      const api = getC3ShellAPI();
      expect(api).toBe(mockShellApi);
    });

    it('getC3ShellAPI returns null when window.c3Shell is undefined', () => {
      (global.window as any).c3Shell = undefined;
      expect(getC3ShellAPI()).toBeNull();
    });

    it('initializeShell consumes ping() and getVersion() from window.c3Shell', async () => {
      const info = await initializeShell();

      expect(mockShellApi.ping).toHaveBeenCalledTimes(1);
      expect(mockShellApi.getVersion).toHaveBeenCalledTimes(1);
      expect(info).toEqual({
        ping: 'pong',
        version: '0.2.3',
        platform: 'win32',
      });
    });

    it('initializeShell throws descriptive error when window.c3Shell is missing', async () => {
      (global.window as any).c3Shell = undefined;

      await expect(initializeShell()).rejects.toThrow(
        'C3 Desktop Preload Bridge (window.c3Shell) is unavailable.'
      );
    });

    it('initializeShell propagates IPC failure when ping() fails', async () => {
      (mockShellApi.ping as any).mockRejectedValueOnce(new Error('IPC transport disconnected'));

      await expect(initializeShell()).rejects.toThrow('IPC transport disconnected');
    });
  });

  describe('Security Boundary Verification', () => {
    it('performSecurityCheck verifies process, require, and module are undefined in sandboxed renderer', () => {
      const security = performSecurityCheck();

      expect(security.processUndefined).toBe(true);
      expect(security.requireUndefined).toBe(true);
      expect(security.moduleUndefined).toBe(true);
      expect(security.allSecure).toBe(true);
    });

    it('performSecurityCheck flags exposed Node APIs if present in window', () => {
      (global.window as any).process = { version: 'v20.0.0' };
      (global.window as any).require = vi.fn();

      const security = performSecurityCheck();

      expect(security.processUndefined).toBe(false);
      expect(security.requireUndefined).toBe(false);
      expect(security.moduleUndefined).toBe(true);
      expect(security.allSecure).toBe(false);
    });
  });

  describe('Component Rendering & State Views', () => {
    it('LoadingView renders initializing state content', () => {
      const html = renderToStaticMarkup(React.createElement(LoadingView));

      expect(html).toContain('Initializing Desktop Runtime…');
      expect(html).toContain('Verifying window.c3Shell IPC bridge');
      expect(html).toContain('loading-spinner');
    });

    it('ErrorView renders initialization error details safely', () => {
      const errorInfo = {
        code: 'ERR_IPC_INIT_FAILED',
        message: 'Internal bridge breakdown',
        userFacingMessage: 'Unable to connect to C3 desktop shell IPC bridge.',
      };
      const html = renderToStaticMarkup(React.createElement(ErrorView, { error: errorInfo }));

      expect(html).toContain('Initialization Failure');
      expect(html).toContain('Unable to connect to C3 desktop shell IPC bridge.');
      expect(html).toContain('ERR_IPC_INIT_FAILED');
      // Verify sensitive message is not dumped into user title
      expect(html).not.toContain('Internal bridge breakdown');
    });

    it('StatusCard renders version, ping, and platform from ShellInfo', () => {
      const info = { version: '1.0.0', ping: 'pong', platform: 'darwin' };
      const html = renderToStaticMarkup(React.createElement(StatusCard, { info }));

      expect(html).toContain('Desktop Shell Runtime');
      expect(html).toContain('1.0.0');
      expect(html).toContain('pong');
      expect(html).toContain('darwin');
    });

    it('SecurityCheckCard renders security status banner', () => {
      const security = {
        processUndefined: true,
        requireUndefined: true,
        moduleUndefined: true,
        allSecure: true,
      };
      const html = renderToStaticMarkup(React.createElement(SecurityCheckCard, { security }));

      expect(html).toContain('Security &amp; Sandbox Verification');
      expect(html).toContain('Renderer Sandbox Isolation Enforced');
      expect(html).toContain('Blocked');
    });

    it('ShellLayout composes header, main cards, and footer', () => {
      const info = { version: '0.2.0', ping: 'pong', platform: 'linux' };
      const security = { processUndefined: true, requireUndefined: true, moduleUndefined: true, allSecure: true };
      const html = renderToStaticMarkup(React.createElement(ShellLayout, { info, security }));

      expect(html).toContain('Community Compute Cloud');
      expect(html).toContain('Desktop Renderer Foundation');
      expect(html).toContain('Stage 2C — React Renderer Foundation Architecture');
    });
  });

  describe('Error Boundary Trapping', () => {
    it('ErrorBoundary renders children when no error occurs', () => {
      const child = React.createElement('div', { id: 'child' }, 'Normal UI');
      const html = renderToStaticMarkup(React.createElement(ErrorBoundary, null, child));

      expect(html).toContain('Normal UI');
      expect(html).not.toContain('Unexpected Interface Error');
    });

    it('ErrorBoundary renders custom fallback when provided', () => {
      const fallback = React.createElement('div', null, 'Custom Fallback');

      const boundary = new ErrorBoundary({ children: null, fallback });
      boundary.state = { hasError: true, error: new Error('Render crash') };

      const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
      expect(html).toContain('Custom Fallback');
    });

    it('ErrorBoundary fallback prevents blank screen and shows safe user-facing error message', () => {
      const boundary = new ErrorBoundary({ children: null });
      boundary.state = { hasError: true, error: new Error('Sensitive stack trace leak') };

      const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

      expect(html).toContain('Unexpected Interface Error');
      expect(html).toContain('The application encountered an unexpected visual rendering error.');
      // Verify sensitive error details/stack trace are NOT rendered to user DOM
      expect(html).not.toContain('Sensitive stack trace leak');
    });
  });
});
