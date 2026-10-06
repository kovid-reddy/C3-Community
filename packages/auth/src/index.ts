/**
 * C3 Auth Package
 * Interface definitions and adapter interfaces for replaceable authentication providers.
 */

import { AuthService, AuthSession, User, RegistrationParams, LoginCredentials } from '@c3/contracts';

export type { AuthService, AuthSession, User, RegistrationParams, LoginCredentials };

/**
 * Replaceable Auth Provider Adapter interface.
 * Infrastructure implementations (e.g. Cognito, OAuth, Mock) must satisfy this interface.
 */
export interface AuthProviderAdapter {
  register(details: RegistrationParams): Promise<User>;
  confirmRegistration(code: string): Promise<boolean>;
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  restoreSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<User | null>;
}
