/**
 * C3 Desktop Renderer — Shell Layout Component
 *
 * Minimal application layout composing header, runtime status panel, security checks, and footer.
 */

import React from 'react';
import type { SecurityCheckStatus, ShellInfo } from '../types/rendererState';
import { StatusCard } from './StatusCard';
import { SecurityCheckCard } from './SecurityCheckCard';

interface ShellLayoutProps {
  info: ShellInfo;
  security: SecurityCheckStatus;
}

export function ShellLayout({ info, security }: ShellLayoutProps): React.JSX.Element {
  return (
    <div className="shell-layout" data-testid="shell-layout">
      <header className="shell-header">
        <div className="shell-logo">
          <span className="logo-c">C</span>
          <span className="logo-three">3</span>
        </div>
        <h1 className="shell-title">Community Compute Cloud</h1>
        <p className="shell-subtitle">Desktop Renderer Foundation</p>
      </header>

      <main className="shell-main">
        <StatusCard info={info} />
        <SecurityCheckCard security={security} />
      </main>

      <footer className="shell-footer">
        <p>Stage 2C — React Renderer Foundation Architecture</p>
        <p>UI foundation ready for application service integrations</p>
      </footer>
    </div>
  );
}
