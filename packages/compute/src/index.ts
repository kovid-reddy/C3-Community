/**
 * C3 Compute Package
 * Generic distributed compute engine orchestration contracts.
 * Decoupled from specific compute engines (Ray, Spark, custom runtimes).
 */

import { ComputeService, ComputeNode, Job } from '@c3/contracts';

export type { ComputeService, ComputeNode, Job };

export interface ComputeEngineAdapter {
  engineName: string;
  startCluster(): Promise<void>;
  stopCluster(): Promise<void>;
  getStatus(): Promise<string>;
  getNodes(): Promise<readonly ComputeNode[]>;
  submit(job: Job): Promise<string>;
  cancel(jobId: string): Promise<void>;
}
