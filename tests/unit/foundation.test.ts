import { describe, it, expect } from 'vitest';
import { AppError, sanitizeLogMetadata } from '../../packages/foundation/src';

describe('Foundation Error Model & Sanitizer', () => {
  it('should construct AppError with correct category, code, and properties', () => {
    const error = new AppError({
      code: 'ERR_AUTH_EXPIRED',
      category: 'AUTH_ERROR',
      message: 'Session token has expired',
      retryable: true,
      metadata: { userId: 'user_123' },
    });

    expect(error.code).toBe('ERR_AUTH_EXPIRED');
    expect(error.category).toBe('AUTH_ERROR');
    expect(error.message).toBe('Session token has expired');
    expect(error.retryable).toBe(true);
    expect(error.metadata).toEqual({ userId: 'user_123' });
  });

  it('should sanitize sensitive keys from log metadata', () => {
    const rawMeta = {
      user: 'alice',
      password: 'supersecretpassword',
      accessToken: 'jwt.token.here',
      nested: {
        refreshToken: 'refresh.token.here',
        safeValue: 42,
      },
    };

    const sanitized = sanitizeLogMetadata(rawMeta);

    expect(sanitized.user).toBe('alice');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).refreshToken).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).safeValue).toBe(42);
  });
});
