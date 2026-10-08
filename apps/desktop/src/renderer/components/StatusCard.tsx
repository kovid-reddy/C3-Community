/**
 * C3 Desktop Renderer — Status Card Component
 *
 * Displays shell runtime status metrics retrieved via typed window.c3Shell.
 */

import React from 'react';
import type { ShellInfo } from '../types/rendererState';

interface StatusCardProps {
  info: ShellInfo;
}

export function StatusCard({ info }: StatusCardProps): React.JSX.Element {
  return (
    <div className="card-panel" data-testid="status-card">
      <h2 className="card-title">Desktop Shell Runtime</h2>
      <div className="card-content">
        <StatusRow label="Application Status" value="Ready" status="ok" />
        <StatusRow label="IPC Bridge" value="Connected" status="ok" />
        <StatusRow label="IPC Ping Response" value={info.ping} status={info.ping === 'pong' ? 'ok' : 'pending'} />
        <StatusRow label="App Version" value={info.version} status="ok" />
        <StatusRow label="Host Platform" value={info.platform} status="ok" />
      </div>
    </div>
  );
}

function StatusRow({ label, value, status }: { label: string; value: string; status: 'ok' | 'pending' | 'error' }) {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className={`status-value status-${status}`}>{value}</span>
    </div>
  );
}
