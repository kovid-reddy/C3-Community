/**
 * C3 Desktop Renderer — Loading View Component
 *
 * Visual indicator shown during desktop shell runtime initialization.
 */

import React from 'react';

export function LoadingView(): React.JSX.Element {
  return (
    <div className="status-container" data-testid="loading-view" role="status" aria-live="polite">
      <div className="loading-spinner" aria-label="Loading spinner" />
      <h2 className="loading-title">Initializing Desktop Runtime…</h2>
      <p className="loading-subtitle">Verifying window.c3Shell IPC bridge</p>
    </div>
  );
}
