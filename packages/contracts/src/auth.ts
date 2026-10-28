/**
 * C3 Authentication Domain Contracts
 *
 * Pure type and interface definitions for the authentication domain.
 * No runtime code. No external dependencies. No Cognito, AWS, Electron, or React types.
 *
 * These contracts define the provider-independent boundary that all authentication
 * adapters (mock, Cognito, OAuth, etc.) must satisfy.
 *
 * Stage 3A — Contracts only. No adapter implementation lives here.
 *
 * NOTE: AuthUser is structurally equivalent to (and assignable from) User defined
 * in index.ts. We do NOT re-import from index.ts to avoid a circular reference.
 * Consumers importing from '@c3/contracts' receive both User and AuthUser; they
 * are interchangeable by structural compatibility.
 */

// ── 1. Core Auth Domain Types ─────────────────────────────────────────────────

/**
 * The authenticated user identity within the C3 auth domain.
 * Structurally equivalent to (and assignable from/to) `User` in the base contracts.
 * Defined here to keep the auth contract self-contained.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * An active authentication session holding tokens and the associated user.
 * Tokens must never be logged. The `token` field is deliberately opaque (string).
 */
export interface AuthSessionData {
  /** Opaque access token — MUST NOT be logged */
  readonly token: string;
  /** Opaque refresh token — MUST NOT be logged */
  readonly refreshToken: string;
  /** Absolute expiry time for the access token */
  readonly expiresAt: Date;
  /** The authenticated user associated with this session */
  readonly user: AuthUser;
}

// ── 2. Authentication State Model ─────────────────────────────────────────────

/**
 * Discriminated union of all legal authentication states.
 *
 * Legal transitions:
 *   unauthenticated  → authenticating   (sign-in or sign-up initiated)
 *   unauthenticated  → restoringSession (app startup session check)
 *   authenticating   → authenticated    (credentials accepted)
 *   authenticating   → unauthenticated  (credentials rejected)
 *   authenticating   → error            (unexpected failure)
 *   restoringSession → authenticated    (valid persisted session found)
 *   restoringSession → unauthenticated  (no session or expired session)
 *   restoringSession → error            (unexpected failure)
 *   authenticated    → unauthenticated  (sign-out)
 *   error            → unauthenticated  (user acknowledges error / retries)
 *
 * Any transition not listed above is invalid and must be rejected.
 */
export type AuthState =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'authenticating'; readonly operation: AuthOperation }
  | { readonly kind: 'authenticated'; readonly user: AuthUser; readonly session: AuthSessionData }
  | { readonly kind: 'restoringSession' }
  | { readonly kind: 'error'; readonly error: AuthError };

/**
 * The operation that triggered an 'authenticating' state transition.
 */
export type AuthOperation = 'signIn' | 'signUp' | 'signOut';

// ── 3. Authentication Error Codes ──────────────────────────────────────────────

/**
 * Exhaustive set of authentication-specific error codes.
 * These are used as the `code` field on AppError within AUTH_ERROR category.
 *
 * Codes are deliberately generic to avoid leaking account-existence information
 * (see Section 8 security requirements — timing-safe error responses).
 */
export type AuthErrorCode =
  | 'ERR_AUTH_INVALID_CREDENTIALS'   // Email/password combination not recognised
  | 'ERR_AUTH_USER_NOT_FOUND'        // Account does not exist (only safe in sign-up flows)
  | 'ERR_AUTH_USER_ALREADY_EXISTS'   // Email already registered
  | 'ERR_AUTH_WEAK_PASSWORD'         // Password does not meet policy
  | 'ERR_AUTH_INVALID_EMAIL'         // Malformed email address
  | 'ERR_AUTH_SESSION_EXPIRED'       // Token/session is no longer valid
  | 'ERR_AUTH_NO_SESSION'            // No active session found
  | 'ERR_AUTH_RESET_CODE_INVALID'    // Password reset confirmation code is wrong
  | 'ERR_AUTH_RESET_CODE_EXPIRED'    // Password reset code window has elapsed
  | 'ERR_AUTH_NOT_CONFIRMED'         // Account email not yet confirmed
  | 'ERR_AUTH_RATE_LIMITED'          // Too many attempts
  | 'ERR_AUTH_INTERNAL';             // Unexpected failure inside the auth subsystem

/**
 * Structured authentication error.
 * MUST NOT include passwords, tokens, or raw credentials in any field.
 */
export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

// ── 4. Authentication Operation Inputs ────────────────────────────────────────

/**
 * Input for sign-up (account creation).
 *
 * Security: `password` is accepted here only to pass to the adapter.
 * The adapter is responsible for NOT logging or persisting it in plaintext.
 */
export interface SignUpInput {
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

/**
 * Input for sign-in (credential verification).
 *
 * Security: same password handling requirement as SignUpInput.
 */
export interface SignInInput {
  readonly email: string;
  readonly password: string;
}

/**
 * Input for initiating a password reset (step 1 of 2).
 * Only the email is needed; a reset code will be delivered out-of-band.
 */
export interface PasswordResetRequest {
  readonly email: string;
}

/**
 * Input for completing a password reset (step 2 of 2).
 *
 * Security: `newPassword` must not be logged or persisted in plaintext.
 */
export interface PasswordResetConfirmation {
  readonly email: string;
  readonly resetCode: string;
  readonly newPassword: string;
}

// ── 5. Authentication Operation Results ───────────────────────────────────────

/**
 * Discriminated result type for authentication operations.
 * Replaces throw-based error propagation with explicit, typed outcomes.
 *
 * Follows the same Ok/Err discriminant pattern as the foundation Result<T, E>
 * type but is specialised to always carry AuthError on failure, keeping the
 * auth domain self-contained without forcing callers to cast generic errors.
 */
export type AuthResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: AuthError };

/** Construct a successful AuthResult */
export function authOk<T>(value: T): AuthResult<T> {
  return { success: true, value };
}

/** Construct a failed AuthResult */
export function authErr<T = never>(error: AuthError): AuthResult<T> {
  return { success: false, error };
}

/** Type guard — narrows to the success variant */
export function isAuthSuccess<T>(result: AuthResult<T>): result is { success: true; value: T } {
  return result.success === true;
}

/** Type guard — narrows to the failure variant */
export function isAuthFailure<T>(
  result: AuthResult<T>
): result is { success: false; error: AuthError } {
  return result.success === false;
}

// ── 6. Provider-Independent Authentication Service Interface ──────────────────

/**
 * IAuthService — the provider-independent authentication service contract.
 *
 * Constraints:
 *  - No Cognito, AWS SDK, Electron, React, or renderer-specific types.
 *  - Future adapters replace the implementation, not this interface.
 *  - All operations return AuthResult<T> — never throw for domain errors.
 *  - Unexpected failures (network, internal) should return ERR_AUTH_INTERNAL.
 *  - Passwords MUST NOT be logged by any implementation.
 *  - Session tokens MUST NOT be logged.
 *
 * Lifecycle:
 *  - `restoreSession()` should be called once at application startup.
 *  - `signOut()` clears all session state from the adapter.
 *  - `getCurrentUser()` returns null (inside success) if no authenticated session.
 */
export interface IAuthService {
  /**
   * Create a new user account.
   *
   * Returns the created AuthUser on success.
   * Fails with ERR_AUTH_USER_ALREADY_EXISTS if the email is taken.
   * Fails with ERR_AUTH_WEAK_PASSWORD or ERR_AUTH_INVALID_EMAIL on validation.
   */
  signUp(input: SignUpInput): Promise<AuthResult<AuthUser>>;

  /**
   * Authenticate with email and password.
   *
   * Returns a full AuthSessionData (including tokens and user) on success.
   * Fails with ERR_AUTH_INVALID_CREDENTIALS on any credential mismatch.
   * Fails with ERR_AUTH_NOT_CONFIRMED if the account is unverified.
   */
  signIn(input: SignInInput): Promise<AuthResult<AuthSessionData>>;

  /**
   * Terminate the current session.
   *
   * Always returns success. Calling signOut when already signed out is a no-op.
   */
  signOut(): Promise<AuthResult<void>>;

  /**
   * Retrieve the currently authenticated user without modifying session state.
   *
   * Returns success with null if there is no active session.
   */
  getCurrentUser(): Promise<AuthResult<AuthUser | null>>;

  /**
   * Attempt to restore a previous session (e.g. from an in-memory or persisted token store).
   *
   * Returns the restored AuthSessionData on success.
   * Returns success with null if no valid session exists — this is NOT an error.
   * Fails with ERR_AUTH_SESSION_EXPIRED if a session was found but its token has expired.
   */
  restoreSession(): Promise<AuthResult<AuthSessionData | null>>;

  /**
   * Initiate password reset — step 1 of 2.
   *
   * Dispatches (or simulates) a reset code to the given email address.
   * Always returns success to avoid leaking account existence information.
   */
  requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult<void>>;

  /**
   * Complete password reset — step 2 of 2.
   *
   * Validates the reset code and replaces the account password.
   * Fails with ERR_AUTH_RESET_CODE_INVALID or ERR_AUTH_RESET_CODE_EXPIRED.
   * Fails with ERR_AUTH_USER_NOT_FOUND only if the email is not registered.
   */
  confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthResult<void>>;
}
