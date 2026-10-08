/**
 * C3 Desktop Renderer — Error Boundary Component
 *
 * Prevents application crash/blank screens by catching unexpected React render errors.
 * Displays a safe user-facing fallback without exposing stack traces or internal secrets.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log sanitized diagnostic details locally to console for developer debugging
    console.error('[C3 Renderer ErrorBoundary] Uncaught render error caught:', error.message, errorInfo.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-root" data-testid="error-boundary-fallback" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon" aria-hidden="true">⚠️</div>
            <h2>Unexpected Interface Error</h2>
            <p className="error-boundary-text">
              The application encountered an unexpected visual rendering error. No data or sensitive details were exposed.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={this.handleReset}
              data-testid="error-boundary-reset"
            >
              Reset Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
