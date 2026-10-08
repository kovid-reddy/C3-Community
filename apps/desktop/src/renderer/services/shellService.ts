/**
 * C3 Desktop Renderer — Shell Access Service
 *
 * Provides a clean access layer for the preloaded C3 Shell IPC bridge (window.c3Shell).
 * The renderer accesses desktop capabilities ONLY through this service or window.c3Shell.
 */

import type { C3ShellAPI } from '../../preload/index';
import type { SecurityCheckStatus, ShellInfo } from '../types/rendererState';

/**
 * Retrieves the window.c3Shell preload bridge instance safely.
 * Returns null if window is undefined or the bridge has not been injected.
 */
export function getC3ShellAPI(): C3ShellAPI | null {
  if (typeof window !== 'undefined' && window.c3Shell) {
    return window.c3Shell;
  }
  return null;
}

/**
 * Initializes renderer-to-main IPC communication by verifying shell bridge availability,
 * executing ping(), and fetching application version.
 */
export async function initializeShell(): Promise<ShellInfo> {
  const api = getC3ShellAPI();
  if (!api) {
    throw new Error('C3 Desktop Preload Bridge (window.c3Shell) is unavailable.');
  }

  const [ping, version] = await Promise.all([
    api.ping(),
    api.getVersion(),
  ]);

  return {
    ping,
    version,
    platform: api.platform || 'unknown',
  };
}

/**
 * Inspects global window environment to verify runtime context isolation
 * and absence of privileged Node.js APIs inside the Chromium renderer sandbox.
 */
export function performSecurityCheck(): SecurityCheckStatus {
  if (typeof window === 'undefined') {
    return {
      processUndefined: true,
      requireUndefined: true,
      moduleUndefined: true,
      allSecure: true,
    };
  }

  const win = window as unknown as Record<string, unknown>;
  const processUndefined = typeof win['process'] === 'undefined';
  const requireUndefined = typeof win['require'] === 'undefined';
  const moduleUndefined = typeof win['module'] === 'undefined';

  return {
    processUndefined,
    requireUndefined,
    moduleUndefined,
    allSecure: processUndefined && requireUndefined && moduleUndefined,
  };
}
