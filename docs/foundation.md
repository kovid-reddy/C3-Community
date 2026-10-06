# Foundation Package (`@c3/foundation`) Specification

## Overview

The Foundation package (`@c3/foundation`) provides generic, zero-business-logic platform capabilities required by all C3 services and modules. It serves as the bottom-most layer in the C3 Monorepo DAG.

---

## Foundation Responsibilities

1. **Centralized Configuration (`ConfigService` & `EnvConfigService`)**:
   - Environment variable parsing, type coercion (numbers, booleans), defaults, and required key validation.
   - Throws structured `AppError` (`CONFIG_ERROR`) for missing required keys or malformed values.
   - Immutable configuration maps once initialized.
   - Environments: `development`, `test`, `production`.

2. **Unified Error System (`AppError` & Utilities)**:
   - Structured error model preserving original causes (`cause`), retryable flag, category, and metadata.
   - Error categories: `VALIDATION_ERROR`, `AUTH_ERROR`, `NETWORK_ERROR`, `PROVIDER_ERROR`, `CLOUD_ERROR`, `CLUSTER_ERROR`, `COMPUTE_ERROR`, `JOB_ERROR`, `RESOURCE_ERROR`, `CONFIG_ERROR`, `INTERNAL_ERROR`.
   - Helper utilities: `normalizeError()`, `serializeError()`, `isAppError()`.
   - Safe serialization automatically redacting sensitive credentials and keys.

3. **Structured Logging & Secret Redaction (`Logger`, `StructuredLogger`, `MemoryLogger`)**:
   - Methods: `debug()`, `info()`, `warn()`, `error()`.
   - Structured context supporting timestamp, log level, module, message, correlation ID, job ID, session ID, and metadata.
   - Automatic recursive secret sanitizer (`sanitizeLogMetadata`) redacting sensitive keys (`password`, `token`, `secret`, `authorization`, `privateKey`, `cookie`, `apiKey`, `k3sToken`, etc.).
   - Circular reference protection and maximum depth bounds to prevent crashes.

4. **Cryptographic ID Generation (`IdGenerator` & `CryptoIdGenerator`)**:
   - Cryptographically strong UUID v4 identifiers via Node `crypto`.
   - Supports domain prefixes (e.g. `req_`, `usr_`, `job_`) and validation (`validate()`).

5. **Time & Clock Abstraction (`Clock`, `SystemClock`, `FakeClock`)**:
   - Abstraction over system time for deterministic testing.
   - `SystemClock`: Uses live system time.
   - `FakeClock`: Fixed initial time with `advanceByMs()`, `advanceBySeconds()`, and `setDate()`.

6. **Generic Service Lifecycle Primitive (`ServiceLifecycle` & `BaseLifecycle`)**:
   - Reusable state machine (`STOPPED`, `STARTING`, `RUNNING`, `STOPPING`, `FAILED`).
   - Prevents duplicate starts, guarantees idempotent stops, invokes cleanup on startup failure, and provides awaitable async transitions.

7. **Functional Result Type (`Result`, `ok`, `err`, `isSuccess`, `isFailure`)**:
   - Lightweight `Success<T>` and `Failure<E>` primitive for explicit error handling without exceptions.

---

## Dependency Rules & Package Isolation

- `@c3/foundation` **MUST NOT** depend on any higher-level C3 module (`auth`, `cloud`, `cluster`, `compute`, `discovery`, `hardware`, `jobs`, `provider`).
- `@c3/foundation` **MUST NOT** import vendor/infrastructure libraries (`aws-sdk`, `dockerode`, `kubernetes-client`, `electron`, `react`).
- `@c3/foundation` only depends on the Node.js standard library and optionally `@c3/contracts`.
