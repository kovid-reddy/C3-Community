/**
 * C3 Desktop Renderer — App Boundary & Composition Root
 *
 * Handles root initialization state rendering and top-level error boundary wrapping.
 */

import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingView } from '../components/LoadingView';
import { ErrorView } from '../components/ErrorView';
import { ShellLayout } from '../components/ShellLayout';
import { useShellInit } from '../services/useShellInit';
import { performSecurityCheck } from '../services/shellService';

export function AppRoot(): React.JSX.Element {
  const { state, retry } = useShellInit();
  const security = performSecurityCheck();

  if (state.status === 'initializing') {
    return <LoadingView />;
  }

  if (state.status === 'error') {
    return <ErrorView error={state.error} onRetry={retry} />;
  }

  return <ShellLayout info={state.info} security={security} />;
}

export function AppBoundary(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  );
}
