/**
 * C3 Error Model
 * Unified application error model for structured error handling across services.
 */

import { sanitizeLogMetadata } from './logging';

export type AppErrorCategory =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'CLOUD_ERROR'
  | 'CLUSTER_ERROR'
  | 'COMPUTE_ERROR'
  | 'JOB_ERROR'
  | 'RESOURCE_ERROR'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export interface AppErrorOptions {
  readonly code: string;
  readonly category: AppErrorCategory;
  readonly message: string;
  readonly retryable?: boolean;
  readonly cause?: Error | unknown;
  readonly metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly category: AppErrorCategory;
  readonly retryable: boolean;
  readonly cause?: Error | unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    if (options.metadata !== undefined) {
      this.metadata = Object.freeze({ ...options.metadata });
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return serializeError(this);
  }
}

/**
 * Type guard to check if an error is an AppError instance.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError || (err instanceof Error && err.name === 'AppError' && 'category' in err && 'code' in err);
}

/**
 * Normalizes any error or unknown thrown value into a consistent AppError.
 */
export function normalizeError(
  err: unknown,
  defaultCategory: AppErrorCategory = 'INTERNAL_ERROR',
  defaultCode = 'ERR_INTERNAL_ERROR'
): AppError {
  if (isAppError(err)) {
    return err;
  }

  if (err instanceof Error) {
    return new AppError({
      code: defaultCode,
      category: defaultCategory,
      message: err.message || 'An unexpected error occurred.',
      cause: err,
      metadata: { originalName: err.name },
    });
  }

  if (typeof err === 'string') {
    return new AppError({
      code: defaultCode,
      category: defaultCategory,
      message: err,
      cause: err,
    });
  }

  return new AppError({
    code: defaultCode,
    category: defaultCategory,
    message: 'An unknown error occurred.',
    cause: err,
  });
}

/**
 * Safely serializes an error into a JSON-friendly object, ensuring secret redaction.
 */
export function serializeError(
  err: unknown,
  includeStack = false
): Record<string, unknown> {
  const normalized = normalizeError(err);

  const serialized: Record<string, unknown> = {
    name: normalized.name,
    code: normalized.code,
    category: normalized.category,
    message: normalized.message,
    retryable: normalized.retryable,
  };

  if (includeStack && normalized.stack) {
    serialized.stack = normalized.stack;
  }

  if (normalized.cause !== undefined) {
    if (normalized.cause instanceof Error) {
      serialized.cause = {
        name: normalized.cause.name,
        message: normalized.cause.message,
        ...(includeStack && normalized.cause.stack ? { stack: normalized.cause.stack } : {}),
      };
    } else if (typeof normalized.cause === 'object' && normalized.cause !== null) {
      serialized.cause = sanitizeLogMetadata(normalized.cause as Record<string, unknown>);
    } else {
      serialized.cause = normalized.cause;
    }
  }

  if (normalized.metadata !== undefined) {
    serialized.metadata = sanitizeLogMetadata(normalized.metadata);
  }

  return serialized;
}

/**
 * Reconstructs an AppError instance from a serialized error object (e.g. across IPC boundary).
 */
export function deserializeError(serialized: unknown): AppError {
  if (isAppError(serialized)) {
    return serialized;
  }

  if (typeof serialized === 'object' && serialized !== null) {
    const s = serialized as Record<string, unknown>;
    const options: AppErrorOptions = {
      code: typeof s['code'] === 'string' ? s['code'] : 'ERR_INTERNAL_ERROR',
      category: (s['category'] as AppErrorCategory) || 'INTERNAL_ERROR',
      message: typeof s['message'] === 'string' ? s['message'] : 'An unexpected error occurred.',
      retryable: Boolean(s['retryable']),
    };

    if (typeof s['metadata'] === 'object' && s['metadata'] !== null) {
      (options as { metadata?: Record<string, unknown> }).metadata = s['metadata'] as Record<string, unknown>;
    }

    return new AppError(options);
  }

  return normalizeError(serialized);
}
