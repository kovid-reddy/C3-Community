import { describe, it, expect } from 'vitest';
import * as Foundation from '../../packages/foundation/src';

describe('Foundation Index Exports', () => {
  it('should export all public Foundation primitives from index', () => {
    expect(Foundation.EnvConfigService).toBeDefined();
    expect(Foundation.AppError).toBeDefined();
    expect(Foundation.isAppError).toBeDefined();
    expect(Foundation.normalizeError).toBeDefined();
    expect(Foundation.serializeError).toBeDefined();
    expect(Foundation.StructuredLogger).toBeDefined();
    expect(Foundation.MemoryLogger).toBeDefined();
    expect(Foundation.sanitizeLogMetadata).toBeDefined();
    expect(Foundation.CryptoIdGenerator).toBeDefined();
    expect(Foundation.SystemClock).toBeDefined();
    expect(Foundation.FakeClock).toBeDefined();
    expect(Foundation.BaseLifecycle).toBeDefined();
    expect(Foundation.ok).toBeDefined();
    expect(Foundation.err).toBeDefined();
    expect(Foundation.isSuccess).toBeDefined();
    expect(Foundation.isFailure).toBeDefined();
  });
});
