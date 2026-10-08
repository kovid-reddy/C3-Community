/**
 * C3 Desktop Renderer — Main App Component
 *
 * Minimal React root component composing the Stage 2C React Renderer Foundation.
 * Communicates strictly via window.c3Shell preload API.
 */

import React from 'react';
import { AppBoundary } from './app/AppBoundary';

export function App(): React.JSX.Element {
  return <AppBoundary />;
}
