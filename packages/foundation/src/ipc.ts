/**
 * C3 Foundation — IPC Transport Runtime Helpers
 *
 * Provides generic runtime utilities for constructing IPC response envelopes,
 * checking envelope types, and wrapping main-process handlers safely.
 */

import type {
  IpcChannelMap,
  IpcResponseEnvelope,
  IpcResponseSuccess,
  IpcResponseFailure,
} from '@c3/contracts';
import { serializeError } from './error';

export function createIpcSuccessResponse<T>(data: T): IpcResponseSuccess<T> {
  return {
    success: true,
    data,
  };
}

export function createIpcErrorResponse(err: unknown): IpcResponseFailure {
  return {
    success: false,
    error: serializeError(err),
  };
}

export function isIpcSuccess<T>(
  response: IpcResponseEnvelope<T>
): response is IpcResponseSuccess<T> {
  return response !== null && typeof response === 'object' && response.success === true;
}

export function isIpcFailure<T>(
  response: IpcResponseEnvelope<T>
): response is IpcResponseFailure {
  return response !== null && typeof response === 'object' && response.success === false;
}

export function createIpcHandler<K extends keyof IpcChannelMap>(
  serviceMethod: (payload: IpcChannelMap[K]['request']) => Promise<IpcChannelMap[K]['response']> | IpcChannelMap[K]['response']
) {
  return async (
    _event: unknown,
    payload?: unknown
  ): Promise<IpcResponseEnvelope<IpcChannelMap[K]['response']>> => {
    try {
      const data = await serviceMethod(payload as IpcChannelMap[K]['request']);
      return createIpcSuccessResponse(data);
    } catch (err) {
      return createIpcErrorResponse(err);
    }
  };
}
