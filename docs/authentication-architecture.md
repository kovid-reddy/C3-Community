# Authentication Architecture

**Stage 3A — Contracts + Mock Implementation**

> This document describes the authentication domain contracts established in Stage 3A and the
> deterministic mock adapter. No production authentication (Cognito, AWS, OAuth) has been
> implemented. Sections marked **[Future]** describe planned work for later stages.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication Domain Types](#2-authentication-domain-types)
3. [Authentication State Model](#3-authentication-state-model)
4. [Provider-Independent Service Interface](#4-provider-independent-service-interface)
5. [Error Handling Conventions](#5-error-handling-conventions)
6. [Mock Adapter Behaviour and Limitations](#6-mock-adapter-behaviour-and-limitations)
7. [Security Assumptions](#7-security-assumptions)
8. [Boundary Rule — Why Renderer, Preload and Main Must Not Own Auth Logic](#8-boundary-rule)
9. [How a Future Cognito Adapter Will Implement the Same Contract](#9-future-cognito-adapter)
10. [Dependency Rules](#10-dependency-rules)

---

## 1. Overview

C3's authentication design follows the **Ports and Adapters (Hexagonal)** pattern:

- The **port** (`IAuthService`) is defined in `@c3/contracts` — free of any runtime dependency.
- **Adapters** (e.g. `MockAuthAdapter`, future `CognitoAuthAdapter`) implement the port.
- Application code — whether in the main process, renderer, or background services — only
  interacts with the port. Adapters can be swapped without touching callers.

```
┌─────────────────────────────────────────────────────────┐
│  @c3/contracts/src/auth.ts                              │
│  • AuthUser, AuthSessionData, AuthState                 │
│  • IAuthService (port — pure interface, no runtime)     │
│  • AuthResult<T>, authOk / authErr                      │
│  • AuthErrorCode, AuthError                             │
└───────────────────┬─────────────────────────────────────┘
                    │ implements
         ┌──────────┴──────────┐
         │                     │
┌────────▼──────────┐   ┌──────▼────────────────────────┐
│  MockAuthAdapter  │   │  [Future] CognitoAuthAdapter   │
│  @c3/auth/src/    │   │  @c3/auth/src/cognito-adapter  │
│  mock-adapter.ts  │   │                                │
│  (dev/test only)  │   │  Uses @aws-sdk/cognito-*       │
└───────────────────┘   └────────────────────────────────┘
```

---

## 2. Authentication Domain Types

All types live in `packages/contracts/src/auth.ts`. The contracts package has **zero runtime
dependencies**; it contains only TypeScript types and a small number of pure helper functions
(`authOk`, `authErr`).

### `AuthUser`

Represents the C3 user identity within the auth domain. Structurally equivalent to the base
`User` type in `packages/contracts/src/index.ts`.

```typescript
interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### `AuthSessionData`

An active session. **Token fields must never be logged.**

```typescript
interface AuthSessionData {
  readonly token: string;         // Access token — opaque, do not log
  readonly refreshToken: string;  // Refresh token — opaque, do not log
  readonly expiresAt: Date;
  readonly user: AuthUser;
}
```

### `SignUpInput` / `SignInInput`

Input DTOs for account creation and sign-in. The `password` field is accepted only to pass to
the adapter. Adapters must not log or persist it in plaintext.

### `PasswordResetRequest` / `PasswordResetConfirmation`

Two-step password reset inputs. `newPassword` in `PasswordResetConfirmation` must not be logged.

### `AuthResult<T>`

A discriminated union result type for all auth operations:

```typescript
type AuthResult<T> =
  | { readonly success: true;  readonly value: T }
  | { readonly success: false; readonly error: AuthError };
```

This follows the same pattern as the foundation `Result<T, E>` type but is specialised for
`AuthError`. The choice to keep a separate type (rather than reusing `Result<T, AppError>`)
ensures auth domain callers do not need to cast or inspect `AppErrorCategory` — they work
exclusively with `AuthErrorCode`.

---

## 3. Authentication State Model

`AuthState` is a discriminated union of all legal states. It is defined as a **type** only;
no state machine engine is included in Stage 3A — callers own the state variable.

```typescript
type AuthState =
  | { kind: 'unauthenticated' }
  | { kind: 'authenticating'; operation: AuthOperation }
  | { kind: 'authenticated'; user: AuthUser; session: AuthSessionData }
  | { kind: 'restoringSession' }
  | { kind: 'error'; error: AuthError };
```

### Legal Transitions

```
unauthenticated  ──signIn/signUp──▶  authenticating
unauthenticated  ──restoreSession──▶ restoringSession

authenticating   ──success──────────▶ authenticated
authenticating   ──failure──────────▶ unauthenticated
authenticating   ──unexpected err──▶ error

restoringSession ──session found──▶ authenticated
restoringSession ──no session────▶ unauthenticated
restoringSession ──unexpected────▶ error

authenticated    ──signOut───────▶ unauthenticated

error            ──retry/dismiss──▶ unauthenticated
```

Transitions not listed above are invalid. A future state machine implementation (e.g. an
XState or custom machine in the renderer) should enforce these transitions and throw on
illegal ones.

### State Enforcement in Stage 3A

Stage 3A does not include a state machine. The `AuthState` type is available for callers
who manage state themselves. If the renderer, IPC layer, or main process needs enforced
transitions, that work belongs in Stage 3B or later.

---

## 4. Provider-Independent Service Interface

`IAuthService` in `packages/contracts/src/auth.ts` defines the complete authentication
contract. All methods return `Promise<AuthResult<T>>` — they **never throw** for domain
errors. Unexpected panics are acceptable for programming errors only.

```typescript
interface IAuthService {
  signUp(input: SignUpInput): Promise<AuthResult<AuthUser>>;
  signIn(input: SignInInput): Promise<AuthResult<AuthSessionData>>;
  signOut(): Promise<AuthResult<void>>;
  getCurrentUser(): Promise<AuthResult<AuthUser | null>>;
  restoreSession(): Promise<AuthResult<AuthSessionData | null>>;
  requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult<void>>;
  confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthResult<void>>;
}
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| `AuthResult<T>` instead of throw | Explicit, typed error paths. Callers must handle failures. |
| `signOut` always succeeds | Clearing local state is always safe; double-signout is a no-op. |
| `requestPasswordReset` always succeeds | Avoids leaking whether an email is registered. |
| `restoreSession` returns `null` (not error) for "no session" | Absence of a session is not an error — it is the unauthenticated initial state. |
| `getCurrentUser` returns `null` inside success | Same rationale — not authenticated is not an error. |

---

## 5. Error Handling Conventions

### AuthErrorCode Values

| Code | When Used |
|---|---|
| `ERR_AUTH_INVALID_CREDENTIALS` | Any email/password mismatch — used instead of "user not found" to avoid account enumeration |
| `ERR_AUTH_USER_NOT_FOUND` | Safe to expose only in password reset confirmation (user submitted the email themselves) |
| `ERR_AUTH_USER_ALREADY_EXISTS` | Sign-up with an already registered email |
| `ERR_AUTH_WEAK_PASSWORD` | Password does not meet the minimum policy |
| `ERR_AUTH_INVALID_EMAIL` | Malformed email address |
| `ERR_AUTH_SESSION_EXPIRED` | A session was found but its access token has expired |
| `ERR_AUTH_NO_SESSION` | Returned when a session is required but none exists |
| `ERR_AUTH_RESET_CODE_INVALID` | Wrong reset code |
| `ERR_AUTH_RESET_CODE_EXPIRED` | Reset code window elapsed |
| `ERR_AUTH_NOT_CONFIRMED` | Account created but email not confirmed |
| `ERR_AUTH_RATE_LIMITED` | Too many attempts (reserved for real adapters) |
| `ERR_AUTH_INTERNAL` | Unexpected failure within the auth subsystem |

### Relationship to AppError

`AuthError` is a lightweight auth-specific error type. It does **not** extend or wrap
`AppError`. When an auth operation needs to cross into the general application error model
(e.g. for IPC serialisation), callers should wrap it:

```typescript
// Converting AuthError → AppError for IPC
import { AppError } from '@c3/foundation';

function authErrorToAppError(e: AuthError): AppError {
  return new AppError({
    code: e.code,
    category: 'AUTH_ERROR',
    message: e.message,
    retryable: false,
  });
}
```

This conversion is **not** included in Stage 3A because no IPC wiring is implemented yet.

---

## 6. Mock Adapter Behaviour and Limitations

> ⚠️ **The `MockAuthAdapter` is not for production use.** It provides no real security.

### Location

```
packages/auth/src/mock-adapter.ts
```

### Behaviour

| Operation | Mock Behaviour |
|---|---|
| `signUp` | Creates an in-memory account. Auto-confirms the account (bypassing email verification). |
| `signIn` | Verifies the encoded password against the stored value. Returns a random UUID token. |
| `signOut` | Deletes the current session from the in-memory map. `activeToken` becomes null. |
| `getCurrentUser` | Returns the user from the active session, or null. |
| `restoreSession` | Returns the active session if the clock has not passed its expiry. |
| `requestPasswordReset` | Generates a random code and stores it internally. Does NOT send email. |
| `confirmPasswordReset` | Validates the code, updates the stored password, invalidates the active session. |

### Pre-Seeded Fixtures

When constructed with `seedFixtures: true` (the default):

```typescript
// Available constants for test use:
MOCK_SEED_USER = { email: 'alice@example.test', password: 'Test1234!', username: 'alice' };
MOCK_SEED_RESET_CODE = 'RESET-0000';
```

These constants are safe to use in tests. **Do not commit real credentials or personal data.**

### Test Helpers

```typescript
adapter.accountCount             // number of registered accounts
adapter.hasAccount(email)        // boolean
adapter.activeToken              // current session token or null
adapter.reset({ reseed?: bool }) // clear all state (beforeEach)
adapter.setAccountConfirmed(email, confirmed) // simulate email confirmation
adapter.plantResetCode(email, code, ttlMs)   // inject a known reset code
```

### Limitations

- **No real hashing** — passwords are base64-encoded for storage, not cryptographically hashed.
- **No real JWT** — tokens are random UUIDs, not signed tokens.
- **No persistence** — all state is in process memory and lost on adapter recreation.
- **No email** — `requestPasswordReset` generates a code but does not deliver it. Use
  `plantResetCode()` in tests, or read the generated code by inspecting adapter state.
- **No rate limiting** — `ERR_AUTH_RATE_LIMITED` is defined but not enforced.
- **Single session** — the adapter holds one active session at a time.

---

## 7. Security Assumptions

### What Stage 3A guarantees

- Passwords are **never logged** by the mock adapter.
- Passwords are **never stored in plaintext** (base64-encoded in mock; real adapters must use bcrypt/argon2 or delegate to the identity provider).
- Tokens are **never logged**.
- Error messages **do not expose** whether an email address is registered (sign-in returns `ERR_AUTH_INVALID_CREDENTIALS` regardless of whether the email exists).
- No real credentials, tokens, or personal data appear in test fixtures or source code.

### What Stage 3A does NOT guarantee

- The mock adapter **does not provide cryptographic security** — it is a development tool.
- **No session persistence** — refreshing the app loses the mock session.
- **No multi-device session management**.
- **No PKCE, OAuth flows, MFA, or SSO**.

### Production Security Requirements (for future stages)

- A real adapter (e.g. Cognito) must use HTTPS for all token exchanges.
- Access tokens must be stored in secure, HttpOnly or OS-level secure storage — not in
  `localStorage` or unprotected renderer memory.
- Refresh tokens must be rotated on use.
- The main process must be the trust boundary for session tokens; the renderer must request
  the current user via IPC, not hold raw tokens.

---

## 8. Boundary Rule

### Why the Renderer, Preload, and Main Process Must Not Own Authentication-Provider Logic

```
┌──────────────────────────────────────────────────────┐
│  Renderer (browser context / React)                  │
│  • May request current user via IPC                  │
│  • MUST NOT import @c3/auth or any auth adapter      │
│  • MUST NOT hold session tokens                      │
└──────────────────┬───────────────────────────────────┘
                   │ IPC (typed, contextBridge)
┌──────────────────▼───────────────────────────────────┐
│  Preload (bridge script)                             │
│  • Exposes typed IPC proxy only                      │
│  • MUST NOT import auth adapters directly            │
│  • MUST NOT access raw tokens                        │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│  Main Process (Node.js / Electron)                   │
│  • Owns the IAuthService instance                    │
│  • Handles IPC channels for auth operations          │
│  • May hold session state in memory                  │
│  • MUST be the only process with access to tokens    │
└──────────────────────────────────────────────────────┘
```

**Rationale:**

1. **Security boundary** — the renderer is a web context and must be treated as untrusted.
   Tokens in the renderer are exposed to XSS attacks. Only the main process (Node.js) has
   access to secure OS storage.

2. **Provider isolation** — if authentication logic lived in the renderer, every renderer
   rebuild would be coupled to the auth provider. The main process can swap adapters
   (mock → Cognito) without touching the renderer.

3. **Testability** — the main process auth logic is testable in pure Node.js without a
   browser or Electron. The renderer is tested against a mock IPC, not a real adapter.

4. **Stage 2 architectural integrity** — the Stage 2 IPC contract already defines
   `auth:get-current-user` as a typed IPC channel. Auth adapter wiring (Stage 3B+) will
   implement that handler in the main process only.

This document records this constraint so future contributors do not break the boundary.

---

## 9. Future Cognito Adapter

**[Future — Stage 3B or later]**

A real `CognitoAuthAdapter` will:

1. Implement `IAuthService` exactly as `MockAuthAdapter` does.
2. Use `@aws-sdk/client-cognito-identity-provider` for all API calls.
3. Store tokens using the main process's secure storage layer (not in this stage).
4. Map Cognito error codes to `AuthErrorCode` values.
5. Live in `packages/auth/src/cognito-adapter.ts`.
6. Be registered in the main process only — not imported in preload or renderer.
7. Be exercised by integration tests that use the Cognito Local emulator or live sandbox.

The `IAuthService` interface will not change. The Cognito adapter will be a drop-in
replacement for `MockAuthAdapter`.

```typescript
// Future usage (main process, Stage 3B)
import { CognitoAuthAdapter } from '@c3/auth';
const authService: IAuthService = new CognitoAuthAdapter({ userPoolId, clientId });
```

---

## 10. Dependency Rules

| Package | May depend on | Must NOT depend on |
|---|---|---|
| `@c3/contracts` | nothing | anything |
| `@c3/foundation` | `@c3/contracts` | any `@c3/*` feature package |
| `@c3/auth` | `@c3/contracts`, `@c3/foundation` | Electron, React, Cognito/AWS SDK (in Stage 3A) |
| Desktop main process | `@c3/contracts`, `@c3/foundation`, `@c3/auth` (future: Stage 3B) | renderer-specific code |
| Desktop renderer | `@c3/contracts` (types only via IPC) | `@c3/auth`, auth adapters |

The `verify-deps.js` script enforces these rules at the package dependency level.
File-level import checks are the responsibility of TypeScript compilation and code review.
