/**
 * C3 Cloud Package
 * Abstract persistence repository interfaces for cloud-managed data.
 * Zero database-specific code (no DynamoDB, PostgreSQL, etc.).
 */

import { User, Provider, ProviderSession, NegotiationMessage, CreditBalance, Job } from '@c3/contracts';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface ProviderRepository {
  findById(id: string): Promise<Provider | null>;
  listAvailable(): Promise<readonly Provider[]>;
  save(provider: Provider): Promise<void>;
}

export interface SessionRepository {
  findById(id: string): Promise<ProviderSession | null>;
  save(session: ProviderSession): Promise<void>;
}

export interface MessageRepository {
  send(message: NegotiationMessage): Promise<void>;
  listForRequest(requestId: string): Promise<readonly NegotiationMessage[]>;
}

export interface CreditRepository {
  getBalance(userId: string): Promise<CreditBalance | null>;
  updateBalance(userId: string, delta: number): Promise<CreditBalance>;
}

export interface CloudJobRepository {
  findById(id: string): Promise<Job | null>;
  save(job: Job): Promise<void>;
  listByUser(userId: string): Promise<readonly Job[]>;
}
