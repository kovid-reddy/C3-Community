import { describe, it, expect } from 'vitest';
import { ok, err, isSuccess, isFailure, AppError } from '../../../packages/foundation/src';

describe('Result Primitive', () => {
  it('should construct and identify Success results', () => {
    const res = ok({ data: 'hello' });

    expect(res.success).toBe(true);
    expect(res.value).toEqual({ data: 'hello' });
    expect(isSuccess(res)).toBe(true);
    expect(isFailure(res)).toBe(false);

    if (isSuccess(res)) {
      expect(res.value.data).toBe('hello');
    }
  });

  it('should construct and identify Failure results', () => {
    const appErr = new AppError({
      code: 'ERR_TEST',
      category: 'VALIDATION_ERROR',
      message: 'Validation failed',
    });
    const res = err(appErr);

    expect(res.success).toBe(false);
    expect(res.error).toBe(appErr);
    expect(isSuccess(res)).toBe(false);
    expect(isFailure(res)).toBe(true);

    if (isFailure(res)) {
      expect(res.error.code).toBe('ERR_TEST');
    }
  });
});
