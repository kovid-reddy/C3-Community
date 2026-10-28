/**
 * C3 Auth Package
 *
 * Exports:
 *  - The provider-independent authentication service interface (IAuthService)
 *  - All authentication domain types from @c3/contracts
 *  - The mock adapter for development and testing
 *  - The authentication application service (Stage 3B)
 *  - The state machine utilities (Stage 3B)
 *
 * Stage 3B: auth application service + session state management.
 * Do NOT import Cognito, AWS SDK, Electron, or React from this package.
 */

// ── Re-export auth domain types from contracts ─────────────────────────────
export type {
  IAuthService,
  AuthUser,
  AuthSessionData,
  AuthState,
  AuthOperation,
  AuthError,
  AuthErrorCode,
  SignUpInput,
  SignInInput,
  PasswordResetRequest,
  PasswordResetConfirmation,
  AuthResult,
} from '@c3/contracts';

export {
  authOk,
  authErr,
  isAuthSuccess,
  isAuthFailure,
} from '@c3/contracts';

// ── Legacy re-exports (Stage 2 compatibility) ──────────────────────────────
// The original AuthProviderAdapter interface is preserved for backward compatibility.
// New code should implement IAuthService instead.
export type { AuthService, AuthSession, User, RegistrationParams, LoginCredentials } from '@c3/contracts';

/**
 * @deprecated Use IAuthService from @c3/contracts instead.
 * Retained for backward compatibility with Stage 2 stubs.
 */
export interface AuthProviderAdapter {
  register(details: import('@c3/contracts').RegistrationParams): Promise<import('@c3/contracts').User>;
  confirmRegistration(code: string): Promise<boolean>;
  login(credentials: import('@c3/contracts').LoginCredentials): Promise<import('@c3/contracts').AuthSession>;
  logout(): Promise<void>;
  restoreSession(): Promise<import('@c3/contracts').AuthSession | null>;
  getCurrentUser(): Promise<import('@c3/contracts').User | null>;
}

// ── Mock adapter ────────────────────────────────────────────────────────────
export {
  MockAuthAdapter,
  MOCK_SEED_USER,
  MOCK_SEED_RESET_CODE,
} from './mock-adapter';
export type { MockAuthAdapterOptions } from './mock-adapter';

// ── Application service (Stage 3B) ─────────────────────────────────────────
export { AuthApplicationService } from './auth-service';
export type {
  AuthStateListener,
  AuthStateUnsubscribeFn,
  AuthApplicationServiceOptions,
} from './auth-service';

// ── State machine utilities (Stage 3B) ─────────────────────────────────────
export {
  unauthenticated,
  authenticating,
  authenticated,
  restoringSession,
  authError,
  isInProgress,
  validateTransition,
} from './state-machine';
export type { TransitionResult } from './state-machine';
