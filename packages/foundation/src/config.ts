/**
 * C3 Configuration Architecture
 * Centralized Configuration Interface.
 */

export interface ConfigService {
  get<T>(key: string, defaultValue?: T): T;
  has(key: string): boolean;
}
