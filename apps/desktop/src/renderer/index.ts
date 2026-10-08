/**
 * C3 Desktop Shell — Renderer Process Public Exports
 *
 * Exports renderer foundation types, services, and components.
 */

export type { C3ShellAPI } from '../preload/index';
export type {
  RendererStatus,
  ShellInfo,
  RendererErrorInfo,
  RendererState,
  SecurityCheckStatus,
} from './types/rendererState';

export { getC3ShellAPI, initializeShell, performSecurityCheck } from './services/shellService';
export { useShellInit } from './services/useShellInit';
export { ErrorBoundary } from './components/ErrorBoundary';
export { LoadingView } from './components/LoadingView';
export { ErrorView } from './components/ErrorView';
export { StatusCard } from './components/StatusCard';
export { SecurityCheckCard } from './components/SecurityCheckCard';
export { ShellLayout } from './components/ShellLayout';
export { AppBoundary, AppRoot } from './app/AppBoundary';
export { App } from './App';
