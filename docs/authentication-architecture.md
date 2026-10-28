# Authentication Architecture

**Through Stage 3B — Contracts + Mock Adapter + Application Service**

> This document covers Stage 3A (auth domain contracts, mock adapter) and Stage 3B
> (authentication application service, session state management).
> No production authentication (Cognito, AWS, OAuth), IPC wiring, renderer UI, or session
> persistence has been implemented. Sections marked **[Future]** describe planned work.

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
11. [Stage 3B — Authentication Application Service](#11-stage-3b-authentication-application-service)

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
// Future usage (main process, Stage 3C+)
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

---

## 11. Stage 3B — Authentication Application Service

### Overview

Stage 3B adds the **authentication application service** layer that sits between callers
(main process, future IPC handlers) and the `IAuthService` adapter. It owns the authoritative
`AuthState`, publishes state changes to observers, and enforces the concurrency policy.

```
┌─────────────────────────────────────────────────────────────────┐
│  Caller (main process, tests)                                   │
│  const svc = new AuthApplicationService(adapter);              │
│  svc.subscribe(state => ...);                                   │
│  await svc.signIn({ email, password });                         │
└───────────────────┬─────────────────────────────────────────────┘
                    │ DI
┌───────────────────▼─────────────────────────────────────────────┐
│  AuthApplicationService   packages/auth/src/auth-service.ts     │
│  • Manages AuthState                                            │
│  • Notifies observers (subscribe / unsubscribe)                 │
│  • Prevents stale results via generation counter               │
│  • Rejects concurrent operations with ERR_AUTH_INTERNAL         │
└───────────────────┬─────────────────────────────────────────────┘
                    │ implements IAuthService
        ┌───────────┴───────────┐
┌───────▼─────────┐   ┌────────▼──────────────────────────┐
│ MockAuthAdapter │   │  [Future] CognitoAuthAdapter       │
└─────────────────┘   └────────────────────────────────────┘
```

### Files Added in Stage 3B

| File | Purpose |
|---|---|
| `packages/auth/src/state-machine.ts` | Pure state transition constructors, validator, `isInProgress` guard |
| `packages/auth/src/auth-service.ts` | `AuthApplicationService` — orchestrates adapter, manages state |
| `tests/unit/auth/state-machine.test.ts` | 32 state machine tests |
| `tests/unit/auth/auth-service.test.ts` | 51 application service tests |

### Application Service API

```typescript
class AuthApplicationService {
  // Read-only current state
  get state(): AuthState;

  // Observer registration
  subscribe(listener: AuthStateListener): AuthStateUnsubscribeFn;

  // Auth operations (delegate to adapter + manage state)
  signUp(input: SignUpInput): Promise<AuthResult<AuthUser>>;
  signIn(input: SignInInput): Promise<AuthResult<AuthSessionData>>;
  signOut(): Promise<AuthResult<void>>;
  restoreSession(): Promise<AuthResult<AuthSessionData | null>>;
  getCurrentUser(): Promise<AuthResult<AuthUser | null>>;
  requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult<void>>;
  confirmPasswordReset(input: PasswordResetConfirmation): Promise<AuthResult<void>>;

  // Error recovery
  acknowledgeError(): void;
}
```

### Adapter Injection

The adapter is injected at construction time:

```typescript
// Test
const adapter = new MockAuthAdapter({ clock: new FakeClock() });
const service = new AuthApplicationService(adapter);

// Future production (Stage 3C+)
const adapter = new CognitoAuthAdapter({ userPoolId, clientId });
const service = new AuthApplicationService(adapter);
```

The service depends only on the `IAuthService` interface, not any concrete adapter.

### State Transitions (Stage 3B enforcement)

The `state-machine.ts` module validates every transition before it is applied.
Illegal transitions are logged (if a logger is injected) and rejected — the service
never silently applies a forbidden state.

| Operation | State before | States emitted | State after |
|---|---|---|---|
| `signIn` (success) | unauthenticated / error | authenticating(signIn) → authenticated | authenticated |
| `signIn` (failure) | unauthenticated / error | authenticating(signIn) → unauthenticated | unauthenticated |
| `signUp` (success) | unauthenticated | authenticating(signUp) → unauthenticated | unauthenticated |
| `signUp` (failure) | unauthenticated | authenticating(signUp) → unauthenticated | unauthenticated |
| `signOut` (success) | authenticated | authenticating(signOut) → unauthenticated | unauthenticated |
| `signOut` (already out) | unauthenticated | *(none — no-op)* | unauthenticated |
| `restoreSession` (found) | unauthenticated | restoringSession → authenticated | authenticated |
| `restoreSession` (none) | unauthenticated | restoringSession → unauthenticated | unauthenticated |
| `restoreSession` (expired) | unauthenticated | restoringSession → error | error |
| `restoreSession` (already auth) | authenticated | *(none — short-circuits)* | authenticated |
| `acknowledgeError()` | error | unauthenticated | unauthenticated |

**signUp does not automatically authenticate.** After a successful sign-up, the state
returns to `unauthenticated`. The user must call `signIn` separately. This is intentional:
in production (Cognito), sign-up requires email verification before sign-in is possible.

### Session Restoration

`restoreSession()` is intended to be called once at application startup to recover any
existing in-memory session from the adapter.

- If already `authenticated`, it short-circuits and returns the current session — no adapter
  call is made, no state transition occurs.
- If no session exists, it transitions through `restoringSession → unauthenticated`.
- If a session is found but expired, it transitions through `restoringSession → error`.
  Callers should invoke `acknowledgeError()` to return to `unauthenticated` and allow retry.

### State Observation

```typescript
const unsubscribe = service.subscribe(state => {
  switch (state.kind) {
    case 'unauthenticated':   /* show login screen */ break;
    case 'authenticating':    /* show spinner */       break;
    case 'authenticated':     /* show app */           break;
    case 'restoringSession':  /* show loading */       break;
    case 'error':             /* show error */         break;
  }
});

// Later:
unsubscribe(); // listener is removed and receives no further events
```

Listeners are called synchronously during state transitions. Listeners that throw are
caught and do not crash the service.

### Concurrency Policy

The service uses a **generation counter** to prevent stale async results from overwriting
newer state:

1. Each operation start increments a counter and captures the current generation number.
2. When the operation resolves, it checks whether the captured generation still matches.
3. If not (a newer operation has started), the stale result is **discarded** — state is not updated.

Additionally, if an operation is already in progress when a new one is requested:
- The new operation is **rejected immediately** with `ERR_AUTH_INTERNAL`.
- The in-progress operation continues unaffected.

`signOut` is exempt from the in-progress guard when the state is `unauthenticated`
(it is a no-op in that case and returns success immediately).

### Failure Recovery

Failed operations MUST NOT leave the service permanently stuck in an in-progress state:

- If the adapter throws unexpectedly, the service catches the exception and transitions
  to `unauthenticated`.
- If `restoreSession` fails with a domain error, the service transitions to `error`.
  Call `acknowledgeError()` to move to `unauthenticated`.
- An invalid state transition (programming error) is detected and logged. If the current
  state is in-progress, the service falls back to `unauthenticated` to prevent deadlock.

### Security Boundaries (Stage 3B)

- Passwords are passed through to the adapter only — never stored on the service.
- State change events carry `AuthSessionData` (which contains tokens) only in the
  `authenticated` state. **Observers must not log session tokens.**
- Stack traces from adapter exceptions are caught and suppressed — they are never returned
  through public `AuthResult` error messages.
- `ERR_AUTH_INTERNAL` is returned for unexpected failures; the raw exception is logged
  (via injected Logger) but not exposed to callers.

### What Remains Unimplemented After Stage 3B

| Item | Future Stage |
|---|---|
| Cognito adapter (`CognitoAuthAdapter`) | Stage 3C+ |
| IPC channels for auth operations (main process) | Stage 3C+ |
| Renderer authentication UI | Stage 3C+ |
| Session persistence to OS secure storage | Stage 3C+ |
| Email confirmation flow | Stage 3C+ |
| Refresh-token rotation | Stage 3C+ |
| Rate limiting | Stage 3C+ |
| Multi-device session management | Post-MVP |
