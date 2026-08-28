# PySyCache-Modern

A **Python 3 / [pygame-ce](https://pyga.me/)** port of
[**PySyCache**](https://sources.debian.org/src/pysycache/) — the classic
mouse-training suite for young children (Vincent Deroo, 2005–2007,
GPL-2.0-or-later).

It keeps the gentle, picture-driven activities of the original but runs on a
current stack: no Python 2, no pygame 1.x, a resizable window with proper
scaling, and a clean importable code base. A separate
**[browser version](web/README.md)** (vanilla JS `<canvas>`, no Python) is
live at **<https://hakarune.github.io/pysycache-modern/>**.

## Activities

| Activity         | Skill              | Win a round by…                                  |
| ---------------- | ------------------ | ----------------------------------------------- |
| **Move**         | moving the pointer | sweeping the mouse over every tile to uncover a picture |
| **Click**        | single click       | single-clicking each themed picture until the board is clear |
| **Double-Click** | double click       | double-clicking each picture to collect it      |
| **Drag**         | drag & drop        | dragging every puzzle piece back into its slot  |
| **Buttons**      | pressing buttons   | clicking each button once                        |

Artwork comes from themed folders under `assets/` (animals, food, sky, sea,
dinosaurs, cartoons, …) — the same content shipped with the original.

## Install & run

Requires **Python ≥ 3.10**.

```bash
git clone https://github.com/hakarune/pysycache-modern.git
cd pysycache-modern
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .                                     # pulls in pygame-ce

pysycache-modern            # console script
python -m src.main          # or straight from the checkout
```

Options: `--fullscreen` / `--windowed` (default is an 800×600 window),
`--no-sound`, `--level {easy,medium,hard}` (default `medium`).

### On Android (Termux)

The Python game renders on the device screen through
[Termux:X11](https://github.com/termux/termux-x11):

```bash
pkg install tur-repo && pkg install python-pygame termux-x11-nightly xorg-xdpyinfo
# also install the Termux:X11 companion app from its GitHub "nightly" release
./run-android.sh           # starts the X server, opens the app, runs the game
```

Touch acts as the mouse. For a zero-install option, open the
[web version](https://hakarune.github.io/pysycache-modern/) in the Android
browser instead.

## Controls

The point is to use the mouse; the keyboard only has a few helpers.

| Input                       | Action                                                  |
| --------------------------- | ------------------------------------------------------ |
| Mouse move                  | Move activity: uncover tiles; elsewhere: aim           |
| Left click                  | menu: pick an activity; in-game: hit a target or grab a piece |
| Left double-click           | Double-Click activity: collect a target                |
| Left drag                   | Drag activity: carry a puzzle piece                    |
| **Esc**                     | activity → menu; menu → quit                           |
| **Tab**                     | activity: next theme                                    |
| **F11**                     | toggle full-screen                                      |

The hardware cursor is hidden and a hand-shaped picture cursor drawn instead,
as in the original. The **web version** additionally shows on-screen
**← Menu** / **Theme ↻** buttons, since phones and tablets have no keyboard.

## Building

```bash
pip install build && python -m build          # wheel + sdist in dist/
./build-deb.sh [VERSION]                       # standalone .deb (needs only dpkg-deb)
```

`build-deb.sh` stages `src/` + `assets/` and calls `dpkg-deb` directly (no
debhelper). Output: `build/deb/out/pysycache-modern_<version>_all.deb`,
installing the game to `/usr/share/pysycache-modern`, a launcher at
`/usr/games/pysycache-modern`, and a `.desktop` entry. Install with
`sudo apt install ./build/deb/out/pysycache-modern_*.deb`.

**Releases** (`.github/workflows/release.yml`): every push to `main` refreshes a
rolling **`rolling`** pre-release (alpha, `X.Y.Z~alpha<n>.<sha>`); pushing a
`v*` tag cuts a stable release named after the tag. Keep the tag in step with
`version` in `pyproject.toml`.

**Tests**:

```bash
pip install -e ".[dev]"
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy pytest
```

A headless smoke test boots the engine and drives every activity for a few
hundred frames — no display or audio. CI runs it on Python 3.10 and 3.12.

## Project layout

```
assets/            image / sound / theme files, vendored from upstream PySyCache
src/
├── main.py        main menu + activity dispatcher (entry point)
├── engine.py      window, asset loading, 800×600 virtual scaling
└── games/         base.py (shared loop) + move/click/dblclick/drag/buttons + targets.py
web/               standalone browser port — see web/README.md
tests/             headless smoke test
build-deb.sh       standalone .deb builder
run-android.sh     Termux:X11 launcher
```

To re-vendor the upstream assets, download the Debian source tarball for
`pysycache` (see `pyproject.toml` → *Legacy upstream*) and copy its
`pysycache/{images,sounds,fonts,themes-*}` into `assets/`. The Drag activity
slices puzzle pieces at runtime, so the upstream `themes-puzzle/<theme>/{0,1,2}/`
pre-cut pieces and `.dfg` layout files are not needed — copy only the full
pictures plus each theme's `credits.txt` / `copyright.html`.

## License

GPL-2.0-or-later, matching the original PySyCache — see [`LICENSE`](LICENSE).
Artwork and sounds are the original PySyCache theme content and carry their own
per-theme `credits.txt` / `copyright.html`.

## Credits

- Original **PySyCache** — Vincent Deroo and contributors.
- This port — PySyCache-Modern contributors.
