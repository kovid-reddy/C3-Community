/**
 * Unit tests for the C3 Authentication State Machine.
 *
 * Covers:
 *  - All legal transition constructors
 *  - validateTransition: allowed and forbidden transitions
 *  - isInProgress guard
 *
 * No I/O, no async, no network.
 */

import { describe, it, expect } from 'vitest';
import {
  unauthenticated,
  authenticating,
  authenticated,
  restoringSession,
  authError,
  isInProgress,
  validateTransition,
} from '../../../packages/auth/src/state-machine';
import type { AuthUser, AuthSessionData } from '../../../packages/contracts/src/auth';

// ── Helper fixtures ────────────────────────────────────────────────────────────

const now = new Date('2026-01-01T00:00:00.000Z');

const MOCK_USER: AuthUser = {
  id: 'usr_test-1',
  email: 'test@example.test',
  username: 'test',
  createdAt: now,
  updatedAt: now,
};

const MOCK_SESSION: AuthSessionData = {
  token: 'tok_test-1',
  refreshToken: 'rtok_test-1',
  expiresAt: new Date(now.getTime() + 3600_000),
  user: MOCK_USER,
};

const MOCK_ERROR = { code: 'ERR_AUTH_INVALID_CREDENTIALS' as const, message: 'Bad credentials' };

// ── State constructors ─────────────────────────────────────────────────────────

describe('State constructors', () => {
  it('unauthenticated() produces the correct shape', () => {
    const s = unauthenticated();
    expect(s.kind).toBe('unauthenticated');
  });

  it('authenticating() carries the operation', () => {
    const signIn = authenticating('signIn');
    expect(signIn.kind).toBe('authenticating');
    if (signIn.kind === 'authenticating') expect(signIn.operation).toBe('signIn');

    const signUp = authenticating('signUp');
    if (signUp.kind === 'authenticating') expect(signUp.operation).toBe('signUp');

    const signOut = authenticating('signOut');
    if (signOut.kind === 'authenticating') expect(signOut.operation).toBe('signOut');
  });

  it('authenticated() carries user and session', () => {
    const s = authenticated(MOCK_USER, MOCK_SESSION);
    expect(s.kind).toBe('authenticated');
    if (s.kind === 'authenticated') {
      expect(s.user).toBe(MOCK_USER);
      expect(s.session).toBe(MOCK_SESSION);
    }
  });

  it('restoringSession() produces the correct shape', () => {
    const s = restoringSession();
    expect(s.kind).toBe('restoringSession');
  });

  it('authError() carries the AuthError', () => {
    const s = authError(MOCK_ERROR);
    expect(s.kind).toBe('error');
    if (s.kind === 'error') expect(s.error).toBe(MOCK_ERROR);
  });
});

// ── validateTransition ────────────────────────────────────────────────────────

describe('validateTransition — allowed transitions', () => {
  const ALLOWED: Array<[string, ReturnType<typeof unauthenticated | typeof authenticating | typeof restoringSession | typeof authError>, ReturnType<typeof unauthenticated | typeof authenticating | typeof restoringSession | typeof authError>]> = [
    ['unauthenticated → authenticating(signIn)', unauthenticated(), authenticating('signIn')],
    ['unauthenticated → authenticating(signUp)', unauthenticated(), authenticating('signUp')],
    ['unauthenticated → restoringSession',       unauthenticated(), restoringSession()],
    ['authenticating  → unauthenticated',        authenticating('signIn'), unauthenticated()],
    ['authenticating  → error',                  authenticating('signIn'), authError(MOCK_ERROR)],
    ['restoringSession → unauthenticated',        restoringSession(), unauthenticated()],
    ['restoringSession → error',                  restoringSession(), authError(MOCK_ERROR)],
    ['authenticated   → authenticating(signOut)', authenticated(MOCK_USER, MOCK_SESSION), authenticating('signOut')],
    ['authenticated   → unauthenticated',         authenticated(MOCK_USER, MOCK_SESSION), unauthenticated()],
    ['authenticated   → error',                   authenticated(MOCK_USER, MOCK_SESSION), authError(MOCK_ERROR)],
    ['error           → unauthenticated',          authError(MOCK_ERROR), unauthenticated()],
    ['error           → authenticating(signIn)',   authError(MOCK_ERROR), authenticating('signIn')],
  ];

  for (const [label, from, to] of ALLOWED) {
    it(`allows: ${label}`, () => {
      const result = validateTransition(from, to);
      expect(result.allowed).toBe(true);
    });
  }

  it('allows authenticating → authenticated', () => {
    const result = validateTransition(authenticating('signIn'), authenticated(MOCK_USER, MOCK_SESSION));
    expect(result.allowed).toBe(true);
  });

  it('allows restoringSession → authenticated', () => {
    const result = validateTransition(restoringSession(), authenticated(MOCK_USER, MOCK_SESSION));
    expect(result.allowed).toBe(true);
  });
});

describe('validateTransition — forbidden transitions', () => {
  const FORBIDDEN: Array<[string, Parameters<typeof validateTransition>[0], Parameters<typeof validateTransition>[1]]> = [
    ['unauthenticated → authenticated (no operation)',  unauthenticated(), authenticated(MOCK_USER, MOCK_SESSION)],
    ['unauthenticated → error (no operation)',           unauthenticated(), authError(MOCK_ERROR)],
    ['restoringSession → authenticating',               restoringSession(), authenticating('signIn')],
    ['authenticated   → restoringSession',              authenticated(MOCK_USER, MOCK_SESSION), restoringSession()],
    ['error           → authenticated (no operation)',   authError(MOCK_ERROR), authenticated(MOCK_USER, MOCK_SESSION)],
    ['error           → restoringSession',               authError(MOCK_ERROR), restoringSession()],
  ];

  for (const [label, from, to] of FORBIDDEN) {
    it(`forbids: ${label}`, () => {
      const result = validateTransition(from, to);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain('Invalid transition');
      }
    });
  }
});

describe('validateTransition — same-state transitions are always allowed', () => {
  it('unauthenticated → unauthenticated', () => {
    expect(validateTransition(unauthenticated(), unauthenticated()).allowed).toBe(true);
  });

  it('error → error', () => {
    expect(validateTransition(authError(MOCK_ERROR), authError(MOCK_ERROR)).allowed).toBe(true);
  });
});

// ── isInProgress ───────────────────────────────────────────────────────────────

describe('isInProgress', () => {
  it('returns true for authenticating state', () => {
    expect(isInProgress(authenticating('signIn'))).toBe(true);
    expect(isInProgress(authenticating('signUp'))).toBe(true);
    expect(isInProgress(authenticating('signOut'))).toBe(true);
  });

  it('returns true for restoringSession state', () => {
    expect(isInProgress(restoringSession())).toBe(true);
  });

  it('returns false for unauthenticated', () => {
    expect(isInProgress(unauthenticated())).toBe(false);
  });

  it('returns false for authenticated', () => {
    expect(isInProgress(authenticated(MOCK_USER, MOCK_SESSION))).toBe(false);
  });

  it('returns false for error', () => {
    expect(isInProgress(authError(MOCK_ERROR))).toBe(false);
  });
});
