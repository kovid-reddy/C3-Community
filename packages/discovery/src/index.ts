/**
 * C3 Discovery Package
 * Contracts for advertising and discovering compute provider nodes across LAN/Cloud overlay networks.
 */

import { DiscoveryService, Provider } from '@c3/contracts';

export type { DiscoveryService, Provider };

export interface DiscoveryStrategyAdapter {
  name: string;
  discover(): Promise<readonly Provider[]>;
  advertise(provider: Provider): Promise<void>;
}
