/**
 * C3 Cluster Package
 * Interfaces for cluster lifecycle management without exposing container/orchestrator implementation details.
 */

import {
  ClusterService,
  Cluster,
  ClusterNode,
  ClusterStatus,
  ClusterCreateParams,
} from '@c3/contracts';

export type {
  ClusterService,
  Cluster,
  ClusterNode,
  ClusterStatus,
  ClusterCreateParams,
};

export interface ClusterProviderAdapter {
  createCluster(config: ClusterCreateParams): Promise<Cluster>;
  startCluster(clusterId: string): Promise<void>;
  stopCluster(clusterId: string): Promise<void>;
  getClusterStatus(clusterId: string): Promise<ClusterStatus>;
  getClusterNodes(clusterId: string): Promise<readonly ClusterNode[]>;
  attachWorkerNode(clusterId: string, nodeId: string): Promise<void>;
  detachWorkerNode(clusterId: string, nodeId: string): Promise<void>;
}
