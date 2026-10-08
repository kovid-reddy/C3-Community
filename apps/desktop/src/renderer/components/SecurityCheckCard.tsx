/**
 * C3 Desktop Renderer — Security Check Card Component
 *
 * Visually confirms renderer environment context isolation and absence of privileged Node APIs.
 */

import React from 'react';
import type { SecurityCheckStatus } from '../types/rendererState';

interface SecurityCheckCardProps {
  security: SecurityCheckStatus;
}

export function SecurityCheckCard({ security }: SecurityCheckCardProps): React.JSX.Element {
  return (
    <div className="card-panel" data-testid="security-card">
      <h2 className="card-title">Security & Sandbox Verification</h2>
      <div className="card-content">
        <SecurityRow label="process (Node API)" isBlocked={security.processUndefined} />
        <SecurityRow label="require (Node API)" isBlocked={security.requireUndefined} />
        <SecurityRow label="module (Node API)" isBlocked={security.moduleUndefined} />
        <div className={`security-banner ${security.allSecure ? 'banner-secure' : 'banner-warning'}`}>
          {security.allSecure
            ? '✓ Renderer Sandbox Isolation Enforced'
            : '⚠️ Privileged Node APIs Detected in Renderer Context'}
        </div>
      </div>
    </div>
  );
}

function SecurityRow({ label, isBlocked }: { label: string; isBlocked: boolean }) {
  return (
    <div className="status-row">
      <span className="status-label code-font">{label}</span>
      <span className={`badge ${isBlocked ? 'badge-secure' : 'badge-danger'}`}>
        {isBlocked ? '✓ Blocked' : '✗ Exposed'}
      </span>
    </div>
  );
}
