import { describe, it, expect, vi } from 'vitest';
import { BaseLifecycle, AppError } from '../../../packages/foundation/src';

describe('Service Lifecycle Primitive', () => {
  it('should handle normal start and stop lifecycle', async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    const onStop = vi.fn().mockResolvedValue(undefined);

    const lifecycle = new BaseLifecycle({ onStart, onStop });

    expect(lifecycle.state).toBe('STOPPED');

    await lifecycle.start();
    expect(lifecycle.state).toBe('RUNNING');
    expect(onStart).toHaveBeenCalledTimes(1);

    await lifecycle.stop();
    expect(lifecycle.state).toBe('STOPPED');
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('should throw ERR_LIFECYCLE_ALREADY_STARTED on duplicate start', async () => {
    const lifecycle = new BaseLifecycle();
    await lifecycle.start();
    expect(lifecycle.state).toBe('RUNNING');

    await expect(lifecycle.start()).rejects.toThrow(AppError);

    try {
      await lifecycle.start();
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('ERR_LIFECYCLE_ALREADY_STARTED');
    }
  });

  it('should be safe and idempotent on repeated stop calls', async () => {
    const onStop = vi.fn().mockResolvedValue(undefined);
    const lifecycle = new BaseLifecycle({ onStop });

    await lifecycle.start();
    await lifecycle.stop();
    expect(lifecycle.state).toBe('STOPPED');

    await lifecycle.stop(); // Repeated stop
    expect(lifecycle.state).toBe('STOPPED');
    expect(onStop).toHaveBeenCalledTimes(1); // Should not call onStop again when already stopped
  });

  it('should transition to FAILED state and run cleanup when startup fails', async () => {
    const startError = new Error('Startup crashed');
    const onStart = vi.fn().mockRejectedValue(startError);
    const onCleanup = vi.fn().mockResolvedValue(undefined);

    const lifecycle = new BaseLifecycle({ onStart, onCleanup });

    await expect(lifecycle.start()).rejects.toThrow(AppError);

    expect(lifecycle.state).toBe('FAILED');
    expect(onCleanup).toHaveBeenCalledTimes(1);
  });
});
