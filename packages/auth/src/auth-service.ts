/**
 * C3 Auth — Authentication Application Service (Stage 3B)
 *
 * Orchestrates an `IAuthService` adapter, manages explicit `AuthState`,
 * and notifies observers of state changes.
 *
 * Responsibilities:
 *  - Accept an IAuthService adapter through constructor DI.
 *  - Delegate all authentication I/O to the adapter.
 *  - Maintain an in-memory AuthState that reflects the result of each operation.
 *  - Publish state changes to registered observers.
 *  - Prevent stale async results from overwriting newer state (generation counter).
 *  - Reject concurrent operations with a clear, typed error.
 *  - Never log passwords, tokens, or secrets.
 *
 * NOT implemented here (see future stages):
 *  - Cognito / AWS integration
 *  - IPC handlers
 *  - Renderer UI
 *  - Session persistence to disk
 *
 * Dependencies: @c3/contracts, @c3/foundation (Logger only — optional).
 * No Electron, React, Cognito, or AWS SDK.
 */

import type {
  IAuthService,
  AuthState,
  AuthUser,
  AuthResult,
  SignUpInput,
  SignInInput,
  PasswordResetRequest,
  PasswordResetConfirmation,
} from '@c3/contracts';
import { authOk, authErr, isAuthSuccess } from '@c3/contracts';
import type { Logger } from '@c3/foundation';

import {
  unauthenticated,
  authenticating,
  authenticated,
  restoringSession,
  authError,
  isInProgress,
  validateTransition,
} from './state-machine';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Callback invoked whenever authentication state changes.
 * Receives the new state only — does NOT receive passwords or raw tokens
 * (the session inside 'authenticated' state contains tokens, which is
 * intentional; observers are responsible for not logging them).
 */
export type AuthStateListener = (state: AuthState) => void;

/** Opaque handle returned by `subscribe()`. Pass to `unsubscribe()`. */
export type AuthStateUnsubscribeFn = () => void;

/**
 * Options for constructing an AuthApplicationService.
 */
export interface AuthApplicationServiceOptions {
  /**
   * Optional structured logger. If provided, lifecycle events and errors
   * are logged. Sensitive values (passwords, tokens) are never passed to the logger.
   */
  readonly logger?: Logger;
}

// ── AuthApplicationService ────────────────────────────────────────────────────

/**
 * AuthApplicationService — the authentication application layer.
 *
 * Instantiate with an IAuthService adapter:
 *
 * ```typescript
 * const adapter = new MockAuthAdapter();
 * const authService = new AuthApplicationService(adapter);
 *
 * authService.subscribe(state => console.log('Auth state:', state.kind));
 * await authService.signIn({ email: '...', password: '...' });
 * ```
 *
 * The service is NOT a singleton. Each instance manages its own state.
 */
export class AuthApplicationService {
  private _state: AuthState = unauthenticated();
  private readonly _listeners = new Set<AuthStateListener>();
  private readonly _adapter: IAuthService;
  private readonly _logger: Logger | null;

  /**
   * Generation counter — incremented on every operation start.
   * When an async operation resolves, it checks whether its captured generation
   * still matches the current counter. If not, a newer operation superseded it
   * and the stale result is discarded without updating state.
   *
   * This prevents the following race:
   *   1. signIn A starts (generation 1)
   *   2. signOut starts and completes (generation 2, state → unauthenticated)
   *   3. signIn A's promise resolves → MUST NOT transition to authenticated
   */
  private _generation = 0;

  constructor(adapter: IAuthService, options: AuthApplicationServiceOptions = {}) {
    this._adapter = adapter;
    this._logger = options.logger ?? null;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * The current authentication state.
   * Reading this is synchronous and never throws.
   */
  get state(): AuthState {
    return this._state;
  }

  /**
   * Register a listener to be called on every state change.
   * The listener is called synchronously during the state transition.
   * Returns an unsubscribe function; call it to remove the listener.
   *
   * Listeners MUST NOT throw — exceptions will propagate to the caller of the
   * operation that triggered the state change.
   */
  subscribe(listener: AuthStateListener): AuthStateUnsubscribeFn {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Sign up a new account.
   *
   * State transitions:
   *   unauthenticated → authenticating(signUp) → unauthenticated (success: user must sign in separately)
   *   unauthenticated → authenticating(signUp) → error            (unexpected failure)
   *   [any failure]   → unauthenticated
   *
   * Sign-up does NOT automatically authenticate. On success, returns the created
   * AuthUser. The caller must invoke signIn to obtain a session.
   *
   * Returns ERR_AUTH_INTERNAL if another operation is already in progress.
   */
  async signUp(input: SignUpInput): Promise<AuthResult<AuthUser>> {
    if (isInProgress(this._state)) {
      return authErr({
        code: 'ERR_AUTH_INTERNAL',
        message: 'An authentication operation is already in progress.',
      });
    }

    const gen = this._beginOperation(authenticating('signUp'));

    try {
      const result = await this._adapter.signUp(input);

      if (!this._isCurrentGeneration(gen)) {
        // A newer operation superseded us — discard result
        return result;
      }

      if (isAuthSuccess(result)) {
        // Success: account created. Transition back to unauthenticated.
        // The user must sign in separately to obtain a session.
        this._transition(unauthenticated());
      } else {
        // Domain failure (duplicate email, weak password, etc.) — stay unauthenticated
        this._transition(unauthenticated());
      }

      return result;
    } catch (err) {
      if (this._isCurrentGeneration(gen)) {
        this._transition(unauthenticated());
      }
      this._logger?.error('signUp: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred during sign-up.' });
    }
  }

  /**
   * Sign in with email and password.
   *
   * State transitions:
   *   unauthenticated  → authenticating(signIn) → authenticated  (success)
   *   unauthenticated  → authenticating(signIn) → unauthenticated (domain failure)
   *   unauthenticated  → authenticating(signIn) → error          (unexpected failure)
   *   error            → authenticating(signIn) → authenticated  (retry success)
   *   error            → authenticating(signIn) → unauthenticated (retry failure)
   *
   * Returns ERR_AUTH_INTERNAL if another operation is already in progress.
   */
  async signIn(input: SignInInput): Promise<AuthResult<import('@c3/contracts').AuthSessionData>> {
    if (isInProgress(this._state)) {
      return authErr({
        code: 'ERR_AUTH_INTERNAL',
        message: 'An authentication operation is already in progress.',
      });
    }

    const gen = this._beginOperation(authenticating('signIn'));

    try {
      const result = await this._adapter.signIn(input);

      if (!this._isCurrentGeneration(gen)) {
        return result;
      }

      if (isAuthSuccess(result)) {
        this._transition(authenticated(result.value.user, result.value));
      } else {
        this._transition(unauthenticated());
      }

      return result;
    } catch (err) {
      if (this._isCurrentGeneration(gen)) {
        this._transition(unauthenticated());
      }
      this._logger?.error('signIn: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred during sign-in.' });
    }
  }

  /**
   * Sign out the current user.
   *
   * State transitions:
   *   authenticated    → authenticating(signOut) → unauthenticated (success)
   *   authenticated    → authenticating(signOut) → unauthenticated (adapter failure — still clears local state)
   *   unauthenticated  → unauthenticated           (no-op, always succeeds)
   *
   * Sign-out clears local authenticated state even if the adapter reports failure,
   * to prevent a stuck authenticated state. The adapter's failure is still returned
   * to the caller so they may log or display it.
   *
   * Returns ERR_AUTH_INTERNAL if an unrelated operation (signIn, signUp) is in progress.
   */
  async signOut(): Promise<AuthResult<void>> {
    // Already signed out — no-op
    if (this._state.kind === 'unauthenticated') {
      return authOk(undefined);
    }

    if (isInProgress(this._state)) {
      return authErr({
        code: 'ERR_AUTH_INTERNAL',
        message: 'An authentication operation is already in progress.',
      });
    }

    const gen = this._beginOperation(authenticating('signOut'));

    try {
      const result = await this._adapter.signOut();

      if (!this._isCurrentGeneration(gen)) {
        return result;
      }

      // Regardless of adapter result, clear local authenticated state.
      // A failed signOut on the adapter side (e.g. network error) should not
      // leave the local app permanently believing it is authenticated.
      this._transition(unauthenticated());

      return result;
    } catch (err) {
      if (this._isCurrentGeneration(gen)) {
        this._transition(unauthenticated());
      }
      this._logger?.error('signOut: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred during sign-out.' });
    }
  }

  /**
   * Restore a previous session.
   *
   * Intended to be called ONCE at application startup.
   *
   * State transitions:
   *   unauthenticated  → restoringSession → authenticated  (valid session found)
   *   unauthenticated  → restoringSession → unauthenticated (no session / null)
   *   unauthenticated  → restoringSession → error          (ERR_AUTH_SESSION_EXPIRED or unexpected)
   *
   * Repeated calls:
   *   If already authenticated, does nothing and returns the current user.
   *   If restoringSession (concurrent call), returns ERR_AUTH_INTERNAL.
   *
   * Returns ERR_AUTH_INTERNAL if another operation is in progress.
   */
  async restoreSession(): Promise<AuthResult<import('@c3/contracts').AuthSessionData | null>> {
    // Already authenticated — return the current session data
    if (this._state.kind === 'authenticated') {
      return authOk(this._state.session);
    }

    if (isInProgress(this._state)) {
      return authErr({
        code: 'ERR_AUTH_INTERNAL',
        message: 'An authentication operation is already in progress.',
      });
    }

    const gen = this._beginOperation(restoringSession());

    try {
      const result = await this._adapter.restoreSession();

      if (!this._isCurrentGeneration(gen)) {
        return result;
      }

      if (result.success === true) {
        if (result.value !== null) {
          this._transition(authenticated(result.value.user, result.value));
        } else {
          this._transition(unauthenticated());
        }
      } else {
        // result.success === false — narrowed to failure variant with .error
        this._transition(authError(result.error));
      }

      return result;
    } catch (err) {
      if (this._isCurrentGeneration(gen)) {
        this._transition(unauthenticated());
      }
      this._logger?.error('restoreSession: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred restoring the session.' });
    }
  }

  /**
   * Get the currently authenticated user without modifying state.
   *
   * Delegates directly to the adapter. Does not affect AuthState.
   * Returns null if unauthenticated.
   */
  async getCurrentUser(): Promise<AuthResult<AuthUser | null>> {
    try {
      return await this._adapter.getCurrentUser();
    } catch (err) {
      this._logger?.error('getCurrentUser: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred retrieving the current user.' });
    }
  }

  /**
   * Request a password reset (step 1 of 2).
   *
   * Delegates directly to the adapter. Does not affect AuthState.
   * Always returns success (by contract) to avoid revealing account existence.
   */
  async requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult<void>> {
    try {
      return await this._adapter.requestPasswordReset(input);
    } catch (err) {
      this._logger?.error('requestPasswordReset: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred requesting a password reset.' });
    }
  }

  /**
   * Confirm a password reset (step 2 of 2).
   *
   * Delegates directly to the adapter. Does not affect AuthState.
   * If the user was authenticated and the reset succeeds, callers should
   * invoke signOut() afterward to clear the stale session.
   */
  async confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthResult<void>> {
    try {
      return await this._adapter.confirmPasswordReset(input);
    } catch (err) {
      this._logger?.error('confirmPasswordReset: unexpected adapter error', { module: 'auth-service' });
      return authErr({ code: 'ERR_AUTH_INTERNAL', message: 'An unexpected error occurred confirming the password reset.' });
    }
  }

  /**
   * Acknowledges an error state and transitions back to unauthenticated,
   * allowing the user to retry authentication.
   *
   * No-op if the current state is not 'error'.
   */
  acknowledgeError(): void {
    if (this._state.kind === 'error') {
      this._transition(unauthenticated());
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Start a new operation: increment the generation counter, apply the initial
   * in-progress state, and return the generation number for later comparison.
   */
  private _beginOperation(state: AuthState): number {
    this._generation += 1;
    const gen = this._generation;
    this._transition(state);
    return gen;
  }

  /**
   * Returns true if the given generation still matches the current generation counter.
   * If false, a newer operation has superseded this one and its result should be discarded.
   */
  private _isCurrentGeneration(gen: number): boolean {
    return this._generation === gen;
  }

  /**
   * Apply a state transition (with validation) and notify listeners.
   *
   * Validates the transition before applying it. If the transition is invalid,
   * an error is logged (if a logger is configured) and the transition is skipped.
   * In production, invalid transitions indicate a programming error.
   */
  private _transition(next: AuthState): void {
    const check = validateTransition(this._state, next);
    if (!check.allowed) {
      // Log the programming error but do not throw — throwing inside an async
      // operation could leave the service in an inconsistent state.
      this._logger?.error(`Auth state machine: invalid transition — ${check.reason}`, {
        module: 'auth-service',
        metadata: { from: this._state.kind, to: next.kind },
      });
      // Degrade gracefully: if we attempted an invalid transition, fall back to unauthenticated
      // only if the current state is an in-progress one (to avoid permanent stuck states).
      if (isInProgress(this._state)) {
        this._state = unauthenticated();
        this._notifyListeners();
      }
      return;
    }

    this._state = next;
    this._notifyListeners();
  }

  /** Invoke all registered listeners with the current state. */
  private _notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state);
      } catch {
        // Listeners must not crash the service. Log if a logger is available.
        this._logger?.error('Auth state listener threw an exception', { module: 'auth-service' });
      }
    }
  }
}
