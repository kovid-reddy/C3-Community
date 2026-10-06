import { describe, it, expect } from 'vitest';
import {
  EnvConfigService,
  StructuredLogger,
  MemoryLogger,
  CryptoIdGenerator,
  AppError,
  serializeError,
  FakeClock,
  BaseLifecycle,
} from '../../../packages/foundation/src';

describe('Foundation Stage 1 Smoke Test', () => {
  it('should validate all 7 foundation primitives end-to-end without external dependencies', async () => {
    // 1. Configuration loads
    const config = new EnvConfigService({
      env: { C3_ENV: 'test', PORT: '9000' },
      defaults: { LOG_LEVEL: 'info' },
    });
    expect(config.getEnvironment()).toBe('test');
    expect(config.getNumber('PORT')).toBe(9000);
    expect(config.get('LOG_LEVEL')).toBe('info');

    // 2. Logger initializes & 3. Log is emitted
    const memLogger = new MemoryLogger('smoke-test', 'debug');
    memLogger.info('Foundation smoke test started', {
      metadata: { env: config.getEnvironment() },
    });
    expect(memLogger.entries.length).toBe(1);
    expect(memLogger.entries[0].message).toBe('Foundation smoke test started');

    // Also test StructuredLogger
    const loggedEntries: any[] = [];
    const logger = new StructuredLogger({
      module: 'smoke',
      sink: (e) => loggedEntries.push(e),
    });
    logger.info('Structured log entry');
    expect(loggedEntries.length).toBe(1);

    // 4. ID is generated
    const idGen = new CryptoIdGenerator();
    const generatedId = idGen.generate('smoke');
    expect(generatedId.startsWith('smoke_')).toBe(true);
    expect(idGen.validate(generatedId, 'smoke')).toBe(true);

    // 5. AppError is created / serialized
    const appError = new AppError({
      code: 'ERR_SMOKE_TEST',
      category: 'INTERNAL_ERROR',
      message: 'Smoke test assertion error',
      metadata: { generatedId, secretToken: 'do-not-log-me' },
    });
    const serialized = serializeError(appError);
    expect(serialized.code).toBe('ERR_SMOKE_TEST');
    expect((serialized.metadata as any).secretToken).toBe('[REDACTED]');

    // 6. Fake clock works
    const fakeClock = new FakeClock('2026-10-06T12:00:00.000Z');
    expect(fakeClock.nowIso()).toBe('2026-10-06T12:00:00.000Z');
    fakeClock.advanceBySeconds(10);
    expect(fakeClock.nowIso()).toBe('2026-10-06T12:00:10.000Z');

    // 7. Lifecycle primitive works
    let started = false;
    let stopped = false;
    const lifecycle = new BaseLifecycle({
      onStart: async () => {
        started = true;
      },
      onStop: async () => {
        stopped = true;
      },
    });

    expect(lifecycle.state).toBe('STOPPED');
    await lifecycle.start();
    expect(lifecycle.state).toBe('RUNNING');
    expect(started).toBe(true);

    await lifecycle.stop();
    expect(lifecycle.state).toBe('STOPPED');
    expect(stopped).toBe(true);
  });
});
