const { app, BrowserWindow, shell } = require('electron');
app.setAppUserModelId('com.ytdownloader.app');
if (require('electron-squirrel-startup')) app.quit();
const path = require('path');
const isDev = require('electron-is-dev');

// Initialize auto-updater only in production mode
if (!isDev) {
  require('update-electron-app')({
    updateInterval: '1 hour' // Check for updates every hour
  });
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
    },
  });

  win.loadURL(`http://localhost:${port}`);

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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Port logic won't trigger cleanly here without storing it,
    // but on Windows window-all-closed quits the app anyway.
  }
});
