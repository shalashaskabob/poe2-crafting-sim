// The Forge — Electron shell: lives in the system tray, pops the window on Ctrl+P.
const { app, BrowserWindow, Tray, Menu, globalShortcut, clipboard, shell, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let win = null;
let tray = null;
let isQuiting = false;
let alwaysOnTop = true;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 360,
    minHeight: 560,
    title: 'The Forge — PoE2 Crafting Bench',
    backgroundColor: '#0c0a08',
    show: false, // start hidden — the app lives in the tray
    alwaysOnTop: alwaysOnTop,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'forge-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // the X button hides back to the tray instead of quitting
  win.on('close', (e) => { if (!isQuiting) { e.preventDefault(); win.hide(); } });
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Send Ctrl+C to whatever window is in the foreground (the game), so the item
// under the cursor gets copied to the clipboard — no manual Ctrl+C needed.
function autoCopyForeground() {
  return new Promise((resolve) => {
    const ps = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')";
    const enc = Buffer.from(ps, 'utf16le').toString('base64');
    exec('powershell -NoProfile -NonInteractive -EncodedCommand ' + enc, { windowsHide: true }, () => resolve());
  });
}

// Global Ctrl+P: auto-copy the hovered item, read the clipboard, summon + import.
function summonAndImport() {
  // If our own window already has focus, just use what's on the clipboard.
  if (win && win.isVisible() && win.isFocused()) {
    win.webContents.send('cb-import', clipboard.readText());
    return;
  }
  // Otherwise the game is focused — copy the hovered item, then import.
  autoCopyForeground().then(() => {
    setTimeout(() => {
      const text = clipboard.readText();
      showWindow();
      win.webContents.send('cb-import', text);
    }, 140);
  });
}

function createTray() {
  let icon = nativeImage.createFromPath(path.join(__dirname, 'forge-icon.png'));
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('The Forge — press Ctrl+P to capture an item');
  const menu = Menu.buildFromTemplate([
    { label: 'Open The Forge', click: showWindow },
    { label: 'Capture item from clipboard  (Ctrl+P)', click: summonAndImport },
    { type: 'separator' },
    { label: 'Always on top', type: 'checkbox', checked: alwaysOnTop, click: (mi) => { alwaysOnTop = mi.checked; if (win) win.setAlwaysOnTop(alwaysOnTop); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuiting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    if (app.setAppUserModelId) app.setAppUserModelId('com.theforge.poe2');
    createWindow(); // hidden
    createTray();

    const okImport = globalShortcut.register('CommandOrControl+P', summonAndImport);
    if (!okImport) console.warn('[Forge] Ctrl+P could not be registered (another app may own it).');

    // Ctrl+Shift+P: toggle the overlay window show/hide
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (!win) { createWindow(); showWindow(); return; }
      if (win.isVisible() && win.isFocused()) win.hide(); else showWindow();
    });

    // Ctrl+Alt+T: toggle always-on-top
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      if (!win) return;
      alwaysOnTop = !alwaysOnTop;
      win.setAlwaysOnTop(alwaysOnTop);
    });
  });

  app.on('will-quit', () => { globalShortcut.unregisterAll(); });
  // keep running in the tray even when the window is hidden/closed
  app.on('window-all-closed', () => { /* no-op: tray keeps the app alive */ });
}
