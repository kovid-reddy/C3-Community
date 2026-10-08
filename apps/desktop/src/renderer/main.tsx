/**
 * C3 Desktop Renderer — React Entry Point (main.tsx)
 *
 * Bootstraps the React 18 application onto the DOM root node.
 * Security enforcement:
 *   - No direct Node.js API access (window.process, window.require, window.module strictly blocked)
 *   - No direct electron / ipcRenderer imports
 *   - Renderer accesses desktop capabilities ONLY through window.c3Shell
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[C3 Renderer] Critical initialization error: Root mount element #root not found in DOM.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
