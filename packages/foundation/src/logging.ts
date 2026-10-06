/**
 * C3 Logging Architecture
 * Structured logging contracts, implementations, and secret redaction.
 */

import { Clock, SystemClock } from './clock';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContextOptions {
  readonly module?: string;
  readonly correlationId?: string;
  readonly jobId?: string;
  readonly sessionId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly correlationId?: string;
  readonly jobId?: string;
  readonly sessionId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: LogContextOptions): void;
  info(message: string, context?: LogContextOptions): void;
  warn(message: string, context?: LogContextOptions): void;
  error(message: string, context?: LogContextOptions): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

export const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'secret',
  'secretKey',
  'authorization',
  'cookie',
  'apiKey',
  'credential',
  'credentials',
  'privateKey',
  'k3sToken',
  'joinToken',
] as const;

const MAX_DEPTH = 8;
const MAX_ARRAY_LENGTH = 100;

/**
 * Recursively sanitizes log metadata to redact sensitive values, safely handling arrays, nested objects, errors, circular references, and large payloads.
 */
export function sanitizeLogMetadata(
  target: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0
): any {
  if (target === null || target === undefined) {
    return target;
  }

  if (depth > MAX_DEPTH) {
    return '[TRUNCATED_MAX_DEPTH]';
  }

  if (typeof target === 'function') {
    return '[FUNCTION]';
  }

  if (typeof target !== 'object') {
    return target;
  }

  if (seen.has(target as object)) {
    return '[CIRCULAR]';
  }

  seen.add(target as object);

  if (target instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: target.name,
      message: target.message,
    };
    if (target.stack) {
      errorObj.stack = target.stack;
    }
    const sanitizedError: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(target)) {
      if (isSensitiveKey(k)) {
        sanitizedError[k] = '[REDACTED]';
      } else {
        sanitizedError[k] = sanitizeLogMetadata(v, seen, depth + 1);
      }
    }
    return { ...errorObj, ...sanitizedError };
  }

  if (Array.isArray(target)) {
    const len = Math.min(target.length, MAX_ARRAY_LENGTH);
    const sanitizedArray = [];
    for (let i = 0; i < len; i++) {
      sanitizedArray.push(sanitizeLogMetadata(target[i], seen, depth + 1));
    }
    if (target.length > MAX_ARRAY_LENGTH) {
      sanitizedArray.push(`[... ${target.length - MAX_ARRAY_LENGTH} items truncated]`);
    }
    return sanitizedArray;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogMetadata(value, seen, depth + 1);
    }
  }

  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive.toLowerCase()));
}

export interface StructuredLoggerOptions {
  readonly module?: string;
  readonly minLevel?: LogLevel;
  readonly clock?: Clock;
  readonly sink?: (entry: LogEntry) => void;
  readonly jsonFormat?: boolean;
}

export class StructuredLogger implements Logger {
  private module: string;
  private minLevel: LogLevel;
  private readonly clock: Clock;
  private readonly sink: (entry: LogEntry) => void;
  private readonly jsonFormat: boolean;

  constructor(options: StructuredLoggerOptions = {}) {
    this.module = options.module ?? 'foundation';
    this.minLevel = options.minLevel ?? 'info';
    this.clock = options.clock ?? new SystemClock();
    this.jsonFormat = options.jsonFormat ?? true;
    this.sink = options.sink ?? this.defaultSink.bind(this);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  debug(message: string, context?: LogContextOptions): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContextOptions): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContextOptions): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContextOptions): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context: LogContextOptions = {}): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    try {
      const moduleName = context.module ?? this.module;
      const entry: LogEntry = {
        timestamp: this.clock.nowIso(),
        level,
        module: moduleName,
        message,
        ...(context.correlationId ? { correlationId: context.correlationId } : {}),
        ...(context.jobId ? { jobId: context.jobId } : {}),
        ...(context.sessionId ? { sessionId: context.sessionId } : {}),
        ...(context.metadata !== undefined
          ? { metadata: sanitizeLogMetadata(context.metadata) }
          : {}),
      };

      this.sink(entry);
    } catch {
      // Logging must never crash the application.
    }
  }

  private defaultSink(entry: LogEntry): void {
    if (this.jsonFormat) {
      const json = JSON.stringify(entry);
      if (entry.level === 'error') {
        console.error(json);
      } else if (entry.level === 'warn') {
        console.warn(json);
      } else {
        console.log(json);
      }
    } else {
      const metaStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
      const formatted = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${metaStr}`;
      if (entry.level === 'error') {
        console.error(formatted);
      } else if (entry.level === 'warn') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }
}

/**
 * Memory logger for deterministic testing.
 */
export class MemoryLogger implements Logger {
  readonly entries: LogEntry[] = [];
  private minLevel: LogLevel;
  private readonly clock: Clock;
  private module: string;

  constructor(module = 'test', minLevel: LogLevel = 'debug', clock?: Clock) {
    this.module = module;
    this.minLevel = minLevel;
    this.clock = clock ?? new SystemClock();
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  debug(message: string, context?: LogContextOptions): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContextOptions): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContextOptions): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContextOptions): void {
    this.log('error', message, context);
  }

  clear(): void {
    this.entries.length = 0;
  }

  private log(level: LogLevel, message: string, context: LogContextOptions = {}): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.clock.nowIso(),
      level,
      module: context.module ?? this.module,
      message,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
      ...(context.jobId ? { jobId: context.jobId } : {}),
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context.metadata !== undefined
        ? { metadata: sanitizeLogMetadata(context.metadata) }
        : {}),
    };

    this.entries.push(entry);
  }
}
