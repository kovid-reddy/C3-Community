/**
 * C3 Desktop Shell - Renderer Process Entrypoint
 * React UI boundary adhering to core dependency rules.
 * UI communicates strictly through IPC/Service contracts.
 */

import { HardwareInfo, User, Job } from '@c3/contracts';

export interface RendererAppState {
  readonly currentUser: User | null;
  readonly localHardware: HardwareInfo | null;
  readonly activeJobs: readonly Job[];
}

export const initialAppState: RendererAppState = {
  currentUser: null,
  localHardware: null,
  activeJobs: [],
};
