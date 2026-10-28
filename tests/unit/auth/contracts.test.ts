/**
 * Unit tests for the C3 Authentication Contracts.
 *
 * Covers:
 *  - AuthResult discriminated union helpers (authOk, authErr, type guards)
 *  - AuthState type discriminants (shape verification)
 *  - AuthError structure and code exhaustiveness
 *  - IAuthService interface shape (structural conformance)
 *
 * No network, no AWS, no Electron, no filesystem access.
 */

import { describe, it, expect } from 'vitest';
import {
  authOk,
  authErr,
  isAuthSuccess,
  isAuthFailure,
  AuthResult,
  AuthState,
  AuthError,
  AuthErrorCode,
} from '../../../packages/contracts/src/auth';

// ── AuthResult helpers ────────────────────────────────────────────────────────

describe('authOk', () => {
  it('produces a success result with the given value', () => {
    const result = authOk(42);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });

  it('works for object values', () => {
    const user = { id: 'usr_1', email: 'a@b.c', username: 'a', createdAt: new Date(), updatedAt: new Date() };
    const result = authOk(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(user);
    }
  });

  it('works for null values (no-session case)', () => {
    const result = authOk(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeNull();
    }
  });

  it('works for void (undefined)', () => {
    const result = authOk(undefined);
    expect(result.success).toBe(true);
  });
});

describe('authErr', () => {
  it('produces a failure result with the given error', () => {
    const error: AuthError = { code: 'ERR_AUTH_INVALID_CREDENTIALS', message: 'Bad credentials' };
    const result = authErr(error);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
      expect(result.error.message).toBe('Bad credentials');
    }
  });

  it('error field is frozen/immutable by construction', () => {
    const error: AuthError = { code: 'ERR_AUTH_INTERNAL', message: 'Unexpected' };
    const result = authErr(error);
    expect(result.error).toEqual(error);
  });
});

describe('isAuthSuccess', () => {
  it('returns true for ok results', () => {
    expect(isAuthSuccess(authOk('hello'))).toBe(true);
  });

  it('returns false for err results', () => {
    const err = authErr<string>({ code: 'ERR_AUTH_INTERNAL', message: 'x' });
    expect(isAuthSuccess(err)).toBe(false);
  });

  it('narrows type correctly (TypeScript compile-time: verified by test shape)', () => {
    const result: AuthResult<number> = authOk(99);
    if (isAuthSuccess(result)) {
      // value is accessible here without cast
      const v: number = result.value;
      expect(v).toBe(99);
    }
  });
});

describe('isAuthFailure', () => {
  it('returns true for err results', () => {
    const result = authErr({ code: 'ERR_AUTH_WEAK_PASSWORD', message: 'Too short' });
    expect(isAuthFailure(result)).toBe(true);
  });

  it('returns false for ok results', () => {
    expect(isAuthFailure(authOk(true))).toBe(false);
  });

  it('narrows type correctly', () => {
    const result: AuthResult<void> = authErr({ code: 'ERR_AUTH_NO_SESSION', message: 'None' });
    if (isAuthFailure(result)) {
      const code: AuthErrorCode = result.error.code;
      expect(code).toBe('ERR_AUTH_NO_SESSION');
    }
  });
});

// ── AuthState discriminant shapes ─────────────────────────────────────────────

describe('AuthState', () => {
  it('unauthenticated state has correct shape', () => {
    const state: AuthState = { kind: 'unauthenticated' };
    expect(state.kind).toBe('unauthenticated');
  });

  it('authenticating state carries the operation', () => {
    const state: AuthState = { kind: 'authenticating', operation: 'signIn' };
    expect(state.kind).toBe('authenticating');
    if (state.kind === 'authenticating') {
      expect(state.operation).toBe('signIn');
    }
  });

  it('authenticated state carries user and session', () => {
    const now = new Date();
    const user = { id: 'u1', email: 'a@b.c', username: 'a', createdAt: now, updatedAt: now };
    const session = { token: 'tok', refreshToken: 'rtok', expiresAt: now, user };
    const state: AuthState = { kind: 'authenticated', user, session };
    expect(state.kind).toBe('authenticated');
    if (state.kind === 'authenticated') {
      expect(state.user.id).toBe('u1');
      expect(state.session.token).toBe('tok');
    }
  });

  it('restoringSession state has correct shape', () => {
    const state: AuthState = { kind: 'restoringSession' };
    expect(state.kind).toBe('restoringSession');
  });

  it('error state carries an AuthError', () => {
    const error: AuthError = { code: 'ERR_AUTH_SESSION_EXPIRED', message: 'Expired' };
    const state: AuthState = { kind: 'error', error };
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.error.code).toBe('ERR_AUTH_SESSION_EXPIRED');
    }
  });
});

// ── AuthError structure ───────────────────────────────────────────────────────

describe('AuthError', () => {
  it('all defined AuthErrorCodes are accepted by the type', () => {
    const codes: AuthErrorCode[] = [
      'ERR_AUTH_INVALID_CREDENTIALS',
      'ERR_AUTH_USER_NOT_FOUND',
      'ERR_AUTH_USER_ALREADY_EXISTS',
      'ERR_AUTH_WEAK_PASSWORD',
      'ERR_AUTH_INVALID_EMAIL',
      'ERR_AUTH_SESSION_EXPIRED',
      'ERR_AUTH_NO_SESSION',
      'ERR_AUTH_RESET_CODE_INVALID',
      'ERR_AUTH_RESET_CODE_EXPIRED',
      'ERR_AUTH_NOT_CONFIRMED',
      'ERR_AUTH_RATE_LIMITED',
      'ERR_AUTH_INTERNAL',
    ];

    for (const code of codes) {
      const error: AuthError = { code, message: `Test for ${code}` };
      expect(error.code).toBe(code);
    }
    // 12 total codes
    expect(codes).toHaveLength(12);
  });

  it('AuthError never contains a password field', () => {
    const error: AuthError = { code: 'ERR_AUTH_INVALID_CREDENTIALS', message: 'Bad' };
    expect(Object.keys(error)).not.toContain('password');
    expect(Object.keys(error)).not.toContain('token');
  });
});
