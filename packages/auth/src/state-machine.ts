/**
 * C3 Auth — Authentication State Machine
 *
 * Pure state transition validator for the auth domain.
 * No I/O, no async, no external dependencies.
 *
 * Validates legal transitions as defined in the AuthState discriminated union
 * and in docs/authentication-architecture.md.
 *
 * Stage 3B — used by AuthApplicationService. Not exported from the package index;
 * consumers should interact with AuthApplicationService, not this module directly.
 */

import type {
  AuthState,
  AuthOperation,
  AuthUser,
  AuthSessionData,
  AuthError,
} from '@c3/contracts';

// ── Transition constructors ───────────────────────────────────────────────────

/** Produce the 'unauthenticated' state value. */
export function unauthenticated(): AuthState {
  return { kind: 'unauthenticated' };
}

/** Produce the 'authenticating' state value. */
export function authenticating(operation: AuthOperation): AuthState {
  return { kind: 'authenticating', operation };
}

/** Produce the 'authenticated' state value. */
export function authenticated(user: AuthUser, session: AuthSessionData): AuthState {
  return { kind: 'authenticated', user, session };
}

/** Produce the 'restoringSession' state value. */
export function restoringSession(): AuthState {
  return { kind: 'restoringSession' };
}

/** Produce the 'error' state value. */
export function authError(error: AuthError): AuthState {
  return { kind: 'error', error };
}

// ── Transition validator ──────────────────────────────────────────────────────

/**
 * Describes the result of a state transition check.
 */
export type TransitionResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/**
 * Validates whether transitioning from `current` to `next` is a legal state transition.
 *
 * Legal transitions (from docs/authentication-architecture.md):
 *
 *   unauthenticated  → authenticating   (signIn / signUp initiated)
 *   unauthenticated  → restoringSession (app startup)
 *   authenticating   → authenticated    (credentials accepted)
 *   authenticating   → unauthenticated  (credentials rejected / signIn failure)
 *   authenticating   → error            (unexpected failure)
 *   restoringSession → authenticated    (valid session found)
 *   restoringSession → unauthenticated  (no session or expired)
 *   restoringSession → error            (unexpected failure)
 *   authenticated    → authenticating   (signOut initiated)
 *   authenticated    → unauthenticated  (signOut completed)
 *   error            → unauthenticated  (user acknowledges / retries)
 *   error            → authenticating   (retry sign-in from error)
 *
 * The authenticated→authenticating transition supports signOut (the operation
 * is 'signOut'). Sign-in from authenticated is not a listed legal transition —
 * the caller should sign out first.
 *
 * @returns TransitionResult indicating whether the transition is allowed.
 */
export function validateTransition(current: AuthState, next: AuthState): TransitionResult {
  const from = current.kind;
  const to = next.kind;

  // Same-state transitions are always a no-op and thus allowed
  if (from === to) {
    return { allowed: true };
  }

  switch (from) {
    case 'unauthenticated':
      if (to === 'authenticating' || to === 'restoringSession') {
        return { allowed: true };
      }
      break;

    case 'authenticating':
      if (to === 'authenticated' || to === 'unauthenticated' || to === 'error') {
        return { allowed: true };
      }
      break;

    case 'restoringSession':
      if (to === 'authenticated' || to === 'unauthenticated' || to === 'error') {
        return { allowed: true };
      }
      break;

    case 'authenticated':
      // Can transition to authenticating (to initiate signOut) or directly to
      // unauthenticated (signOut success). Also to error for unexpected failures.
      if (to === 'authenticating' || to === 'unauthenticated' || to === 'error') {
        return { allowed: true };
      }
      break;

    case 'error':
      // Can retry: go back to unauthenticated or start a new auth operation
      if (to === 'unauthenticated' || to === 'authenticating') {
        return { allowed: true };
      }
      break;
  }

  return {
    allowed: false,
    reason: `Invalid transition: '${from}' → '${to}'`,
  };
}

/**
 * Returns true if the given state kind represents a terminal in-progress state.
 * Used by AuthApplicationService to detect when an operation is already running.
 */
export function isInProgress(state: AuthState): boolean {
  return state.kind === 'authenticating' || state.kind === 'restoringSession';
}
