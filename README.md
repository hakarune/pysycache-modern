# PySyCache-Modern

A **Python 3 / [pygame-ce](https://pyga.me/)** port of
[**PySyCache**](https://sources.debian.org/src/pysycache/) — the classic
mouse-training suite for young children (originally by Vincent Deroo, 2005–2007,
GPL-2.0-or-later).

The goal is to keep the gentle, picture-driven activities of the original while
running on a current Python stack: no Python 2, no legacy pygame 1.x, a resizable
window with proper scaling, and a clean, importable code base.

## Activities

| Activity        | Skill taught            | How to win a round                                   |
| --------------- | ----------------------- | --------------------------------------------------- |
| **Move**        | moving the pointer      | sweep the mouse over every tile to uncover the picture |
| **Click**       | single click            | single-click each themed picture until the board is clear |
| **Double-Click**| double click            | double-click each picture to collect it             |
| **Drag**        | drag & drop (the "puzzle")| drag every piece back into its slot               |
| **Buttons**     | pressing buttons        | click each button once to press it                  |

All activities read their artwork from themed folders under `assets/` (animals,
food, sky, sea, dinosaurs, cartoons, …), the same content shipped with the
original PySyCache.

## Installation

Requires **Python ≥ 3.10**.

```bash
git clone https://github.com/hakarune/pysycache-modern.git
cd pysycache-modern

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -e .                   # installs pygame-ce and the console script
```

Then launch it with either:

```bash
pysycache-modern                   # console script (from the install)
python -m src.main                 # run straight from a checkout
```

### Command-line options

| Option                       | Effect                                        |
| ---------------------------- | --------------------------------------------- |
| `--fullscreen` / `--windowed`| start full-screen, or in an 800×600 window (default) |
| `--no-sound`                 | disable the audio mixer                       |
| `--level {easy,medium,hard}` | difficulty for every activity (default `medium`) |

## Controls

The whole point is to use the mouse — the keyboard only has a few helpers.

| Input                         | Action                                             |
| ----------------------------- | ------------------------------------------------- |
| **Mouse move**                | Move activity: uncover tiles; everywhere: aim     |
| **Left click**                | menu: choose an activity / button; in-game: click a target or grab a piece |
| **Left double-click**         | Double-Click activity: collect a target           |
| **Left drag** (hold + move)   | Drag activity: carry a puzzle piece               |
| **Esc**                       | in an activity: back to the menu; in the menu: quit |
| **Tab**                       | in an activity: switch to the next theme           |
| **F11**                       | toggle full-screen                                 |

The hardware cursor is hidden; a hand-shaped picture cursor is drawn instead,
just like the original.

## Dependencies

**Runtime**

- Python ≥ 3.10
- [`pygame-ce`](https://pypi.org/project/pygame-ce/) ≥ 2.4 (the community
  edition of pygame; provides `import pygame`)

Installed automatically by `pip install -e .` (see `pyproject.toml`).

**Development (optional)**

```bash
pip install -e ".[dev]"            # pytest, ruff
```

**System packages** (for the `.deb`): `python3`, and
`python3-pygame` **or** `python3-pygame-ce`.

## Building

### A wheel / sdist

```bash
pip install build
python -m build                    # writes dist/*.whl and dist/*.tar.gz
```

### A standalone Debian package

`build-deb.sh` stages a file tree and calls `dpkg-deb` directly — it does **not**
need debhelper or a Debian source package.

```bash
./build-deb.sh                     # version taken from pyproject.toml
./build-deb.sh 0.2.0               # or pass one explicitly
```

Output: `build/deb/out/pysycache-modern_<version>_all.deb`, which installs

- the game to `/usr/share/pysycache-modern`
- a launcher at `/usr/games/pysycache-modern`
- a menu entry at `/usr/share/applications/pysycache-modern.desktop`

Install it with `sudo apt install ./build/deb/out/pysycache-modern_*.deb`.

### Web (WebAssembly) build

The game loop is a coroutine, so [`pygbag`](https://pygame-web.github.io/) can
compile the whole thing to WebAssembly and run it in a browser — handy for
trying it on a phone or tablet with no install.

```bash
pip install -e ".[web]"
python -m pygbag main.py            # serves http://localhost:8000
python -m pygbag --build main.py    # just write build/web/
```

The `.github/workflows/web.yml` action builds this on every push to `main` and
publishes it to GitHub Pages (enable *Settings → Pages → Source: GitHub
Actions* once); the playable URL is then `https://<owner>.github.io/<repo>/`.

### Android APK

`buildozer.spec` drives a [Buildozer](https://buildozer.readthedocs.io/) /
python-for-android packaging run.

```bash
pip install buildozer
buildozer android debug            # writes bin/*.apk
```

`.github/workflows/android.yml` produces a downloadable debug-APK artifact; it
is **not** run on every push (a cold build is ~30 min) — start it from the
Actions tab.

The web and Android builds are entirely separate from the wheel and the `.deb`:
`build-deb.sh` only packages `src/`, `assets/`, `pyproject.toml`, `README.md`
and `LICENSE`.

### Releases

Pushing a `v*` tag (e.g. `git tag v0.1.0 && git push --tags`) runs
`.github/workflows/release.yml`, which builds the wheel + sdist, the `.deb`, a
zipped web build and a best-effort debug APK, then publishes them all on a
GitHub Release with generated notes. Keep the tag in step with `version` in
`pyproject.toml` and `buildozer.spec`.

### Tests

```bash
pip install -e ".[dev]"
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy pytest
```

A headless smoke test boots the engine and drives every activity for a couple
hundred frames — no display or audio needed. It runs on Python 3.10 and 3.12 in
`.github/workflows/ci.yml`.

## Project layout

```
assets/                  image, sound and theme files (copied from upstream PySyCache)
src/
├── __init__.py
├── main.py              main menu + activity dispatcher; sync main() + async_main()
├── engine.py            window management, asset loading, 800×600 virtual scaling
└── games/
    ├── base.py          shared async Activity loop, theme discovery, scoring
    ├── targets.py       shared Click / Double-Click implementation
    ├── move.py          Move activity
    ├── click.py         Click activity
    ├── dblclick.py      Double-Click activity
    ├── drag.py          Drag activity (the "puzzle")
    └── buttons.py       Buttons activity
tests/test_smoke.py      headless engine + activity smoke test
main.py                  root entry point for the pygbag (web) and Buildozer (APK) builds
build-deb.sh             standalone .deb builder (packages src/ + assets/ only)
buildozer.spec           Android APK config (Buildozer / python-for-android)
.github/workflows/       ci.yml (smoke test) · web.yml (pygbag → Pages) · android.yml (APK) · release.yml (tag → GitHub Release)
pyproject.toml           packaging + dependencies
LICENSE                  GPL-2.0
```

To refresh the vendored assets from the original source:

```bash
mkdir -p legacy-sources && cd legacy-sources
curl -L -o pysycache_3.1.orig.tar.gz \
  https://snapshot.debian.org/file/2b7bf712baef4dc52a07980c59d8bbff213da2e2
mkdir -p pysycache-legacy
tar xzf pysycache_3.1.orig.tar.gz -C pysycache-legacy --strip-components=1
# then copy pysycache-legacy/pysycache/{images,sounds,fonts,themes-*} into ../assets/
```

`legacy-sources/` is git-ignored; it is only a local reference copy.

## License

GPL-2.0-or-later, matching the original PySyCache. See [`LICENSE`](LICENSE).
Game artwork and sounds are the original PySyCache theme content and carry their
own per-theme `credits.txt` / `copyright.html` files inside each theme folder.

## Credits

- Original **PySyCache** — Vincent Deroo and contributors
  (<https://sources.debian.org/src/pysycache/>).
- This port — PySyCache-Modern contributors.
