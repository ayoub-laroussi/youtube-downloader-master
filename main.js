const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
app.setAppUserModelId('com.ytdownloader.app');

const path = require('path');
const isDev = process.env.ELECTRON_IS_DEV === '1' || !app.isPackaged;

// ─── Deep Link Protocol Registration ────────────────────────────────────────
const PROTOCOL = 'ytdownloader';

if (process.defaultApp) {
  // Dev mode: pass the script path so Electron knows what to launch
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Production (packaged app)
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// ─── Single Instance Lock ────────────────────────────────────────────────────
// Prevent multiple windows when a deep link is clicked while app is running
let pendingDeepLinkUrl = null;

const gotTheLock = app.requestSingleInstanceLock();
console.log('gotTheLock:', gotTheLock);

if (!gotTheLock) {
  console.log('Quitting because we did not get the lock');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // On Windows, the deep link URL is passed as the last argument
    const deepLinkArg = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg);
    }
    // Focus the existing window
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ─── macOS Deep Link Handler ─────────────────────────────────────────────────
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (win && win.webContents) {
    handleDeepLink(url);
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    pendingDeepLinkUrl = url;
  }
});

// ─── Deep Link Handler ───────────────────────────────────────────────────────
function handleDeepLink(deepLinkUrl) {
  try {
    const parsed = new URL(deepLinkUrl);
    const videoUrl = parsed.searchParams.get('url');
    console.log('[DEEP LINK] Received:', deepLinkUrl);
    console.log('[DEEP LINK] Extracted video URL:', videoUrl);

    if (videoUrl && win && win.webContents) {
      const safeUrl = videoUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      win.webContents.executeJavaScript(`window.handleDeepLink("${safeUrl}")`);
    }
  } catch (err) {
    console.error('[DEEP LINK] Error parsing URL:', err.message);
  }
}



let win;

function createWindow(port) {
  win = new BrowserWindow({
    width: 800,
    height: 900,
    minWidth: 480,
    minHeight: 600,
    title: 'YT Downloader',
    icon: path.join(__dirname, 'public', 'img', 'youtube-downloader.ico'),
    backgroundColor: '#0a0a1a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'public', 'js', 'preload.js'),
    },
  });

  win.loadURL(`http://localhost:${port}`);

  // Once the page is fully loaded, check if we were launched via a deep link
  win.webContents.on('did-finish-load', () => {
    // Check if the app was launched with a deep link URL (first instance)
    const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg);
    }
    // Handle any pending deep link from second-instance that arrived before window was ready
    if (pendingDeepLinkUrl) {
      handleDeepLink(pendingDeepLinkUrl);
      pendingDeepLinkUrl = null;
    }
  });

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Start Express server and assign a dynamic free port
  const expressApp = require('./server.js');
  const server = expressApp.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    console.log('Server bound to dynamic port:', port);
    createWindow(port);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('select-folder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Choisir le dossier de téléchargement'
  });
  return result.filePaths[0] || null;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Port logic won't trigger cleanly here without storing it,
    // but on Windows window-all-closed quits the app anyway.
  }
});
