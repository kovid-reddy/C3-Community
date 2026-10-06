# Error Model Specification

## Unified `AppError` Model

All services return or throw errors structured using the `AppError` class located in `@c3/foundation`.

```typescript
export interface AppErrorOptions {
  readonly code: string;
  readonly category: AppErrorCategory;
  readonly message: string;
  readonly retryable?: boolean;
  readonly cause?: Error | unknown;
  readonly metadata?: Record<string, unknown>;
}
```

## Error Categories

1. `VALIDATION_ERROR`: Invalid parameters or inputs provided by user/IPC.
2. `AUTH_ERROR`: Authentication or authorization failure.
3. `NETWORK_ERROR`: Connectivity failure, timeout, or overlay network disconnection.
4. `PROVIDER_ERROR`: Failure on provider lifecycle node.
5. `CLOUD_ERROR`: Persistence or remote repository failure.
6. `CLUSTER_ERROR`: Failure during cluster creation, startup, node joining/leaving.
7. `COMPUTE_ERROR`: Execution engine error (e.g. Ray cluster error).
8. `JOB_ERROR`: Job dispatch or runtime failure.
9. `RESOURCE_ERROR`: Insufficient CPU/RAM/Disk/GPU available.
10. `CONFIG_ERROR`: Missing or invalid environment/application configuration.
11. `INTERNAL_ERROR`: Unexpected panic or system error.
