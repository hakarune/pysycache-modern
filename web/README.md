# PySyCache-Modern — web version

A standalone **HTML5 / vanilla-JS `<canvas>`** reimplementation of the five
PySyCache activities, meant to run in a browser (Chromebooks especially) and
install as a PWA. It is *not* the Python game compiled to WebAssembly — it is a
parallel port that shares the `../assets/` art and sound.

## Run it locally

```bash
node web/tools/build.mjs          # generate manifests + copy assets into web/assets/
node web/tools/dev-server.mjs     # serve at http://localhost:8000/
```

Open <http://localhost:8000/>. `?level=easy|medium|hard` picks the difficulty.

A build step is required because browsers can't read directories: the Python
game discovers themes/pictures with `Path.iterdir()`, so `build.mjs` ports those
discovery/filter rules (`src/games/*.py`) and emits a curated manifest.

## What `web/tools/build.mjs` produces

| file | contents |
| --- | --- |
| `js/constants.generated.js` | gameplay numbers scraped from `src/engine.py` + `src/games/*.py` (grid sizes, snap distance, double-click ms, …) — impossible to drift |
| `js/assets.generated.js` | curated, pre-grouped asset manifest per activity/theme |
| `js/sw-precache.generated.js` | flat file list + `CACHE_VERSION` for the service worker |
| `CREDITS.html` | concatenation of every theme's `credits.txt` / `copyright.html` |
| `assets/**` | copy of every referenced asset (git-ignored; regenerated in CI) |

Run `node web/tools/build.mjs --check` to fail if the committed generated files
are stale — CI does this.

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
  exposes `update(dt)` / `render(ctx)` / `handleEvent(ev)`. Activities never own
  a loop.
- All scene code works in virtual **800×600**; `engine.js` handles device pixel
  ratio and letter-boxing.
- The **puzzle** slices pieces from one offscreen board canvas at round start —
  no pre-cut piece files, same as `src/games/drag.py`.
- Requires a browser with module service workers (Chrome/Edge 91+, recent
  Firefox) for the offline/PWA behaviour; the game itself runs without it.
