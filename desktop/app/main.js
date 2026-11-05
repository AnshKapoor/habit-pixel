// Habit Pixel desktop: an Electron window around the Expo web build in ./web
// (made by `npm run desktop:web`). Nothing else from the project is bundled.
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WEB_ROOT = path.join(__dirname, 'web');
const ORIGIN = 'app://habit-pixel';

// Serve the web build from app://habit-pixel/ instead of file://, so its absolute asset paths
// (/_expo/static/...) resolve and the page gets a stable origin for saved habits (localStorage).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function serve(request) {
  const { pathname } = new URL(request.url);
  let file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(pathname)));
  if (file !== WEB_ROOT && !file.startsWith(WEB_ROOT + path.sep)) {
    return new Response('Not found', { status: 404 });
  }
  // Single-page app: unknown paths get index.html.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html');
  return net.fetch(pathToFileURL(file).toString());
}

function isExternal(url) {
  return /^(https?|mailto):/i.test(url) && !url.startsWith(ORIGIN);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    title: 'Habit Pixel',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#FFFFFF',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });

  // Links such as the Supabase dashboard open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(`${ORIGIN}/`);
}

// One window only: launching again focuses the running app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle('app', serve);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
