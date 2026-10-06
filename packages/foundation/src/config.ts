/**
 * C3 Configuration Architecture
 * Centralized Configuration Interface & Implementation.
 */

import { AppError } from './error';

export type Environment = 'development' | 'test' | 'production';

export interface ConfigOptions {
  readonly env?: Record<string, string | undefined>;
  readonly defaults?: Record<string, string | number | boolean>;
  readonly environment?: Environment;
}

export interface ConfigService {
  get<T = string>(key: string, defaultValue?: T): T;
  getRequired<T = string>(key: string): T;
  getNumber(key: string, defaultValue?: number): number;
  getRequiredNumber(key: string): number;
  getBoolean(key: string, defaultValue?: boolean): boolean;
  getRequiredBoolean(key: string): boolean;
  has(key: string): boolean;
  getEnvironment(): Environment;
}

export class EnvConfigService implements ConfigService {
  private readonly configMap: ReadonlyMap<string, string>;
  private readonly defaultsMap: ReadonlyMap<string, string | number | boolean>;
  private readonly environment: Environment;

  constructor(options: ConfigOptions = {}) {
    const rawEnv = options.env ?? process.env;
    const cleanedEnv = new Map<string, string>();

    for (const [key, value] of Object.entries(rawEnv)) {
      if (value !== undefined) {
        cleanedEnv.set(key, value);
      }
    }

    this.configMap = Object.freeze(cleanedEnv);

    const defaults = new Map<string, string | number | boolean>();
    if (options.defaults) {
      for (const [key, value] of Object.entries(options.defaults)) {
        defaults.set(key, value);
      }
    }
    this.defaultsMap = Object.freeze(defaults);

    if (options.environment) {
      this.environment = options.environment;
    } else {
      const nodeEnv = (cleanedEnv.get('C3_ENV') ?? cleanedEnv.get('NODE_ENV') ?? 'development').toLowerCase();
      if (nodeEnv === 'production' || nodeEnv === 'prod') {
        this.environment = 'production';
      } else if (nodeEnv === 'test') {
        this.environment = 'test';
      } else {
        this.environment = 'development';
      }
    }
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  has(key: string): boolean {
    return this.configMap.has(key) || this.defaultsMap.has(key);
  }

  get<T = string>(key: string, defaultValue?: T): T {
    if (this.configMap.has(key)) {
      return this.configMap.get(key) as unknown as T;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    if (this.defaultsMap.has(key)) {
      return this.defaultsMap.get(key) as unknown as T;
    }
    throw new AppError({
      code: 'ERR_CONFIG_MISSING',
      category: 'CONFIG_ERROR',
      message: `Configuration key '${key}' is missing and no default value was provided.`,
      metadata: { key },
    });
  }

  getRequired<T = string>(key: string): T {
    if (this.configMap.has(key)) {
      const val = this.configMap.get(key);
      if (val !== undefined && val !== '') {
        return val as unknown as T;
      }
    }
    if (this.defaultsMap.has(key)) {
      const val = this.defaultsMap.get(key);
      if (val !== undefined && val !== '') {
        return val as unknown as T;
      }
    }
    throw new AppError({
      code: 'ERR_CONFIG_MISSING',
      category: 'CONFIG_ERROR',
      message: `Required configuration key '${key}' is missing.`,
      metadata: { key },
    });
  }

  getNumber(key: string, defaultValue?: number): number {
    if (!this.has(key) && defaultValue !== undefined) {
      return defaultValue;
    }
    return this.parseNumber(key);
  }

  getRequiredNumber(key: string): number {
    if (!this.has(key)) {
      throw new AppError({
        code: 'ERR_CONFIG_MISSING',
        category: 'CONFIG_ERROR',
        message: `Required numeric configuration key '${key}' is missing.`,
        metadata: { key },
      });
    }
    return this.parseNumber(key);
  }

  getBoolean(key: string, defaultValue?: boolean): boolean {
    if (!this.has(key) && defaultValue !== undefined) {
      return defaultValue;
    }
    return this.parseBoolean(key);
  }

  getRequiredBoolean(key: string): boolean {
    if (!this.has(key)) {
      throw new AppError({
        code: 'ERR_CONFIG_MISSING',
        category: 'CONFIG_ERROR',
        message: `Required boolean configuration key '${key}' is missing.`,
        metadata: { key },
      });
    }
    return this.parseBoolean(key);
  }

  private parseNumber(key: string): number {
    const raw = this.getRawValue(key);
    if (typeof raw === 'number') {
      return raw;
    }
    const num = Number(raw);
    if (isNaN(num)) {
      throw new AppError({
        code: 'ERR_CONFIG_INVALID',
        category: 'CONFIG_ERROR',
        message: `Configuration key '${key}' must be a valid number, received '${raw}'.`,
        metadata: { key, rawValue: String(raw) },
      });
    }
    return num;
  }

  private parseBoolean(key: string): boolean {
    const raw = this.getRawValue(key);
    if (typeof raw === 'boolean') {
      return raw;
    }
    const str = String(raw).trim().toLowerCase();
    if (str === 'true' || str === '1' || str === 'yes') {
      return true;
    }
    if (str === 'false' || str === '0' || str === 'no') {
      return false;
    }
    throw new AppError({
      code: 'ERR_CONFIG_INVALID',
      category: 'CONFIG_ERROR',
      message: `Configuration key '${key}' must be a valid boolean, received '${raw}'.`,
      metadata: { key, rawValue: String(raw) },
    });
  }

  private getRawValue(key: string): string | number | boolean {
    if (this.configMap.has(key)) {
      return this.configMap.get(key)!;
    }
    if (this.defaultsMap.has(key)) {
      return this.defaultsMap.get(key)!;
    }
    throw new AppError({
      code: 'ERR_CONFIG_MISSING',
      category: 'CONFIG_ERROR',
      message: `Configuration key '${key}' is missing.`,
      metadata: { key },
    });
  }
}
