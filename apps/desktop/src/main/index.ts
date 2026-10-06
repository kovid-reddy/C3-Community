/**
 * C3 Desktop Shell — Main Process
 *
 * Security configuration:
 *   - contextIsolation: true  — renderer runs in isolated JS context; no direct access to Node APIs
 *   - nodeIntegration: false  — renderer cannot call require() or access Node modules
 *   - sandbox: true           — renderer process is OS-sandboxed (Chromium sandbox)
 *   - No remote module        — Electron remote module is not enabled
 *   - CSP enforced via meta tag in renderer HTML
 *
 * The main process contains NO C3 business logic.
 * All future services are injected at Stage 2B+.
 */

import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { StructuredLogger } from '@c3/foundation';
import { AppError, normalizeError } from '@c3/foundation';
import { BaseLifecycle } from '@c3/foundation';
import { registerShellIpcHandlers, unregisterShellIpcHandlers } from './ipc-handlers';

const isDev = !app.isPackaged;

const logger = new StructuredLogger({
  module: 'main',
  minLevel: isDev ? 'debug' : 'info',
  jsonFormat: !isDev,
});

// ── Window reference ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

// ── Window factory ───────────────────────────────────────────────────────────

function getPreloadPath(): string {
  // vite-plugin-electron writes the compiled preload next to main output
  return path.join(__dirname, '../preload/index.js');
}

function getRendererUrl(): string {
  if (isDev) {
    // Development: Vite dev server URL (set by vite-plugin-electron via VITE_DEV_SERVER_URL)
    return process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173';
  }
  // Production: load built renderer HTML file from dist-renderer
  return path.join(__dirname, '../../dist-renderer/index.html');
}

function createMainWindow(): BrowserWindow {
  const preloadPath = getPreloadPath();

  logger.debug('Creating BrowserWindow', {
    metadata: {
      isDev,
      preloadPath,
    },
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'C3 — Community Compute Cloud',
    show: false,  // shown after ready-to-show to avoid flash
    backgroundColor: '#0d0d0f',
    webPreferences: {
      // ── Security settings (MUST NOT be weakened) ─────────────────────────
      contextIsolation: true,        // Isolates renderer from preload and Node
      nodeIntegration: false,        // Renderer cannot access Node.js APIs
      sandbox: true,                 // OS-level Chromium sandbox
      webSecurity: true,             // Enforces same-origin policy
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // ── Preload bridge ───────────────────────────────────────────────────
      preload: preloadPath,
    },
  });

  // Prevent navigation to arbitrary URLs — only allow our known origin
  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = getRendererUrl();
    const isLocalFile = url.startsWith('file://');
    const isDevServer = isDev && url.startsWith('http://localhost');
    if (!isLocalFile && !isDevServer) {
      logger.warn('Blocked navigation to external URL', { metadata: { url } });
      event.preventDefault();
    }
  });

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Show window after renderer is ready — avoids blank flash
  win.once('ready-to-show', () => {
    win.show();
    logger.info('Window ready and visible');
  });

  win.on('closed', () => {
    logger.debug('Window closed');
    mainWindow = null;
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Renderer process gone', {
      metadata: { reason: details.reason, exitCode: details.exitCode },
    });
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('Renderer failed to load', {
      metadata: { errorCode, errorDescription, url: validatedURL },
    });
  });

  return win;
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  const target = getRendererUrl();
  logger.info('Loading renderer', { metadata: { isDev, target } });

  if (isDev) {
    await win.loadURL(target);
    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    await win.loadFile(target);
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

const appLifecycle = new BaseLifecycle({
  onStart: async () => {
    logger.info('C3 Desktop starting', {
      metadata: {
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        platform: process.platform,
        isDev,
      },
    });

    registerShellIpcHandlers(logger);
    mainWindow = createMainWindow();

    try {
      await loadRenderer(mainWindow);
    } catch (err) {
      const appErr = normalizeError(err);
      logger.error('Failed to load renderer', {
        metadata: { code: appErr.code, message: appErr.message },
      });
      throw appErr;
    }

    logger.info('C3 Desktop started successfully');
  },

  onStop: async () => {
    logger.info('C3 Desktop shutting down');
    unregisterShellIpcHandlers();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    mainWindow = null;
  },

  onCleanup: async () => {
    logger.debug('Cleanup complete');
  },
});

// ── Electron app event wiring ─────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await appLifecycle.start();
  } catch (err) {
    const appErr = normalizeError(err);
    logger.error('Fatal startup error', {
      metadata: { code: appErr.code, message: appErr.message },
    });
    app.exit(1);
  }

  app.on('activate', () => {
    // macOS: re-create the window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        mainWindow = createMainWindow();
        void loadRenderer(mainWindow);
      } catch (err) {
        logger.error('Failed to recreate window', {
          metadata: { error: String(err) },
        });
      }
    }
  });
});

app.on('window-all-closed', () => {
  void appLifecycle.stop().finally(() => {
    // On macOS it's conventional to stay open until explicit Cmd+Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

app.on('before-quit', () => {
  logger.info('Application quitting');
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Another instance is already running — exiting');
  app.exit(0);
} else {
  app.on('second-instance', () => {
    // Focus the existing window if a second instance is launched
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Global uncaught exception guard — log before crashing
process.on('uncaughtException', (err) => {
  const appErr = err instanceof AppError ? err : normalizeError(err);
  logger.error('Uncaught exception in main process', {
    metadata: { code: appErr.code, message: appErr.message },
  });
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const appErr = normalizeError(reason);
  logger.error('Unhandled promise rejection in main process', {
    metadata: { code: appErr.code, message: appErr.message },
  });
});
