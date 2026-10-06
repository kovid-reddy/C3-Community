# Testing Architecture & Strategy

## Test Levels

1. **Unit Tests (`tests/unit`)**:
   Test isolated pure functions, domain contracts, error models, and logging metadata sanitization. Fast, lightweight, zero side effects.

2. **Integration Tests (`tests/integration`)**:
   Verify module interaction using mock adapters without connecting to real external infrastructure.

3. **End-to-End Tests (`tests/e2e`)**:
   Validate complete application workflows via IPC and desktop shell interfaces.

## Mocking Strategy

Every external dependency must provide a corresponding mock adapter in tests:

- **`AuthService`** → `MockAuthProvider`
- **`CloudService`** → `MockRepository`
- **`ClusterService`** → `MockClusterProvider`
- **`ComputeService`** → `MockComputeProvider`

This guarantees that a broken external service (e.g. cloud endpoint down, Docker daemon unresponsive) will NEVER break test suites for unrelated local components.
