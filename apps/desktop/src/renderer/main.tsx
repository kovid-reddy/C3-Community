/**
 * C3 Desktop Renderer — React entry point
 *
 * Security rules (enforced):
 *   - No direct Node.js API access (typeof process will be undefined/object without fs/child_process)
 *   - No direct ipcRenderer access — only window.c3Shell from preload bridge
 *   - No @c3/auth, @c3/cloud, @c3/hardware, @c3/provider etc. imports
 *   - UI communicates only through window.c3Shell
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[C3 Renderer] Root mount element #root not found in DOM.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
