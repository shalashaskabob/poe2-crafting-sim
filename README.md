# The Forge — PoE2 Crafting Bench (desktop)

A Path of Exile 2 crafting sandbox running on **real datamined modifier weights**, now wrapped as a
desktop overlay (like Sidekick / Awakened PoE Trade) with a **global hotkey** that imports the item
on your clipboard.

## Run it (development)

You need [Node.js](https://nodejs.org) (already installed: v22).

```sh
npm install      # once — downloads Electron (~100 MB)
npm start        # launches the app
```

Or just double-click **`start.bat`**.

## Global hotkeys (work even while PoE2 is focused)

| Hotkey | What it does |
|---|---|
| **Ctrl + P** | Auto-copies the item under your cursor (sends Ctrl+C to the game for you), then summons the window and benches it. **One key — no manual Ctrl+C.** |
| **Ctrl + Shift + P** | Show / hide the overlay window. |
| **Ctrl + Alt + T** | Toggle always-on-top. |

So the loop is: hover an item in PoE2 → **Ctrl+P** → it's on the bench with the coach, planner, and live odds.

The app runs in the **system tray**; closing the window hides it back to the tray (right-click the tray icon → Quit to exit).

> Note: **Ctrl+P** is registered *globally* while the app runs, so it won't trigger "print" in other
> apps until you close The Forge (or hide it with Ctrl+Shift+P).

## What's inside

- **Crafting sim** — every prefix/suffix, tier, item-level gate and spawn weight from `repoe-fork/poe2`
  (build 4.5.3.1.4), 0.5 mechanics. Currency, omens, essences, desecration — all with live roll odds.
- **Jewels** — Ruby / Emerald / Sapphire / Diamond with their real mod pools.
- **Item import** — paste or Ctrl+P a copied item; it's parsed and matched to the real mods.
- **Inventory** — imported items persist; click to bench them.
- **Coach** — next-step suggestions for the selected item.
- **Goal planner** — pick target mods, see per-slam odds and a crafting path.

It also still runs as a plain web page — open `poe2-crafting-simulator-1.html` in a browser
(the in-app **+ Import item** button works there; the *global* hotkey only exists in the desktop app).

## Build a standalone .exe (optional)

```sh
npm run dist     # downloads electron-builder bits, outputs a portable .exe in dist/
```

## Files

| File | Role |
|---|---|
| `poe2-crafting-simulator-1.html` | the whole app (self-contained: data + icons + UI logic inlined) |
| `feature.js` | source for the import/inventory/coach/planner layer (inlined into the HTML) |
| `main.js` | Electron main process — window, global hotkeys, native clipboard |
| `preload.js` | secure bridge that hands clipboard text to the page |
| `package.json` | npm scripts + Electron config |
