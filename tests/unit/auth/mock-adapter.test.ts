/**
 * Unit tests for the C3 MockAuthAdapter.
 *
 * Covers every IAuthService operation:
 *  - signUp: success, duplicate email, weak password, invalid email
 *  - signIn: success, invalid credentials, unconfirmed account
 *  - signOut: clears session, idempotent
 *  - getCurrentUser: returns user when signed in, null otherwise
 *  - restoreSession: valid, expired, none
 *  - requestPasswordReset: always returns success
 *  - confirmPasswordReset: success, invalid code, expired code, unknown email
 *  - State inspection helpers (accountCount, hasAccount, activeToken)
 *  - reset() clears all state
 *  - Deterministic behaviour with FakeClock
 *  - Password / token not present in error messages or responses
 *
 * No network, no AWS, no Electron, no filesystem access.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthAdapter, MOCK_SEED_USER, MOCK_SEED_RESET_CODE } from '../../../packages/auth/src/mock-adapter';
import { FakeClock } from '../../../packages/foundation/src';
import { isAuthSuccess, isAuthFailure } from '../../../packages/contracts/src/auth';

// ── Shared setup ─────────────────────────────────────────────────────────────

const BASE_TIME = '2026-06-01T00:00:00.000Z';

function makeClock(initial = BASE_TIME): FakeClock {
  return new FakeClock(initial);
}

// ── signUp ────────────────────────────────────────────────────────────────────

describe('MockAuthAdapter.signUp', () => {
  let adapter: MockAuthAdapter;
  let clock: FakeClock;

  beforeEach(() => {
    clock = makeClock();
    adapter = new MockAuthAdapter({ clock, seedFixtures: false });
  });

  it('creates an account and returns AuthUser on success', async () => {
    const result = await adapter.signUp({
      email: 'bob@example.test',
      username: 'bob',
      password: 'Secure123!',
    });

    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value.email).toBe('bob@example.test');
      expect(result.value.username).toBe('bob');
      expect(result.value.id).toMatch(/^usr_/);
      // Password must NOT appear in the returned user
      expect(JSON.stringify(result.value)).not.toContain('Secure123!');
    }
    expect(adapter.accountCount).toBe(1);
    expect(adapter.hasAccount('bob@example.test')).toBe(true);
  });

  it('normalises email to lowercase', async () => {
    const result = await adapter.signUp({
      email: 'BOB@EXAMPLE.TEST',
      username: 'bob',
      password: 'Secure123!',
    });
    expect(isAuthSuccess(result)).toBe(true);
    expect(adapter.hasAccount('bob@example.test')).toBe(true);
  });

  it('fails with ERR_AUTH_USER_ALREADY_EXISTS when email is taken', async () => {
    await adapter.signUp({ email: 'carol@example.test', username: 'carol', password: 'Secure123!' });
    const duplicate = await adapter.signUp({ email: 'carol@example.test', username: 'carol2', password: 'Other456!' });

    expect(isAuthFailure(duplicate)).toBe(true);
    if (isAuthFailure(duplicate)) {
      expect(duplicate.error.code).toBe('ERR_AUTH_USER_ALREADY_EXISTS');
    }
    // Only one account created
    expect(adapter.accountCount).toBe(1);
  });

  it('fails with ERR_AUTH_WEAK_PASSWORD for short passwords', async () => {
    const result = await adapter.signUp({ email: 'dave@example.test', username: 'dave', password: 'abc' });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_WEAK_PASSWORD');
    }
    expect(adapter.accountCount).toBe(0);
  });

  it('fails with ERR_AUTH_INVALID_EMAIL for malformed email', async () => {
    const result = await adapter.signUp({ email: 'not-an-email', username: 'x', password: 'ValidPass1!' });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_INVALID_EMAIL');
    }
  });

  it('fails with ERR_AUTH_INVALID_EMAIL for empty email', async () => {
    const result = await adapter.signUp({ email: '', username: 'x', password: 'ValidPass1!' });
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_INVALID_EMAIL');
    }
  });

  it('assigns unique IDs across multiple sign-ups', async () => {
    const r1 = await adapter.signUp({ email: 'u1@test.test', username: 'u1', password: 'Password1!' });
    const r2 = await adapter.signUp({ email: 'u2@test.test', username: 'u2', password: 'Password2!' });

    expect(isAuthSuccess(r1) && isAuthSuccess(r2)).toBe(true);
    if (isAuthSuccess(r1) && isAuthSuccess(r2)) {
      expect(r1.value.id).not.toBe(r2.value.id);
    }
  });
});

// ── signIn ────────────────────────────────────────────────────────────────────

describe('MockAuthAdapter.signIn', () => {
  let adapter: MockAuthAdapter;
  let clock: FakeClock;

  beforeEach(() => {
    clock = makeClock();
    adapter = new MockAuthAdapter({ clock, seedFixtures: true });
  });

  it('returns a session with the correct user on valid credentials', async () => {
    const result = await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });

    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value.user.email).toBe(MOCK_SEED_USER.email);
      expect(result.value.token).toBeTruthy();
      expect(result.value.refreshToken).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      // Tokens must not be the password
      expect(result.value.token).not.toContain(MOCK_SEED_USER.password);
    }
  });

  it('sets activeToken after successful sign-in', async () => {
    expect(adapter.activeToken).toBeNull();
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    expect(adapter.activeToken).not.toBeNull();
  });

  it('fails with ERR_AUTH_INVALID_CREDENTIALS for wrong password', async () => {
    const result = await adapter.signIn({ email: MOCK_SEED_USER.email, password: 'WrongPass99!' });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
      // Error must not reveal the password
      expect(result.error.message).not.toContain('WrongPass99!');
    }
  });

  it('fails with ERR_AUTH_INVALID_CREDENTIALS for unknown email', async () => {
    const result = await adapter.signIn({ email: 'unknown@example.test', password: 'SomePass1!' });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      // Must not reveal ERR_AUTH_USER_NOT_FOUND (to avoid leaking account existence)
      expect(result.error.code).toBe('ERR_AUTH_INVALID_CREDENTIALS');
    }
  });

  it('fails with ERR_AUTH_NOT_CONFIRMED for unconfirmed account', async () => {
    await adapter.signUp({ email: 'unconfirmed@test.test', username: 'uc', password: 'Secure123!' });
    adapter.setAccountConfirmed('unconfirmed@test.test', false);

    const result = await adapter.signIn({ email: 'unconfirmed@test.test', password: 'Secure123!' });
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_NOT_CONFIRMED');
    }
  });

  it('replaces previous session on repeated sign-in', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    const firstToken = adapter.activeToken;

    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    const secondToken = adapter.activeToken;

    expect(firstToken).not.toBe(secondToken);
  });

  it('is case-insensitive for email', async () => {
    const result = await adapter.signIn({
      email: MOCK_SEED_USER.email.toUpperCase(),
      password: MOCK_SEED_USER.password,
    });
    expect(isAuthSuccess(result)).toBe(true);
  });
});

// ── signOut ────────────────────────────────────────────────────────────────────

describe('MockAuthAdapter.signOut', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter({ clock: makeClock(), seedFixtures: true });
  });

  it('clears the active session', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    expect(adapter.activeToken).not.toBeNull();

    const result = await adapter.signOut();
    expect(isAuthSuccess(result)).toBe(true);
    expect(adapter.activeToken).toBeNull();
  });

  it('is idempotent — signing out twice succeeds', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    await adapter.signOut();
    const second = await adapter.signOut();
    expect(isAuthSuccess(second)).toBe(true);
  });

  it('signing out without signing in returns success', async () => {
    const fresh = new MockAuthAdapter({ seedFixtures: false });
    const result = await fresh.signOut();
    expect(isAuthSuccess(result)).toBe(true);
  });
});

// ── getCurrentUser ─────────────────────────────────────────────────────────────

describe('MockAuthAdapter.getCurrentUser', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter({ clock: makeClock(), seedFixtures: true });
  });

  it('returns null when not signed in', async () => {
    const result = await adapter.getCurrentUser();
    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value).toBeNull();
    }
  });

  it('returns the signed-in user after signIn', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    const result = await adapter.getCurrentUser();
    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value?.email).toBe(MOCK_SEED_USER.email);
    }
  });

  it('returns null after signOut', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    await adapter.signOut();
    const result = await adapter.getCurrentUser();
    if (isAuthSuccess(result)) {
      expect(result.value).toBeNull();
    }
  });
});

// ── restoreSession ────────────────────────────────────────────────────────────

describe('MockAuthAdapter.restoreSession', () => {
  let clock: FakeClock;
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    clock = makeClock();
    adapter = new MockAuthAdapter({ clock, seedFixtures: true });
  });

  it('returns null (success) when no session exists', async () => {
    const result = await adapter.restoreSession();
    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value).toBeNull();
    }
  });

  it('returns the active session immediately after sign-in', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    const result = await adapter.restoreSession();
    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value).not.toBeNull();
      expect(result.value?.user.email).toBe(MOCK_SEED_USER.email);
    }
  });

  it('fails with ERR_AUTH_SESSION_EXPIRED after the session TTL elapses', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    // Advance clock past 1 hour session TTL
    clock.advanceBySeconds(61 * 60);

    const result = await adapter.restoreSession();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_SESSION_EXPIRED');
    }
    // Token should be cleared
    expect(adapter.activeToken).toBeNull();
  });

  it('returns null (success) after signing out and attempting restore', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    await adapter.signOut();
    const result = await adapter.restoreSession();
    expect(isAuthSuccess(result)).toBe(true);
    if (isAuthSuccess(result)) {
      expect(result.value).toBeNull();
    }
  });
});

// ── requestPasswordReset ───────────────────────────────────────────────────────

describe('MockAuthAdapter.requestPasswordReset', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter({ clock: makeClock(), seedFixtures: true });
  });

  it('returns success for a registered email (does not reveal account existence)', async () => {
    const result = await adapter.requestPasswordReset({ email: MOCK_SEED_USER.email });
    expect(isAuthSuccess(result)).toBe(true);
  });

  it('returns success for an UNREGISTERED email (does not reveal account absence)', async () => {
    const result = await adapter.requestPasswordReset({ email: 'nobody@example.test' });
    expect(isAuthSuccess(result)).toBe(true);
  });

  it('fails with ERR_AUTH_INVALID_EMAIL for a malformed email', async () => {
    const result = await adapter.requestPasswordReset({ email: 'bad-email' });
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_INVALID_EMAIL');
    }
  });
});

// ── confirmPasswordReset ───────────────────────────────────────────────────────

describe('MockAuthAdapter.confirmPasswordReset', () => {
  let clock: FakeClock;
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    clock = makeClock();
    adapter = new MockAuthAdapter({ clock, seedFixtures: true });
  });

  it('succeeds with the seeded reset code', async () => {
    const result = await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: MOCK_SEED_RESET_CODE,
      newPassword: 'NewSecure456!',
    });
    expect(isAuthSuccess(result)).toBe(true);
  });

  it('allows sign-in with the new password after reset', async () => {
    await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: MOCK_SEED_RESET_CODE,
      newPassword: 'NewSecure456!',
    });

    const signIn = await adapter.signIn({
      email: MOCK_SEED_USER.email,
      password: 'NewSecure456!',
    });
    expect(isAuthSuccess(signIn)).toBe(true);
  });

  it('old password no longer works after reset', async () => {
    await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: MOCK_SEED_RESET_CODE,
      newPassword: 'NewSecure456!',
    });

    const signIn = await adapter.signIn({
      email: MOCK_SEED_USER.email,
      password: MOCK_SEED_USER.password, // old password
    });
    expect(isAuthFailure(signIn)).toBe(true);
  });

  it('fails with ERR_AUTH_RESET_CODE_INVALID for a wrong code', async () => {
    const result = await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: 'WRONG-CODE',
      newPassword: 'NewSecure456!',
    });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_RESET_CODE_INVALID');
    }
  });

  it('fails with ERR_AUTH_RESET_CODE_EXPIRED after TTL elapses', async () => {
    // Plant a short-lived code
    adapter.plantResetCode(MOCK_SEED_USER.email, 'SHORT-LIVED', 100);
    // Advance past expiry
    clock.advanceBySeconds(1);

    const result = await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: 'SHORT-LIVED',
      newPassword: 'AnotherPass1!',
    });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_RESET_CODE_EXPIRED');
    }
  });

  it('fails with ERR_AUTH_USER_NOT_FOUND for an unknown email', async () => {
    const result = await adapter.confirmPasswordReset({
      email: 'nobody@example.test',
      resetCode: 'ANY-CODE',
      newPassword: 'Pass12345!',
    });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_USER_NOT_FOUND');
    }
  });

  it('fails with ERR_AUTH_WEAK_PASSWORD if new password is too short', async () => {
    const result = await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: MOCK_SEED_RESET_CODE,
      newPassword: 'abc',
    });

    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.error.code).toBe('ERR_AUTH_WEAK_PASSWORD');
    }
  });

  it('invalidates active session after password reset', async () => {
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    expect(adapter.activeToken).not.toBeNull();

    await adapter.confirmPasswordReset({
      email: MOCK_SEED_USER.email,
      resetCode: MOCK_SEED_RESET_CODE,
      newPassword: 'AnotherPass1!',
    });

    expect(adapter.activeToken).toBeNull();
  });
});

// ── Adapter reset() helper ────────────────────────────────────────────────────

describe('MockAuthAdapter.reset()', () => {
  it('clears all accounts, sessions, and reset codes', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: true });
    await adapter.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
    expect(adapter.activeToken).not.toBeNull();

    adapter.reset({ reseed: false });
    expect(adapter.accountCount).toBe(0);
    expect(adapter.activeToken).toBeNull();
    expect(adapter.hasAccount(MOCK_SEED_USER.email)).toBe(false);
  });

  it('re-seeds fixtures when reseed is true (default)', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: true });
    adapter.reset(); // default: reseed = true
    expect(adapter.hasAccount(MOCK_SEED_USER.email)).toBe(true);
  });

  it('does not re-seed when reseed is false', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: true });
    adapter.reset({ reseed: false });
    expect(adapter.hasAccount(MOCK_SEED_USER.email)).toBe(false);
    expect(adapter.accountCount).toBe(0);
  });
});

// ── Determinism guarantee ─────────────────────────────────────────────────────

describe('Determinism', () => {
  it('produces the same seed user ID across adapter instances with the same clock', () => {
    const clock = new FakeClock(BASE_TIME);
    const a1 = new MockAuthAdapter({ clock, seedFixtures: true });
    const a2 = new MockAuthAdapter({ clock, seedFixtures: true });

    // The seed user ID is hard-coded, not clock-derived
    const getUserId = async (a: MockAuthAdapter): Promise<string | null> => {
      await a.signIn({ email: MOCK_SEED_USER.email, password: MOCK_SEED_USER.password });
      const r = await a.getCurrentUser();
      return isAuthSuccess(r) ? (r.value?.id ?? null) : null;
    };

    return Promise.all([getUserId(a1), getUserId(a2)]).then(([id1, id2]) => {
      expect(id1).toBe(id2);
    });
  });

  it('two separate signUp calls produce different user IDs (non-deterministic IDs)', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: false });
    const r1 = await adapter.signUp({ email: 'u1@test.test', username: 'u1', password: 'Password1!' });
    const r2 = await adapter.signUp({ email: 'u2@test.test', username: 'u2', password: 'Password2!' });
    if (isAuthSuccess(r1) && isAuthSuccess(r2)) {
      expect(r1.value.id).not.toBe(r2.value.id);
    }
  });
});

// ── Security properties ────────────────────────────────────────────────────────

describe('Security properties', () => {
  it('password does not appear in returned AuthUser', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: false });
    const result = await adapter.signUp({ email: 'sec@test.test', username: 'sec', password: 'MySecret99!' });
    if (isAuthSuccess(result)) {
      const serialised = JSON.stringify(result.value);
      expect(serialised).not.toContain('MySecret99!');
    }
  });

  it('password does not appear in returned AuthSessionData', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: true });
    await adapter.signUp({ email: 'sec2@test.test', username: 'sec2', password: 'MySecret99!' });
    const result = await adapter.signIn({ email: 'sec2@test.test', password: 'MySecret99!' });
    if (isAuthSuccess(result)) {
      const serialised = JSON.stringify(result.value);
      expect(serialised).not.toContain('MySecret99!');
    }
  });

  it('error messages do not include the submitted password', async () => {
    const adapter = new MockAuthAdapter({ seedFixtures: true });
    const result = await adapter.signIn({ email: MOCK_SEED_USER.email, password: 'WrongSecretPass!' });
    if (isAuthFailure(result)) {
      expect(result.error.message).not.toContain('WrongSecretPass!');
    }
  });
});
