// The Forge — EE2-style game overlay: a transparent, click-through window attached
// over Path of Exile 2 via `electron-overlay-window` (the same lib Exiled Exchange 2 uses).
//
// Behaviour:
//   - The overlay tracks the game window's bounds and floats above it.
//   - When the game has focus the overlay is click-through (input passes to the game).
//   - Ctrl+P  : auto-copies the hovered item, activates (makes interactive) the overlay,
//               and sends the clipboard text to the page (`cb-import`).
//   - Ctrl+Shift+P : toggle overlay interaction (activate <-> hand focus back to the game).
//   - Escape  : when the overlay is interactive, hand focus back to the game (click-through).
//   - Ctrl+Alt+T : toggle always-on-top (kept for parity with the old shell).
//   - Tray: Quit + manual capture.
//
// Notes:
//   - The overlay BrowserWindow must never be destroyed once attached (the native lib
//     can only be initialized once and the window must outlive the attach). The page is
//     hidden/shown by the lib, never closed.
const { app, BrowserWindow, Tray, Menu, globalShortcut, clipboard, shell, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { OverlayController, OVERLAY_WINDOW_OPTS } = require('electron-overlay-window');

// The exact window title of the game. PoE2 uses this title on Windows.
const GAME_TITLE = 'Path of Exile 2';

let win = null;
let tray = null;
let isQuiting = false;
let alwaysOnTop = true;
let attached = false; // becomes true once the overlay attaches to a running game

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    title: 'The Forge — PoE2 Crafting Bench',
    // OVERLAY_WINDOW_OPTS supplies: frame:false, transparent:true, show:false,
    // skipTaskbar, resizable, hasShadow, fullscreenable, (alwaysOnTop on mac).
    ...OVERLAY_WINDOW_OPTS,
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

  // The overlay must persist for the lifetime of the app — never let a close
  // destroy it (the native lib can only attach once). Just hand focus back.
  win.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      handBackToGame();
    }
  });

  // Forward overlay lifecycle to the tray tooltip so the user can tell if it attached.
  OverlayController.events.on('attach', () => {
    attached = true;
    if (tray) tray.setToolTip('The Forge — attached to PoE2. Ctrl+P to capture an item.');
  });
  OverlayController.events.on('detach', () => {
    attached = false;
    if (tray) tray.setToolTip('The Forge — waiting for Path of Exile 2…');
  });
}

// Make the overlay interactive: it accepts clicks/keyboard until focus returns to the game.
function activateOverlay() {
  if (!win) return;
  if (attached) {
    // The native lib already showed the overlay (showInactive) on attach/focus;
    // activateOverlay() makes it accept input and focuses it.
    OverlayController.activateOverlay();
    return;
  }
  // Not attached yet (game not running, or title mismatch). The lib only ever
  // calls showInactive() from its attach/focus handlers, so activateOverlay()
  // alone would just focus a still-hidden window. Show it ourselves so the
  // crafting bench is usable standalone, and accept input.
  win.setIgnoreMouseEvents(false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Hand focus (and click-through) back to the game window.
function handBackToGame() {
  if (!win) return;
  try {
    OverlayController.focusTarget();
  } catch {
    // focusTarget relies on the native target; if not attached yet, just ignore clicks.
    win.setIgnoreMouseEvents(true);
  }
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

// Push clipboard text to the page.
function sendImport(text) {
  if (win && !win.isDestroyed()) win.webContents.send('cb-import', text);
}

// Global Ctrl+P: auto-copy the hovered item, read the clipboard, activate the overlay + import.
function summonAndImport() {
  // If the overlay already has focus, just import what's on the clipboard.
  if (win && win.isFocused()) {
    sendImport(clipboard.readText());
    return;
  }
  // Otherwise the game is focused — copy the hovered item, then activate + import.
  autoCopyForeground().then(() => {
    setTimeout(() => {
      const text = clipboard.readText();
      activateOverlay();
      sendImport(text);
    }, 140);
  });
}

// Ctrl+Shift+P: toggle whether the overlay is interactive or click-through.
function toggleInteraction() {
  if (!win) return;
  if (win.isFocused()) handBackToGame();
  else activateOverlay();
}

function createTray() {
  let icon = nativeImage.createFromPath(path.join(__dirname, 'forge-icon.png'));
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('The Forge — waiting for Path of Exile 2…');
  const menu = Menu.buildFromTemplate([
    { label: 'Activate overlay (interactive)', click: activateOverlay },
    { label: 'Capture item from clipboard  (Ctrl+P)', click: summonAndImport },
    { type: 'separator' },
    { label: 'Always on top', type: 'checkbox', checked: alwaysOnTop, click: (mi) => { alwaysOnTop = mi.checked; if (win) win.setAlwaysOnTop(alwaysOnTop, 'screen-saver'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuiting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', activateOverlay);
  tray.on('double-click', activateOverlay);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', activateOverlay);

  app.whenReady().then(() => {
    if (app.setAppUserModelId) app.setAppUserModelId('com.theforge.poe2');
    createWindow();
    createTray();

    // Attach the overlay over the game. If the game isn't running yet the lib waits
    // for a window with this title to appear, then emits 'attach'.
    OverlayController.attachByTitle(win, GAME_TITLE);

    // Escape returns focus to the game (and click-through) while the overlay is interactive.
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        handBackToGame();
      }
    });

    const okImport = globalShortcut.register('CommandOrControl+P', summonAndImport);
    if (!okImport) console.warn('[Forge] Ctrl+P could not be registered (another app may own it).');

    // Ctrl+Shift+P: toggle overlay interaction (activate <-> hand back to game).
    globalShortcut.register('CommandOrControl+Shift+P', toggleInteraction);

    // Ctrl+Alt+T: toggle always-on-top.
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      if (!win) return;
      alwaysOnTop = !alwaysOnTop;
      win.setAlwaysOnTop(alwaysOnTop, 'screen-saver');
    });
  });

  app.on('will-quit', () => { globalShortcut.unregisterAll(); });
  // keep running in the tray / attached even when the overlay is hidden by the lib
  app.on('window-all-closed', () => { /* no-op: tray keeps the app alive */ });
}
