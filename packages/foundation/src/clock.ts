/**
 * C3 Clock Abstraction
 * Provides deterministic time sources for testing and system operations.
 */

export interface Clock {
  now(): Date;
  nowIso(): string;
  timestampMs(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  timestampMs(): number {
    return Date.now();
  }
}

export class FakeClock implements Clock {
  private currentTimeMs: number;

  constructor(initialTime: Date | number | string = '2026-01-01T00:00:00.000Z') {
    if (typeof initialTime === 'number') {
      this.currentTimeMs = initialTime;
    } else if (initialTime instanceof Date) {
      this.currentTimeMs = initialTime.getTime();
    } else {
      this.currentTimeMs = new Date(initialTime).getTime();
    }
  }

  now(): Date {
    return new Date(this.currentTimeMs);
  }

  nowIso(): string {
    return new Date(this.currentTimeMs).toISOString();
  }

  timestampMs(): number {
    return this.currentTimeMs;
  }

  setDate(date: Date): void {
    this.currentTimeMs = date.getTime();
  }

  advanceByMs(ms: number): void {
    this.currentTimeMs += ms;
  }

  advanceBySeconds(seconds: number): void {
    this.currentTimeMs += seconds * 1000;
  }
}
