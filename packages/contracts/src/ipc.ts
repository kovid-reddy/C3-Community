/**
 * C3 — Typed IPC Contracts & Boundary Definitions
 *
 * Provides strongly typed IPC channel mappings, request/response envelopes,
 * and error payload contracts for inter-process communication between the
 * Renderer and Main process.
 *
 * Pure interface and type definitions. ZERO runtime code / zero dependencies.
 */

import type { User, HardwareInfo, ProviderStatus } from './index';

// ── 1. Channel Registry ───────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  SHELL_PING: 'shell:ping',
  SHELL_GET_VERSION: 'shell:get-version',
  AUTH_GET_CURRENT_USER: 'auth:get-current-user',
  HARDWARE_GET_INFO: 'hardware:get-info',
  PROVIDER_GET_STATUS: 'provider:get-status',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ── 2. Channel Contract Map ───────────────────────────────────────────────────

export interface IpcChannelMap {
  'shell:ping': {
    request: void;
    response: string;
  };
  'shell:get-version': {
    request: void;
    response: string;
  };
  'auth:get-current-user': {
    request: void;
    response: User | null;
  };
  'hardware:get-info': {
    request: void;
    response: HardwareInfo | null;
  };
  'provider:get-status': {
    request: void;
    response: ProviderStatus | null;
  };
}

// ── 3. Request / Response Envelopes ──────────────────────────────────────────

export interface IpcRequestEnvelope<T = unknown> {
  readonly id: string;
  readonly channel: string;
  readonly payload: T;
  readonly timestamp: number;
}

export interface IpcResponseSuccess<T = unknown> {
  readonly success: true;
  readonly data: T;
  readonly error?: undefined;
}

export interface IpcResponseFailure {
  readonly success: false;
  readonly data?: undefined;
  readonly error: Record<string, unknown>;
}

export type IpcResponseEnvelope<T = unknown> = IpcResponseSuccess<T> | IpcResponseFailure;
