/**
 * C3 Desktop Renderer — Shell Initialization Hook
 *
 * Encapsulates startup verification of window.c3Shell.
 * Manages loading, ready, and error states cleanly outside UI components.
 */

import { useState, useEffect, useCallback } from 'react';
import type { RendererState } from '../types/rendererState';
import { initializeShell } from './shellService';

export function useShellInit(): { state: RendererState; retry: () => void } {
  const [state, setState] = useState<RendererState>({ status: 'initializing' });

  const runInit = useCallback(async () => {
    setState({ status: 'initializing' });
    try {
      const info = await initializeShell();
      setState({ status: 'ready', info });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown initialization error';
      console.error('[C3 Renderer Init] Preload bridge initialization failed:', message);
      setState({
        status: 'error',
        error: {
          code: 'ERR_IPC_INIT_FAILED',
          message,
          userFacingMessage: 'Unable to connect to C3 desktop shell IPC bridge.',
        },
      });
    }
  }, []);

  useEffect(() => {
    void runInit();
  }, [runInit]);

  return { state, retry: runInit };
}
