/**
 * C3 Service Lifecycle Architecture
 * Generic state machine and primitive for application service lifecycles.
 */

import { AppError } from './error';

export type LifecycleState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAILED';

export interface ServiceLifecycle {
  readonly state: LifecycleState;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface LifecycleHooks {
  onStart?(): Promise<void>;
  onStop?(): Promise<void>;
  onCleanup?(): Promise<void>;
}

export class BaseLifecycle implements ServiceLifecycle {
  private currentState: LifecycleState = 'STOPPED';
  private transitionPromise: Promise<void> | null = null;
  private readonly hooks: LifecycleHooks;

  constructor(hooks: LifecycleHooks = {}) {
    this.hooks = hooks;
  }

  get state(): LifecycleState {
    return this.currentState;
  }

  private getState(): LifecycleState {
    return this.currentState;
  }

  async start(): Promise<void> {
    if (this.getState() === 'RUNNING') {
      throw new AppError({
        code: 'ERR_LIFECYCLE_ALREADY_STARTED',
        category: 'INTERNAL_ERROR',
        message: 'Service is already running.',
        metadata: { state: this.currentState },
      });
    }

    if (this.getState() === 'STARTING' || this.getState() === 'STOPPING') {
      if (this.transitionPromise) {
        await this.transitionPromise;
        if (this.getState() === 'RUNNING') {
          return;
        }
      }
    }

    this.currentState = 'STARTING';
    const executeStart = async () => {
      try {
        if (this.hooks.onStart) {
          await this.hooks.onStart();
        }
        this.currentState = 'RUNNING';
      } catch (err) {
        this.currentState = 'FAILED';
        if (this.hooks.onCleanup) {
          try {
            await this.hooks.onCleanup();
          } catch {
            // Ignore secondary cleanup errors to preserve primary error
          }
        }
        throw new AppError({
          code: 'ERR_LIFECYCLE_START_FAILED',
          category: 'INTERNAL_ERROR',
          message: 'Service failed to start.',
          cause: err,
        });
      } finally {
        this.transitionPromise = null;
      }
    };

    this.transitionPromise = executeStart();
    await this.transitionPromise;
  }

  async stop(): Promise<void> {
    if (this.getState() === 'STOPPED') {
      return; // Safe & idempotent when already stopped
    }

    if (this.getState() === 'STOPPING') {
      if (this.transitionPromise) {
        await this.transitionPromise;
      }
      return;
    }

    this.currentState = 'STOPPING';
    const executeStop = async () => {
      try {
        if (this.hooks.onStop) {
          await this.hooks.onStop();
        }
      } finally {
        if (this.hooks.onCleanup) {
          try {
            await this.hooks.onCleanup();
          } catch {
            // Ignore cleanup failure during stop
          }
        }
        this.currentState = 'STOPPED';
        this.transitionPromise = null;
      }
    };

    this.transitionPromise = executeStop();
    await this.transitionPromise;
  }
}
