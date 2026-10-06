/**
 * C3 Desktop Renderer — Shell App Component
 *
 * Minimal renderer to verify the Electron shell works.
 * This is NOT the C3 dashboard. No feature functionality is implemented here.
 *
 * Security verification (tested at runtime):
 *   - window.process: intentionally blocked by Electron's contextIsolation
 *   - window.require: undefined
 *   - window.module: undefined
 *   - window.c3Shell: only API from preload contextBridge
 */

import React, { useEffect, useState } from 'react';

interface ShellState {
  version: string | null;
  pingResult: string | null;
  ipcBridgeOk: boolean;
  securityCheck: SecurityCheck;
  platform: string;
}

interface SecurityCheck {
  processUndefined: boolean;
  requireUndefined: boolean;
  moduleUndefined: boolean;
}

function runSecurityChecks(): SecurityCheck {
  // Verify renderer does NOT have privileged Node access
  // In a properly secured Electron app, these must be guarded values
  const w = window as unknown as Record<string, unknown>;
  return {
    // process may be partially defined by Electron (process.versions etc.) but must NOT provide fs/child_process
    processUndefined: typeof w['process'] === 'undefined',
    requireUndefined: typeof w['require'] === 'undefined',
    moduleUndefined: typeof w['module'] === 'undefined',
  };
}

export function App(): React.JSX.Element {
  const [state, setState] = useState<ShellState>({
    version: null,
    pingResult: null,
    ipcBridgeOk: false,
    securityCheck: runSecurityChecks(),
    platform: window.c3Shell?.platform ?? 'unknown',
  });

  useEffect(() => {
    async function initShell() {
      try {
        const [version, ping] = await Promise.all([
          window.c3Shell.getVersion(),
          window.c3Shell.ping(),
        ]);
        setState((prev) => ({
          ...prev,
          version,
          pingResult: ping,
          ipcBridgeOk: true,
          securityCheck: runSecurityChecks(),
        }));
      } catch (err) {
        console.error('[C3 Shell] IPC bridge call failed:', err);
        setState((prev) => ({
          ...prev,
          ipcBridgeOk: false,
        }));
      }
    }

    void initShell();
  }, []);

  const allSecure = Object.values(state.securityCheck).every((v) => v);

  return (
    <div className="shell-root">
      <div className="shell-header">
        <div className="shell-logo">
          <span className="logo-c">C</span>
          <span className="logo-three">3</span>
        </div>
        <h1>Community Compute Cloud</h1>
        <p className="shell-subtitle">Application Shell</p>
      </div>

      <div className="shell-status">
        <StatusRow
          label="Application Status"
          value="Running"
          ok={true}
        />
        <StatusRow
          label="IPC Bridge"
          value={state.ipcBridgeOk ? 'Connected' : 'Connecting…'}
          ok={state.ipcBridgeOk}
        />
        <StatusRow
          label="App Version"
          value={state.version ?? '…'}
          ok={state.version !== null}
        />
        <StatusRow
          label="IPC Ping"
          value={state.pingResult ?? '…'}
          ok={state.pingResult === 'pong'}
        />
        <StatusRow
          label="Platform"
          value={state.platform}
          ok={true}
        />
      </div>

      <div className="shell-security">
        <h2>Security Verification</h2>
        <SecurityCheckRow
          label="process (Node)"
          blocked={state.securityCheck.processUndefined}
        />
        <SecurityCheckRow
          label="require (Node)"
          blocked={state.securityCheck.requireUndefined}
        />
        <SecurityCheckRow
          label="module (Node)"
          blocked={state.securityCheck.moduleUndefined}
        />
        <div className={`security-overall ${allSecure ? 'secure' : 'warning'}`}>
          {allSecure
            ? '✓ Renderer isolation verified'
            : '⚠ Some Node APIs are accessible — check Electron security settings'}
        </div>
      </div>

      <div className="shell-footer">
        <p>Stage 2B — Secure Preload &amp; Typed IPC Contracts</p>
        <p>C3 features will be enabled in future stages</p>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className={`status-value ${ok ? 'ok' : 'pending'}`}>{value}</span>
    </div>
  );
}

function SecurityCheckRow({ label, blocked }: { label: string; blocked: boolean }) {
  return (
    <div className="security-row">
      <span className="security-label">{label}</span>
      <span className={`security-badge ${blocked ? 'blocked' : 'exposed'}`}>
        {blocked ? '✓ Blocked' : '✗ Exposed'}
      </span>
    </div>
  );
}
