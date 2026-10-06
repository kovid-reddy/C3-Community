import { describe, it, expect } from 'vitest';
import { EnvConfigService, AppError } from '../../../packages/foundation/src';

describe('ConfigService', () => {
  it('should load configuration from environment and defaults', () => {
    const config = new EnvConfigService({
      env: {
        PORT: '8080',
        APP_NAME: 'C3 Cloud',
      },
      defaults: {
        HOST: 'localhost',
        TIMEOUT: 5000,
      },
    });

    expect(config.get('PORT')).toBe('8080');
    expect(config.get('APP_NAME')).toBe('C3 Cloud');
    expect(config.get('HOST')).toBe('localhost');
    expect(config.getNumber('TIMEOUT')).toBe(5000);
    expect(config.has('PORT')).toBe(true);
    expect(config.has('HOST')).toBe(true);
    expect(config.has('NON_EXISTENT')).toBe(false);
  });

  it('should get required values or throw ERR_CONFIG_MISSING', () => {
    const config = new EnvConfigService({
      env: { DB_HOST: '127.0.0.1' },
    });

    expect(config.getRequired('DB_HOST')).toBe('127.0.0.1');
    expect(() => config.getRequired('MISSING_KEY')).toThrow(AppError);

    try {
      config.getRequired('MISSING_KEY');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('ERR_CONFIG_MISSING');
      expect(appErr.category).toBe('CONFIG_ERROR');
    }
  });

  it('should parse numbers correctly and throw on invalid numbers', () => {
    const config = new EnvConfigService({
      env: {
        VALID_NUM: '42',
        FLOAT_NUM: '3.14',
        INVALID_NUM: 'not_a_number',
      },
      defaults: {
        DEFAULT_NUM: 100,
      },
    });

    expect(config.getNumber('VALID_NUM')).toBe(42);
    expect(config.getRequiredNumber('VALID_NUM')).toBe(42);
    expect(config.getNumber('FLOAT_NUM')).toBe(3.14);
    expect(config.getNumber('DEFAULT_NUM')).toBe(100);
    expect(config.getNumber('MISSING_NUM', 999)).toBe(999);

    expect(() => config.getNumber('INVALID_NUM')).toThrow(AppError);
    try {
      config.getNumber('INVALID_NUM');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('ERR_CONFIG_INVALID');
      expect(appErr.category).toBe('CONFIG_ERROR');
    }
  });

  it('should parse booleans correctly for true/false, 1/0, yes/no', () => {
    const config = new EnvConfigService({
      env: {
        BOOL_TRUE: 'true',
        BOOL_ONE: '1',
        BOOL_YES: 'YES',
        BOOL_FALSE: 'false',
        BOOL_ZERO: '0',
        BOOL_NO: 'no',
        BOOL_INVALID: 'maybe',
      },
    });

    expect(config.getBoolean('BOOL_TRUE')).toBe(true);
    expect(config.getBoolean('BOOL_ONE')).toBe(true);
    expect(config.getBoolean('BOOL_YES')).toBe(true);
    expect(config.getBoolean('BOOL_FALSE')).toBe(false);
    expect(config.getBoolean('BOOL_ZERO')).toBe(false);
    expect(config.getBoolean('BOOL_NO')).toBe(false);

    expect(() => config.getBoolean('BOOL_INVALID')).toThrow(AppError);
  });

  it('should correctly select environment mode', () => {
    const devConfig = new EnvConfigService({ env: { C3_ENV: 'development' } });
    expect(devConfig.getEnvironment()).toBe('development');

    const prodConfig = new EnvConfigService({ env: { NODE_ENV: 'production' } });
    expect(prodConfig.getEnvironment()).toBe('production');

    const testConfig = new EnvConfigService({ env: { NODE_ENV: 'test' } });
    expect(testConfig.getEnvironment()).toBe('test');

    const explicitConfig = new EnvConfigService({ environment: 'production' });
    expect(explicitConfig.getEnvironment()).toBe('production');
  });

  it('should maintain immutability after initialization', () => {
    const customEnv: Record<string, string | undefined> = { FOO: 'bar' };
    const config = new EnvConfigService({ env: customEnv });

    // Mutating source env object after init should not change config
    customEnv.FOO = 'baz';
    customEnv.NEW_KEY = 'added';

    expect(config.get('FOO')).toBe('bar');
    expect(config.has('NEW_KEY')).toBe(false);
  });
});
