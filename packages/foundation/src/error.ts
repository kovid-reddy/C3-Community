/**
 * C3 Error Model
 * Unified application error model for structured error handling across services.
 */

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
      this.metadata = options.metadata;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
    if (this.metadata !== undefined) {
      result.metadata = this.metadata;
    }
    return result;
  }
}
