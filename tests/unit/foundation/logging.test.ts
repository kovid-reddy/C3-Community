import { describe, it, expect } from 'vitest';
import {
  MemoryLogger,
  StructuredLogger,
  sanitizeLogMetadata,
  FakeClock,
} from '../../../packages/foundation/src';

describe('Structured Logging & Secret Redaction', () => {
  it('should filter log messages based on log level priority', () => {
    const clock = new FakeClock('2026-01-01T12:00:00.000Z');
    const logger = new MemoryLogger('test-module', 'warn', clock);

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(logger.entries.length).toBe(2);
    expect(logger.entries[0].level).toBe('warn');
    expect(logger.entries[0].message).toBe('Warn message');
    expect(logger.entries[1].level).toBe('error');
    expect(logger.entries[1].message).toBe('Error message');
  });

  it('should record structured context (correlationId, jobId, sessionId, metadata)', () => {
    const clock = new FakeClock('2026-01-01T12:00:00.000Z');
    const logger = new MemoryLogger('compute-module', 'info', clock);

    logger.info('Task started', {
      correlationId: 'corr-123',
      jobId: 'job-456',
      sessionId: 'sess-789',
      metadata: { cpuCores: 8, memoryBytes: 16384 },
    });

    const entry = logger.entries[0];
    expect(entry.timestamp).toBe('2026-01-01T12:00:00.000Z');
    expect(entry.level).toBe('info');
    expect(entry.module).toBe('compute-module');
    expect(entry.message).toBe('Task started');
    expect(entry.correlationId).toBe('corr-123');
    expect(entry.jobId).toBe('job-456');
    expect(entry.sessionId).toBe('sess-789');
    expect(entry.metadata).toEqual({ cpuCores: 8, memoryBytes: 16384 });
  });

  it('should recursively redact all sensitive keys from log metadata', () => {
    const rawMeta = {
      user: 'alice',
      password: 'p@ssword123',
      token: 'bearer.xyz',
      accessToken: 'access.123',
      refreshToken: 'refresh.456',
      clientSecret: 'secret.789',
      authorization: 'Bearer token_str',
      cookie: 'session_id=123',
      apiKey: 'api_key_val',
      credential: { key: 'secret_key_data' },
      k3sToken: 'k3s_token_val',
      joinToken: 'join_token_val',
      nestedObj: {
        safeField: 'hello',
        privateKey: '-----BEGIN PRIVATE KEY-----',
      },
      normalArray: [1, 'safe', { token: 'secret-in-array' }],
    };

    const sanitized = sanitizeLogMetadata(rawMeta);

    expect(sanitized.user).toBe('alice');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.clientSecret).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.cookie).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.credential).toBe('[REDACTED]');
    expect(sanitized.k3sToken).toBe('[REDACTED]');
    expect(sanitized.joinToken).toBe('[REDACTED]');
    expect(sanitized.nestedObj.safeField).toBe('hello');
    expect(sanitized.nestedObj.privateKey).toBe('[REDACTED]');
    expect(sanitized.normalArray[0]).toBe(1);
    expect(sanitized.normalArray[1]).toBe('safe');
    expect(sanitized.normalArray[2].token).toBe('[REDACTED]');
  });

  it('should prevent circular reference crashes during metadata sanitization', () => {
    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;

    expect(() => sanitizeLogMetadata(circularObj)).not.toThrow();
    const sanitized = sanitizeLogMetadata(circularObj);
    expect(sanitized.name).toBe('circular');
    expect(sanitized.self).toBe('[CIRCULAR]');
  });

  it('should pass log entries to custom sink in StructuredLogger', () => {
    const sinkEntries: any[] = [];
    const clock = new FakeClock('2026-06-01T00:00:00.000Z');
    const logger = new StructuredLogger({
      module: 'network',
      minLevel: 'debug',
      clock,
      sink: (entry) => sinkEntries.push(entry),
    });

    logger.debug('Connecting to peer', { correlationId: 'peer-1' });

    expect(sinkEntries.length).toBe(1);
    expect(sinkEntries[0]).toEqual({
      timestamp: '2026-06-01T00:00:00.000Z',
      level: 'debug',
      module: 'network',
      message: 'Connecting to peer',
      correlationId: 'peer-1',
    });
  });
});
