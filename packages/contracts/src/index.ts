/**
 * C3 - Contracts Package
 * Pure interface and type definitions. Zero business logic.
 */

// ==========================================
// 1. DOMAIN CONTRACTS
// ==========================================

export interface User {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuthSession {
  readonly token: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly user: User;
}

export interface CpuInfo {
  readonly model: string;
  readonly cores: number;
  readonly threads: number;
}

export interface MemoryInfo {
  readonly totalBytes: number;
  readonly availableBytes: number;
}

export interface DiskInfo {
  readonly totalBytes: number;
  readonly availableBytes: number;
}

export interface GpuInfo {
  readonly model: string;
  readonly memoryBytes: number;
}

export interface OsInfo {
  readonly platform: string;
  readonly arch: string;
  readonly release: string;
}

export interface HardwareInfo {
  readonly cpu: CpuInfo;
  readonly memory: MemoryInfo;
  readonly disk: DiskInfo;
  readonly os: OsInfo;
  readonly gpu?: GpuInfo;
}

export type ProviderStatus =
  | 'OFFLINE'
  | 'STARTING'
  | 'ONLINE'
  | 'AVAILABLE'
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'STOPPING'
  | 'ERROR';

export interface ProviderResources {
  readonly cpuCores: number;
  readonly memoryBytes: number;
  readonly diskBytes: number;
  readonly gpuCount: number;
}

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly status: ProviderStatus;
  readonly resources: ProviderResources;
}

export type ProviderRequestStatus =
  | 'CREATED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface ProviderRequest {
  readonly id: string;
  readonly consumerId: string;
  readonly providerId: string;
  readonly requestedResources: ProviderResources;
  readonly status: ProviderRequestStatus;
  readonly createdAt: Date;
}

export type ProviderSessionStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTING'
  | 'DISCONNECTED'
  | 'FAILED';

export interface ProviderSession {
  readonly id: string;
  readonly providerId: string;
  readonly consumerId: string;
  readonly status: ProviderSessionStatus;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

export interface NegotiationMessage {
  readonly id: string;
  readonly requestId: string;
  readonly senderId: string;
  readonly payload: unknown;
  readonly timestamp: Date;
}

export interface PriceOffer {
  readonly id: string;
  readonly providerId: string;
  readonly pricePerCoreHour: number;
  readonly pricePerGpuHour: number;
  readonly currency: string;
}

export type ClusterStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'READY'
  | 'DEGRADED'
  | 'STOPPING'
  | 'ERROR';

export interface ClusterNode {
  readonly id: string;
  readonly clusterId: string;
  readonly role: 'head' | 'worker';
  readonly address: string;
  readonly status: string;
}

export interface Cluster {
  readonly id: string;
  readonly name: string;
  readonly status: ClusterStatus;
  readonly nodeCount: number;
  readonly createdAt: Date;
}

export interface ComputeCluster {
  readonly id: string;
  readonly clusterId: string;
  readonly engine: string;
  readonly capacity: ProviderResources;
}

export interface ComputeNode {
  readonly id: string;
  readonly nodeAddress: string;
  readonly status: string;
  readonly totalResources: ProviderResources;
  readonly usedResources: ProviderResources;
}

export type JobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'STARTING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface JobResources {
  readonly cpuCores: number;
  readonly memoryMB: number;
  readonly gpus: number;
}

export interface Job {
  readonly id: string;
  readonly projectId: string;
  readonly entrypoint: string;
  readonly resources: JobResources;
  readonly targetNodes: readonly string[];
  readonly status: JobStatus;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface JobResult {
  readonly jobId: string;
  readonly exitCode: number;
  readonly outputArtifacts: readonly string[];
  readonly executionTimeMs: number;
  readonly error?: string;
}

export interface CreditBalance {
  readonly userId: string;
  readonly availableCredits: number;
  readonly reservedCredits: number;
  readonly currency: string;
}

// ==========================================
// 2. PUBLIC SERVICE INTERFACES
// ==========================================

export interface RegistrationParams {
  readonly email: string;
  readonly username: string;
  readonly passwordHash: string;
}

export interface LoginCredentials {
  readonly email: string;
  readonly passwordHash: string;
}

export interface AuthService {
  register(details: RegistrationParams): Promise<User>;
  confirmRegistration(code: string): Promise<boolean>;
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  restoreSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<User | null>;
}

export interface HardwareService {
  getHardware(): Promise<HardwareInfo>;
}

export interface ProviderService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ProviderStatus>;
  getResources(): Promise<ProviderResources>;
  acceptRequest(requestId: string): Promise<void>;
  declineRequest(requestId: string, reason?: string): Promise<void>;
}

export interface DiscoveryService {
  discover(): Promise<readonly Provider[]>;
  advertise(provider: Provider): Promise<void>;
}

export interface ClusterCreateParams {
  readonly name: string;
  readonly initialNodes: readonly string[];
}

export interface ClusterService {
  create(config: ClusterCreateParams): Promise<Cluster>;
  start(clusterId: string): Promise<void>;
  stop(clusterId: string): Promise<void>;
  getStatus(clusterId: string): Promise<ClusterStatus>;
  getNodes(clusterId: string): Promise<readonly ClusterNode[]>;
  addWorker(clusterId: string, nodeId: string): Promise<void>;
  removeWorker(clusterId: string, nodeId: string): Promise<void>;
}

export interface ComputeService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<string>;
  getNodes(): Promise<readonly ComputeNode[]>;
  submitJob(job: Job): Promise<string>;
  cancelJob(jobId: string): Promise<void>;
}

export interface CreateJobParams {
  readonly projectId: string;
  readonly entrypoint: string;
  readonly resources: JobResources;
  readonly targetNodes: readonly string[];
}

export interface JobService {
  create(params: CreateJobParams): Promise<Job>;
  submit(jobId: string): Promise<void>;
  get(jobId: string): Promise<Job | null>;
  cancel(jobId: string): Promise<void>;
  getLogs(jobId: string): Promise<readonly string[]>;
  getResults(jobId: string): Promise<JobResult | null>;
}
