/**
 * C3 Logging Architecture
 * Structured logging contracts and metadata sanitization.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  readonly module: string;
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
  debug(message: string, context?: Omit<LogContext, 'module'>): void;
  info(message: string, context?: Omit<LogContext, 'module'>): void;
  warn(message: string, context?: Omit<LogContext, 'module'>): void;
  error(message: string, context?: Omit<LogContext, 'module'>): void;
}

export const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'secretKey',
  'joinToken',
  'privateKey',
  'credentials',
] as const;

export function sanitizeLogMetadata(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
