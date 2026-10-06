import { describe, it, expect } from 'vitest';
import { SystemClock, FakeClock } from '../../../packages/foundation/src';

describe('Clock Abstraction', () => {
  it('should return system time from SystemClock', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
    expect(clock.timestampMs()).toBeGreaterThanOrEqual(before);
    expect(typeof clock.nowIso()).toBe('string');
  });

  it('should provide deterministic time and controlled progression with FakeClock', () => {
    const initialIso = '2026-03-15T10:00:00.000Z';
    const clock = new FakeClock(initialIso);

    expect(clock.nowIso()).toBe(initialIso);
    expect(clock.now().toISOString()).toBe(initialIso);
    expect(clock.timestampMs()).toBe(new Date(initialIso).getTime());

    clock.advanceByMs(500);
    expect(clock.nowIso()).toBe('2026-03-15T10:00:00.500Z');

    clock.advanceBySeconds(30);
    expect(clock.nowIso()).toBe('2026-03-15T10:00:30.500Z');

    const newDate = new Date('2026-12-31T23:59:59.999Z');
    clock.setDate(newDate);
    expect(clock.nowIso()).toBe('2026-12-31T23:59:59.999Z');
  });
});
