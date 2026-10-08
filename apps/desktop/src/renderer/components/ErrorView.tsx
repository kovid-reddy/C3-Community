/**
 * C3 Desktop Renderer — Error View Component
 *
 * Displays initialization failure state cleanly without exposing sensitive system details.
 */

import React from 'react';
import type { RendererErrorInfo } from '../types/rendererState';

interface ErrorViewProps {
  error: RendererErrorInfo;
  onRetry?: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps): React.JSX.Element {
  return (
    <div className="status-container error-view" data-testid="error-view" role="alert">
      <div className="error-badge">Initialization Failure</div>
      <h2 className="error-title">{error.userFacingMessage}</h2>
      <p className="error-code-label">Error Code: <code>{error.code}</code></p>
      {onRetry && (
        <button type="button" className="btn-primary" onClick={onRetry} data-testid="btn-retry-init">
          Retry IPC Connection
        </button>
      )}
    </div>
  );
}
