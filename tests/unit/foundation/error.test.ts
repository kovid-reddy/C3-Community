import { describe, it, expect } from 'vitest';
import {
  AppError,
  isAppError,
  normalizeError,
  serializeError,
  AppErrorCategory,
} from '../../../packages/foundation/src';

describe('AppError & Error Utilities', () => {
  it('should construct AppError with all properties', () => {
    const causeError = new Error('Root cause');
    const appError = new AppError({
      code: 'ERR_RESOURCE_EXHAUSTED',
      category: 'RESOURCE_ERROR',
      message: 'Out of GPU memory',
      retryable: true,
      cause: causeError,
      metadata: { requestedGpuBytes: 16106127360 },
    });

    expect(appError).toBeInstanceOf(Error);
    expect(appError).toBeInstanceOf(AppError);
    expect(appError.code).toBe('ERR_RESOURCE_EXHAUSTED');
    expect(appError.category).toBe('RESOURCE_ERROR');
    expect(appError.message).toBe('Out of GPU memory');
    expect(appError.retryable).toBe(true);
    expect(appError.cause).toBe(causeError);
    expect(appError.metadata).toEqual({ requestedGpuBytes: 16106127360 });
  });

  it('should verify all defined AppError categories', () => {
    const categories: AppErrorCategory[] = [
      'VALIDATION_ERROR',
      'AUTH_ERROR',
      'NETWORK_ERROR',
      'PROVIDER_ERROR',
      'CLOUD_ERROR',
      'CLUSTER_ERROR',
      'COMPUTE_ERROR',
      'JOB_ERROR',
      'RESOURCE_ERROR',
      'CONFIG_ERROR',
      'INTERNAL_ERROR',
    ];

    for (const category of categories) {
      const err = new AppError({
        code: `ERR_${category}`,
        category,
        message: `Error for category ${category}`,
      });
      expect(err.category).toBe(category);
    }
  });

  it('should validate isAppError type guard', () => {
    const appErr = new AppError({ code: 'ERR_TEST', category: 'INTERNAL_ERROR', message: 'test' });
    const nativeErr = new Error('native');
    const plainObj = { message: 'obj' };

    expect(isAppError(appErr)).toBe(true);
    expect(isAppError(nativeErr)).toBe(false);
    expect(isAppError(plainObj)).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it('should normalize native Error objects correctly', () => {
    const nativeErr = new TypeError('Invalid type provided');
    const normalized = normalizeError(nativeErr, 'VALIDATION_ERROR', 'ERR_INVALID_TYPE');

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.category).toBe('VALIDATION_ERROR');
    expect(normalized.code).toBe('ERR_INVALID_TYPE');
    expect(normalized.message).toBe('Invalid type provided');
    expect(normalized.cause).toBe(nativeErr);
    expect(normalized.metadata?.originalName).toBe('TypeError');
  });

  it('should normalize unknown thrown primitives correctly', () => {
    const strErr = normalizeError('String error message');
    expect(strErr.category).toBe('INTERNAL_ERROR');
    expect(strErr.code).toBe('ERR_INTERNAL_ERROR');
    expect(strErr.message).toBe('String error message');

    const unknownObjErr = normalizeError({ customCode: 500 });
    expect(unknownObjErr.category).toBe('INTERNAL_ERROR');
    expect(unknownObjErr.message).toBe('An unknown error occurred.');
    expect(unknownObjErr.cause).toEqual({ customCode: 500 });
  });

  it('should safely serialize errors and protect secrets in metadata/cause', () => {
    const appErr = new AppError({
      code: 'ERR_AUTH_FAILED',
      category: 'AUTH_ERROR',
      message: 'Authentication failed',
      cause: { secretToken: 'my-super-secret-token' },
      metadata: {
        username: 'alice',
        password: 'my-secret-password',
        nested: {
          clientSecret: 'secret-12345',
          publicInfo: 'visible',
        },
      },
    });

    const serialized = serializeError(appErr);

    expect(serialized.name).toBe('AppError');
    expect(serialized.code).toBe('ERR_AUTH_FAILED');
    expect(serialized.category).toBe('AUTH_ERROR');
    expect(serialized.message).toBe('Authentication failed');

    const metadata = serialized.metadata as Record<string, unknown>;
    expect(metadata.username).toBe('alice');
    expect(metadata.password).toBe('[REDACTED]');

    const nested = metadata.nested as Record<string, unknown>;
    expect(nested.clientSecret).toBe('[REDACTED]');
    expect(nested.publicInfo).toBe('visible');

    const cause = serialized.cause as Record<string, unknown>;
    expect(cause.secretToken).toBe('[REDACTED]');
  });
});
