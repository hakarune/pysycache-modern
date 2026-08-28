# PySyCache-Modern — web version

A standalone **HTML5 / vanilla-JS `<canvas>`** reimplementation of the five
PySyCache activities. Not the Python game compiled to WebAssembly — a parallel
port that shares the `../assets/` art and sound, installable as a PWA.

**Live:** <https://hakarune.github.io/pysycache-modern/>
(`?level=easy|medium|hard` picks the difficulty).

Gameplay is entirely pointer/touch driven, so it works on phones and tablets;
each activity also shows on-screen **← Menu** / **Theme ↻** buttons for devices
with no keyboard.

## Run it locally

```bash
node web/tools/build.mjs        # generate manifests + copy assets into web/assets/
node web/tools/dev-server.mjs   # serve at http://localhost:8000/
```

It **must be served over HTTP** — opening `web/index.html` directly
(`file://`, e.g. from a file manager) makes the browser refuse to load the
ES-module entrypoint, and the page hangs on "Loading…". A watchdog in
`index.html` detects that case and shows an explanation.

The build step exists because browsers can't read directories: the Python game
discovers themes with `Path.iterdir()`, so `build.mjs` ports those
discovery/filter rules (`src/games/*.py`) into a curated manifest.

## `web/tools/build.mjs`

| generated file | contents |
| --- | --- |
| `js/constants.generated.js` | gameplay numbers scraped from `src/engine.py` + `src/games/*.py` — can't drift |
| `js/assets.generated.js` | pre-grouped asset manifest per activity/theme |
| `js/sw-precache.generated.js` | file list + `CACHE_VERSION` for the service worker (also hashes the JS/CSS/HTML so a code change busts the PWA cache) |
| `CREDITS.html` | every theme's `credits.txt` / `copyright.html`, concatenated |
| `assets/**` | copy of every referenced asset (git-ignored; rebuilt in CI) |

`node web/tools/build.mjs --check` fails if the committed generated files are
stale or the manifest points at a missing asset — CI runs it. The asset copy
compares by size only; if you edit a file in `../assets/` in place, `rm -rf
web/assets` first.

### Deliberate differences from the Python discovery rules

`build.mjs` mirrors `theme_images()` and the per-game filters, but on purpose
does **not** ship the `-on` / `-off` / `-selected` sprite state variants (the
web game draws one image per target), nor treat `.jpeg` / `.jpg` files in
`themes-click` / `themes-dblclick` as targets (those are full background
photos, not cut-outs — the Python game happens to pick them up). Don't "fix"
`build.mjs` to match Python on these.

## Layout

```
web/
├── index.html  style.css  manifest.webmanifest  sw.js
├── icons/                      PWA icons (committed)
├── js/
│   ├── main.js                 boot + menu + the single rAF loop
│   ├── engine.js               canvas/DPR, virtual coords, assets, input, audio
│   ├── *.generated.js          committed build output
│   └── games/{index,base,move,targets,click,dblclick,drag,buttons}.js
└── tools/{build,dev-server}.mjs
```

## Notes

- One `requestAnimationFrame` loop in `main.js`; a scene (`menu` or an activity)
  exposes `update(dt)` / `render(ctx)` / `handleEvent(ev)` and never owns a loop.
- All scene code works in a virtual **800×600** space; `engine.js` handles
  device pixel ratio and letter-boxing.
- The **puzzle** slices pieces from one offscreen board canvas at round start —
  no pre-cut piece files, same as `src/games/drag.py`.
- Offline/PWA behaviour needs a browser with module service workers
  (Chrome/Edge 91+, recent Firefox); the game itself runs without it.
