/**
 * C3 Provider Package
 * Interfaces and contracts for managing provider node lifecycle and request handling.
 */

import {
  ProviderService,
  ProviderStatus,
  ProviderResources,
  ProviderRequest,
  ProviderSession,
} from '@c3/contracts';

export type {
  ProviderService,
  ProviderStatus,
  ProviderResources,
  ProviderRequest,
  ProviderSession,
};

export interface ProviderLifecycleAdapter {
  initialize(): Promise<void>;
  startWorkerContainer(): Promise<void>;
  stopWorkerContainer(): Promise<void>;
  checkHealth(): Promise<boolean>;
}
