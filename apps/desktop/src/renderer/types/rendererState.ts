/**
 * C3 Desktop Renderer — State Types
 *
 * Defines explicit discriminated union states for renderer initialization and lifecycle.
 */

export type RendererStatus = 'initializing' | 'ready' | 'error';

export interface ShellInfo {
  version: string;
  ping: string;
  platform: string;
}

export interface RendererErrorInfo {
  code: string;
  message: string;
  userFacingMessage: string;
}

export type RendererState =
  | { status: 'initializing' }
  | { status: 'ready'; info: ShellInfo }
  | { status: 'error'; error: RendererErrorInfo };

export interface SecurityCheckStatus {
  processUndefined: boolean;
  requireUndefined: boolean;
  moduleUndefined: boolean;
  allSecure: boolean;
}
