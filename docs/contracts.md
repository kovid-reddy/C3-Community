# Contracts Package Specification (`@c3/contracts`)

## Domain Types & Interfaces

- `User`: Application user representation.
- `AuthSession`: Active user identity session + tokens.
- `HardwareInfo`: Local hardware metrics (CPU, RAM, Disk, OS, GPU).
- `Provider`: Provider node representation and resources.
- `ProviderResources`: Quantified resource capacity (cores, RAM bytes, disk bytes, GPU count).
- `ProviderRequest`: Resource reservation request from consumer.
- `ProviderSession`: Active provider-consumer compute session.
- `NegotiationMessage`: Price/resource negotiation message.
- `PriceOffer`: Provider resource pricing model.
- `Cluster`: Cluster lifecycle state representation.
- `ClusterNode`: Node inside a cluster (role: head/worker).
- `ComputeCluster`: Engine capacity mapping.
- `ComputeNode`: Live compute node allocation metrics.
- `Job`: C3 Job specification.
- `JobStatus`: Lifecycle state of a job.
- `JobResources`: Resource allocations for job execution.
- `JobResult`: Execution completion result & artifacts.
- `CreditBalance`: User credit balance tracking.

## Core Public Service Interfaces

- `AuthService`: `register()`, `confirmRegistration()`, `login()`, `logout()`, `restoreSession()`, `getCurrentUser()`.
- `HardwareService`: `getHardware()`.
- `ProviderService`: `start()`, `stop()`, `getStatus()`, `getResources()`, `acceptRequest()`, `declineRequest()`.
- `DiscoveryService`: `discover()`, `advertise()`.
- `ClusterService`: `create()`, `start()`, `stop()`, `getStatus()`, `getNodes()`, `addWorker()`, `removeWorker()`.
- `ComputeService`: `start()`, `stop()`, `getStatus()`, `getNodes()`, `submitJob()`, `cancelJob()`.
- `JobService`: `create()`, `submit()`, `get()`, `cancel()`, `getLogs()`, `getResults()`.
