/**
 * C3 Jobs Package
 * C3-level Job abstraction contracts and interfaces.
 */

import {
  JobService,
  Job,
  JobStatus,
  JobResources,
  JobResult,
  CreateJobParams,
} from '@c3/contracts';

export type {
  JobService,
  Job,
  JobStatus,
  JobResources,
  JobResult,
  CreateJobParams,
};

export interface JobStoreAdapter {
  saveJob(job: Job): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  updateJobStatus(jobId: string, status: JobStatus): Promise<void>;
  appendLog(jobId: string, logLine: string): Promise<void>;
  saveResult(result: JobResult): Promise<void>;
}
