/**
 * C3 Result Model
 * Lightweight functional result type for explicit error handling without exceptions.
 */

import { AppError } from './error';

export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

export interface Failure<E = AppError> {
  readonly success: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Success<T> | Failure<E>;

export function ok<T>(value: T): Success<T> {
  return { success: true, value };
}

export function err<E>(error: E): Failure<E> {
  return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}
