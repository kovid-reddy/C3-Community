import { describe, it, expect } from 'vitest';
import {
  AuthService,
  AuthSession,
  ClusterService,
  ClusterStatus,
  ComputeService,
  User,
  Job,
} from '../../packages/contracts/src';

class MockAuthProvider implements AuthService {
  async register(): Promise<User> {
    return {
      id: 'mock_user_1',
      email: 'mock@c3.cloud',
      username: 'mockuser',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async confirmRegistration(): Promise<boolean> {
    return true;
  }
  async login(): Promise<AuthSession> {
    return {
      token: 'mock_token',
      refreshToken: 'mock_refresh',
      expiresAt: new Date(Date.now() + 3600000),
      user: await this.register(),
    };
  }
  async logout(): Promise<void> {}
  async restoreSession(): Promise<AuthSession | null> {
    return null;
  }
  async getCurrentUser(): Promise<User | null> {
    return null;
  }
}

class MockClusterProvider implements ClusterService {
  async create(): Promise<any> {
    return { id: 'c_1', name: 'mock-cluster', status: 'READY', nodeCount: 1, createdAt: new Date() };
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async getStatus(): Promise<ClusterStatus> {
    return 'READY';
  }
  async getNodes(): Promise<any[]> {
    return [];
  }
  async addWorker(): Promise<void> {}
  async removeWorker(): Promise<void> {}
}

describe('Stage 0 Mocks Architecture Validation', () => {
  it('should instantiate and return valid mock values according to contract interfaces', async () => {
    const auth = new MockAuthProvider();
    const user = await auth.register();
    expect(user.email).toBe('mock@c3.cloud');

    const cluster = new MockClusterProvider();
    const status = await cluster.getStatus('c_1');
    expect(status).toBe('READY');
  });
});
