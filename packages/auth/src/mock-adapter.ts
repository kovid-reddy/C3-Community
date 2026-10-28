/**
 * C3 Auth Package — Mock Authentication Adapter
 *
 * ⚠️  DEVELOPMENT / TEST USE ONLY — NOT FOR PRODUCTION
 *
 * A deterministic, in-memory authentication adapter that implements IAuthService.
 * Designed exclusively for:
 *   - Automated unit tests
 *   - Development without a network or AWS account
 *   - Demonstrating authentication flows in isolation
 *
 * Security properties of this adapter:
 *   - Passwords are never stored in plaintext — accounts store only a flag
 *     that the password was accepted against the registered credential, not
 *     the credential itself. In this test adapter a simple hash comparison
 *     stand-in is used but NO real hash is derived — we compare encoded
 *     representations so the raw password is not retained anywhere.
 *   - Tokens are random UUIDs — not JWTs, not real Cognito tokens.
 *   - No network calls, no AWS SDK, no email delivery.
 *   - Sessions are stored in process memory and cleared on signOut.
 *   - Do NOT use this adapter in production. It provides no real security.
 *
 * Deterministic behaviour:
 *   - A fixed test seed email ("alice@example.test") is pre-seeded for
 *     tests that need an existing account without prior signUp.
 *   - Password reset codes are predictable strings in tests.
 *   - The adapter's internal state can be inspected and reset via helpers.
 */

import {
  IAuthService,
  AuthUser,
  AuthSessionData,
  AuthResult,
  AuthError,
  AuthErrorCode,
  SignUpInput,
  SignInInput,
  PasswordResetRequest,
  PasswordResetConfirmation,
  authOk,
  authErr,
} from '@c3/contracts';
import { CryptoIdGenerator, FakeClock, Clock } from '@c3/foundation';

// ── Internal helpers ──────────────────────────────────────────────────────────

const idGenerator = new CryptoIdGenerator();

/** Minimum accepted password length (policy for mock only). */
const MIN_PASSWORD_LENGTH = 8;

/** Session TTL in milliseconds — 1 hour for mock sessions. */
const SESSION_TTL_MS = 60 * 60 * 1000;

/** Password reset code TTL in milliseconds — 15 minutes. */
const RESET_CODE_TTL_MS = 15 * 60 * 1000;

/** Email regex — basic structure check only. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create an AuthError value. */
function makeAuthError(code: AuthErrorCode, message: string): AuthError {
  return { code, message };
}

/** Encodes a password into a non-plaintext representation for internal storage.
 *  This is NOT a cryptographic hash — it is a reversible encoding used only to
 *  ensure the raw string is not retained as-is in the mock store. Real adapters
 *  must use bcrypt/argon2 or delegate to the identity provider.
 */
function encodePasswordForStorage(password: string): string {
  return `mock:${Buffer.from(password).toString('base64')}`;
}

/** Compares a candidate password against a stored encoded representation. */
function verifyPassword(candidate: string, stored: string): boolean {
  return stored === encodePasswordForStorage(candidate);
}

// ── Internal state types ──────────────────────────────────────────────────────

interface MockAccount {
  readonly user: AuthUser;
  readonly encodedPassword: string;
  confirmed: boolean;
}

interface MockSession {
  readonly session: AuthSessionData;
  readonly expiresAtMs: number;
}

interface MockResetCode {
  readonly code: string;
  readonly expiresAtMs: number;
}

// ── Pre-seeded test fixtures ──────────────────────────────────────────────────

/**
 * Test fixture — a pre-seeded account available without calling signUp.
 * Password: "Test1234!" (do not use real credentials here).
 */
export const MOCK_SEED_USER: Readonly<{ email: string; password: string; username: string }> = {
  email: 'alice@example.test',
  password: 'Test1234!',
  username: 'alice',
} as const;

/**
 * Test fixture — a pre-seeded reset code for alice@example.test.
 * Only valid when the mock is seeded with the default fixtures.
 */
export const MOCK_SEED_RESET_CODE = 'RESET-0000';

// ── MockAuthAdapter ───────────────────────────────────────────────────────────

/**
 * Options for constructing the MockAuthAdapter.
 */
export interface MockAuthAdapterOptions {
  /**
   * Clock implementation. Defaults to SystemClock.
   * Inject a FakeClock for deterministic time-based tests.
   */
  readonly clock?: Clock;

  /**
   * If true (default), the adapter is pre-seeded with the MOCK_SEED_USER fixture.
   * Set to false to start with a completely empty state.
   */
  readonly seedFixtures?: boolean;
}

/**
 * MockAuthAdapter — in-memory, deterministic IAuthService implementation.
 *
 * ⚠️  NOT FOR PRODUCTION USE.
 */
export class MockAuthAdapter implements IAuthService {
  private readonly accounts = new Map<string, MockAccount>(); // keyed by email (normalised)
  private readonly sessions = new Map<string, MockSession>();  // keyed by token
  private readonly resetCodes = new Map<string, MockResetCode>(); // keyed by email

  /** The token of the currently active session (if any). */
  private currentToken: string | null = null;

  private readonly clock: Clock;

  constructor(options: MockAuthAdapterOptions = {}) {
    this.clock = options.clock ?? new FakeClock('2026-01-01T00:00:00.000Z');

    const seedFixtures = options.seedFixtures !== false; // default: true
    if (seedFixtures) {
      this._seedFixtures();
    }
  }

  // ── Public inspection helpers (for test assertions) ─────────────────────────

  /**
   * Returns the number of registered accounts.
   * Useful in tests to assert sign-up side effects.
   */
  get accountCount(): number {
    return this.accounts.size;
  }

  /**
   * Returns true if an account with the given email exists.
   */
  hasAccount(email: string): boolean {
    return this.accounts.has(this._normaliseEmail(email));
  }

  /**
   * Returns the current active session token, or null if signed out.
   */
  get activeToken(): string | null {
    return this.currentToken;
  }

  /**
   * Resets ALL in-memory state (accounts, sessions, reset codes).
   * Useful in beforeEach hooks to start each test clean.
   * Re-applies fixtures if the adapter was constructed with seedFixtures: true.
   */
  reset(options: { reseed?: boolean } = {}): void {
    this.accounts.clear();
    this.sessions.clear();
    this.resetCodes.clear();
    this.currentToken = null;
    if (options.reseed !== false) {
      this._seedFixtures();
    }
  }

  /**
   * Marks an account as confirmed/unconfirmed. Used in tests that exercise
   * the ERR_AUTH_NOT_CONFIRMED flow without needing a real email verification.
   */
  setAccountConfirmed(email: string, confirmed: boolean): void {
    const key = this._normaliseEmail(email);
    const account = this.accounts.get(key);
    if (account) {
      this.accounts.set(key, { ...account, confirmed });
    }
  }

  /**
   * Plants a specific reset code for an email — useful when testing
   * confirmPasswordReset without going through requestPasswordReset.
   */
  plantResetCode(email: string, code: string, ttlMs = RESET_CODE_TTL_MS): void {
    const key = this._normaliseEmail(email);
    const expiresAtMs = this.clock.timestampMs() + ttlMs;
    this.resetCodes.set(key, { code, expiresAtMs });
  }

  // ── IAuthService implementation ──────────────────────────────────────────────

  async signUp(input: SignUpInput): Promise<AuthResult<AuthUser>> {
    const emailValidation = this._validateEmail(input.email);
    if (!emailValidation.success) return emailValidation;

    const passwordValidation = this._validatePassword(input.password);
    if (!passwordValidation.success) return passwordValidation;

    const key = this._normaliseEmail(input.email);
    if (this.accounts.has(key)) {
      return authErr(makeAuthError('ERR_AUTH_USER_ALREADY_EXISTS', 'An account with this email already exists.'));
    }

    const now = this.clock.now();
    const user: AuthUser = {
      id: idGenerator.generate('usr'),
      email: input.email.trim().toLowerCase(),
      username: input.username.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(key, {
      user,
      encodedPassword: encodePasswordForStorage(input.password),
      confirmed: true, // Mock auto-confirms; tests can override via setAccountConfirmed()
    });

    return authOk(user);
  }

  async signIn(input: SignInInput): Promise<AuthResult<AuthSessionData>> {
    const key = this._normaliseEmail(input.email);
    const account = this.accounts.get(key);

    if (!account) {
      // Return generic error — do not reveal whether email exists
      return authErr(makeAuthError('ERR_AUTH_INVALID_CREDENTIALS', 'Invalid email or password.'));
    }

    if (!account.confirmed) {
      return authErr(makeAuthError('ERR_AUTH_NOT_CONFIRMED', 'Account email has not been confirmed.'));
    }

    if (!verifyPassword(input.password, account.encodedPassword)) {
      return authErr(makeAuthError('ERR_AUTH_INVALID_CREDENTIALS', 'Invalid email or password.'));
    }

    // Clear any existing session before creating a new one
    this._clearCurrentSession();

    const nowMs = this.clock.timestampMs();
    const expiresAtMs = nowMs + SESSION_TTL_MS;

    const session: AuthSessionData = {
      token: idGenerator.generate('tok'),
      refreshToken: idGenerator.generate('rtok'),
      expiresAt: new Date(expiresAtMs),
      user: account.user,
    };

    this.sessions.set(session.token, { session, expiresAtMs });
    this.currentToken = session.token;

    return authOk(session);
  }

  async signOut(): Promise<AuthResult<void>> {
    this._clearCurrentSession();
    return authOk(undefined);
  }

  async getCurrentUser(): Promise<AuthResult<AuthUser | null>> {
    const session = this._getActiveSession();
    if (!session) {
      return authOk(null);
    }
    return authOk(session.session.user);
  }

  async restoreSession(): Promise<AuthResult<AuthSessionData | null>> {
    if (!this.currentToken) {
      return authOk(null);
    }

    const stored = this.sessions.get(this.currentToken);
    if (!stored) {
      this.currentToken = null;
      return authOk(null);
    }

    const nowMs = this.clock.timestampMs();
    if (nowMs >= stored.expiresAtMs) {
      this.sessions.delete(this.currentToken);
      this.currentToken = null;
      return authErr(makeAuthError('ERR_AUTH_SESSION_EXPIRED', 'Session has expired. Please sign in again.'));
    }

    return authOk(stored.session);
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult<void>> {
    const emailValidation = this._validateEmail(input.email);
    if (!emailValidation.success) return emailValidation;

    const key = this._normaliseEmail(input.email);

    // Always return success — do not reveal whether the email is registered
    if (this.accounts.has(key)) {
      const code = `RESET-${idGenerator.generate().slice(0, 8).toUpperCase()}`;
      const expiresAtMs = this.clock.timestampMs() + RESET_CODE_TTL_MS;
      this.resetCodes.set(key, { code, expiresAtMs });
      // In a real adapter, the code would be sent via email.
      // In the mock, it is accessible via inspecting the adapter state (tests use plantResetCode).
    }

    return authOk(undefined);
  }

  async confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthResult<void>> {
    const emailValidation = this._validateEmail(input.email);
    if (!emailValidation.success) return emailValidation;

    const passwordValidation = this._validatePassword(input.newPassword);
    if (!passwordValidation.success) return passwordValidation;

    const key = this._normaliseEmail(input.email);
    const account = this.accounts.get(key);

    if (!account) {
      return authErr(makeAuthError('ERR_AUTH_USER_NOT_FOUND', 'No account found with that email.'));
    }

    const resetEntry = this.resetCodes.get(key);
    if (!resetEntry) {
      return authErr(makeAuthError('ERR_AUTH_RESET_CODE_INVALID', 'Password reset code is invalid.'));
    }

    const nowMs = this.clock.timestampMs();
    if (nowMs >= resetEntry.expiresAtMs) {
      this.resetCodes.delete(key);
      return authErr(makeAuthError('ERR_AUTH_RESET_CODE_EXPIRED', 'Password reset code has expired.'));
    }

    if (input.resetCode !== resetEntry.code) {
      return authErr(makeAuthError('ERR_AUTH_RESET_CODE_INVALID', 'Password reset code is invalid.'));
    }

    // Update the account password
    const updatedAccount: MockAccount = {
      ...account,
      encodedPassword: encodePasswordForStorage(input.newPassword),
    };
    this.accounts.set(key, updatedAccount);
    this.resetCodes.delete(key);

    // Invalidate any active session for this account
    if (this.currentToken) {
      const activeSession = this.sessions.get(this.currentToken);
      if (activeSession && activeSession.session.user.email === account.user.email) {
        this._clearCurrentSession();
      }
    }

    return authOk(undefined);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private _validateEmail(email: string): AuthResult<never> | { success: true } {
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return authErr(makeAuthError('ERR_AUTH_INVALID_EMAIL', 'Email address is not valid.'));
    }
    return { success: true };
  }

  private _validatePassword(password: string): AuthResult<never> | { success: true } {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return authErr(
        makeAuthError(
          'ERR_AUTH_WEAK_PASSWORD',
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
        )
      );
    }
    return { success: true };
  }

  private _getActiveSession(): MockSession | null {
    if (!this.currentToken) return null;
    const stored = this.sessions.get(this.currentToken);
    if (!stored) return null;
    const nowMs = this.clock.timestampMs();
    if (nowMs >= stored.expiresAtMs) return null;
    return stored;
  }

  private _clearCurrentSession(): void {
    if (this.currentToken) {
      this.sessions.delete(this.currentToken);
      this.currentToken = null;
    }
  }

  private _seedFixtures(): void {
    const now = this.clock.now();
    const seedUser: AuthUser = {
      id: 'usr_00000000-0000-4000-a000-000000000001',
      email: MOCK_SEED_USER.email,
      username: MOCK_SEED_USER.username,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(this._normaliseEmail(MOCK_SEED_USER.email), {
      user: seedUser,
      encodedPassword: encodePasswordForStorage(MOCK_SEED_USER.password),
      confirmed: true,
    });

    // Plant the seed reset code with a far-future expiry
    this.resetCodes.set(this._normaliseEmail(MOCK_SEED_USER.email), {
      code: MOCK_SEED_RESET_CODE,
      expiresAtMs: this.clock.timestampMs() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });
  }
}
