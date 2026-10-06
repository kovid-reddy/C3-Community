import { describe, it, expect } from 'vitest';
import { CryptoIdGenerator } from '../../../packages/foundation/src';

describe('IdGenerator', () => {
  const idGen = new CryptoIdGenerator();

  it('should generate valid non-empty UUID v4 strings', () => {
    const id = idGen.generate();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(36);
    expect(idGen.validate(id)).toBe(true);
  });

  it('should generate IDs with requested prefix', () => {
    const prefixedId = idGen.generate('req');
    expect(prefixedId.startsWith('req_')).toBe(true);
    expect(idGen.validate(prefixedId, 'req')).toBe(true);
    expect(idGen.validate(prefixedId, 'job')).toBe(false);

    const prefixedWithUnderscore = idGen.generate('usr_');
    expect(prefixedWithUnderscore.startsWith('usr_')).toBe(true);
    expect(idGen.validate(prefixedWithUnderscore, 'usr')).toBe(true);
  });

  it('should generate sufficiently unique IDs', () => {
    const count = 1000;
    const generated = new Set<string>();

    for (let i = 0; i < count; i++) {
      generated.add(idGen.generate());
    }

    expect(generated.size).toBe(count);
  });

  it('should reject malformed or invalid IDs', () => {
    expect(idGen.validate('')).toBe(false);
    expect(idGen.validate('invalid-uuid')).toBe(false);
    expect(idGen.validate('req_invalid-uuid', 'req')).toBe(false);
    expect(idGen.validate('12345678-1234-1234-1234-123456789012')).toBe(false); // Version 1 UUID, not v4
  });
});
