# Security Architecture & Trust Boundaries

## Trust Boundaries

C3 defines three explicit trust domains:

1. **Local User**: The user operating the local desktop shell. Trusted to manage their own settings and local resource allocations.
2. **Consumer**: A user or system submitting workloads to be run on remote provider nodes. Semi-trusted (workloads must be validated and authenticated).
3. **Provider**: A host machine offering hardware resources. Zero-trust regarding arbitrary consumer code execution.

## Provider Code Execution Protection Requirements

A provider machine MUST NEVER execute consumer workloads directly on the host OS. Future stages must enforce:

- **Provider Authentication**: Mutual TLS (mTLS) or signed cryptographic identity verification.
- **Session Authentication & Authorization**: Short-lived JWTs / session keys scoped to specific compute jobs.
- **Workload Isolation**: Containerization / VM sandboxing (gVisor, Kata Containers, rootless Docker/K8s).
- **Resource Limits**: Strict cgroups enforcement (cgroup v2 CPU, memory caps, GPU limits).
- **Filesystem Isolation**: Ephemeral read-only root filesystems with isolated mount spaces.
- **Network Isolation**: Egress network filtering preventing local LAN discovery or host metadata access from within containers.
