"""Window management, asset loading and virtual-resolution scaling.

The original PySyCache was written for a fixed 800x600 display.  This module keeps
that virtual resolution: every scene draws onto :attr:`Engine.surface` (an 800x600
``pygame.Surface``) and the engine takes care of scaling that surface up to the
real, resizable window while preserving the aspect ratio (letter-boxing the
remainder).  Mouse coordinates coming back from :meth:`Engine.get_events` and
:meth:`Engine.mouse_pos` are translated back into that 800x600 space so game code
never has to think about the window size.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pygame

#: Running inside pygbag's WebAssembly runtime (browser) rather than on a desktop.
IS_WEB = sys.platform == "emscripten"

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = PROJECT_ROOT / "assets"

# The fixed "logical" resolution every scene is authored against.
VIRTUAL_WIDTH = 800
VIRTUAL_HEIGHT = 600
VIRTUAL_SIZE = (VIRTUAL_WIDTH, VIRTUAL_HEIGHT)

DEFAULT_FPS = 60

# Legacy sound-effect / music file names live under assets/sounds.
SOUNDS_SUBDIR = "sounds"
IMAGES_SUBDIR = "images"
FONTS_SUBDIR = "fonts"
DEFAULT_FONT = "FreeSansBold.ttf"


class Engine:
    """Owns the pygame window, the mixer and the asset caches."""

    def __init__(self, caption: str = "PySyCache-Modern", *, fullscreen: bool = False,
                 sound: bool = True, fps: int = DEFAULT_FPS) -> None:
        os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

        self.sound_enabled = sound
        if sound:
            # Match the legacy mixer settings before pygame.init().
            try:
                pygame.mixer.pre_init(44100, -16, 2, 2048)
            except pygame.error:
                self.sound_enabled = False

        pygame.init()
        if not pygame.mixer.get_init():
            self.sound_enabled = False

        pygame.display.set_caption(caption)
        self._set_window_icon()

        self.fps = fps
        self.clock = pygame.time.Clock()

        # Open the real window first: Surface.convert() needs a live display mode
        # (the headless "dummy" SDL driver enforces this; some real drivers are
        # more forgiving).
        self._fullscreen = fullscreen
        self._window = self._create_window(fullscreen)

        # The logical draw target.  Scenes never touch the real display surface.
        self.surface = pygame.Surface(VIRTUAL_SIZE).convert()

        # Blit rectangle of the scaled virtual surface inside the real window.
        self._blit_rect = pygame.Rect(0, 0, *VIRTUAL_SIZE)
        self._recompute_layout()

        # Asset caches keyed by resolved absolute path.
        self._image_cache: dict[str, pygame.Surface] = {}
        self._sound_cache: dict[str, pygame.mixer.Sound] = {}
        self._font_cache: dict[tuple[str, int], pygame.font.Font] = {}

        # Custom hardware cursor is hidden; scenes draw a picture cursor instead.
        pygame.mouse.set_visible(False)
        self._cursor_image: pygame.Surface | None = None
        self._cursor_hotspot = (0, 0)
        self.set_cursor_image("souris.png")

        self.running = True

    # ------------------------------------------------------------------
    # Window management
    # ------------------------------------------------------------------
    def _create_window(self, fullscreen: bool) -> pygame.Surface:
        if IS_WEB:
            # In the browser: plain 800x600 surface, no flags.  pygbag's HTML
            # canvas scales itself to the viewport via CSS, and mouse events
            # already arrive in this coordinate space.  SCALED / RESIZABLE both
            # misbehave under pygbag's wasm SDL, so don't use them and don't do
            # our own letter-boxing (see _recompute_layout / present).
            return pygame.display.set_mode(VIRTUAL_SIZE)
        if fullscreen:
            return pygame.display.set_mode((0, 0), pygame.FULLSCREEN | pygame.SCALED)
        return pygame.display.set_mode(VIRTUAL_SIZE, pygame.RESIZABLE)

    def _set_window_icon(self) -> None:
        icon_path = ASSETS_DIR / IMAGES_SUBDIR / "pysycache-32x32.png"
        if icon_path.is_file():
            try:
                pygame.display.set_icon(pygame.image.load(str(icon_path)))
            except pygame.error:
                pass

    def toggle_fullscreen(self) -> None:
        if IS_WEB:
            return  # the browser owns the canvas size
        self._fullscreen = not self._fullscreen
        self._window = self._create_window(self._fullscreen)
        self._recompute_layout()

    def _recompute_layout(self) -> None:
        """Fit the 800x600 virtual surface into the current window, centred."""
        if IS_WEB:
            # The window surface is already 800x600; draw straight onto it.
            self._blit_rect = pygame.Rect(0, 0, *VIRTUAL_SIZE)
            return
        win_w, win_h = self._window.get_size()
        scale = min(win_w / VIRTUAL_WIDTH, win_h / VIRTUAL_HEIGHT)
        scaled_w = max(1, int(VIRTUAL_WIDTH * scale))
        scaled_h = max(1, int(VIRTUAL_HEIGHT * scale))
        self._blit_rect = pygame.Rect(
            (win_w - scaled_w) // 2,
            (win_h - scaled_h) // 2,
            scaled_w,
            scaled_h,
        )

    # ------------------------------------------------------------------
    # Coordinate translation
    # ------------------------------------------------------------------
    def to_virtual(self, pos: tuple[int, int]) -> tuple[int, int]:
        """Map a real window position to 800x600 space (clamped to the play area)."""
        x, y = pos
        rel_x = (x - self._blit_rect.x) / max(1, self._blit_rect.width)
        rel_y = (y - self._blit_rect.y) / max(1, self._blit_rect.height)
        vx = int(min(1.0, max(0.0, rel_x)) * VIRTUAL_WIDTH)
        vy = int(min(1.0, max(0.0, rel_y)) * VIRTUAL_HEIGHT)
        return vx, vy

    def mouse_pos(self) -> tuple[int, int]:
        return self.to_virtual(pygame.mouse.get_pos())

    # ------------------------------------------------------------------
    # Event pump
    # ------------------------------------------------------------------
    def get_events(self) -> list[pygame.event.Event]:
        """Return this frame's events with mouse positions translated in place.

        ``QUIT`` and ``Alt+F4`` set :attr:`running` to ``False``.  ``F11`` toggles
        fullscreen.  Every mouse event gains a ``virtual_pos`` attribute and its
        ``pos`` is rewritten to virtual coordinates so scenes can use it directly.
        """
        events = []
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.VIDEORESIZE:
                self._window = pygame.display.get_surface() or self._window
                self._recompute_layout()
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_F11:
                self.toggle_fullscreen()
                continue
            elif event.type in (
                pygame.MOUSEMOTION,
                pygame.MOUSEBUTTONDOWN,
                pygame.MOUSEBUTTONUP,
            ):
                vpos = self.to_virtual(event.pos)
                setattr(event, "virtual_pos", vpos)
                setattr(event, "pos", vpos)
            events.append(event)
        return events

    # ------------------------------------------------------------------
    # Frame presentation
    # ------------------------------------------------------------------
    def present(self, *, draw_cursor: bool = True) -> None:
        """Scale the virtual surface into the window and flip the display."""
        if draw_cursor and self._cursor_image is not None:
            frame = self.surface.copy()
            mx, my = self.mouse_pos()
            frame.blit(
                self._cursor_image,
                (mx - self._cursor_hotspot[0], my - self._cursor_hotspot[1]),
            )
        else:
            frame = self.surface

        self._window.fill((0, 0, 0))
        if self._blit_rect.size == VIRTUAL_SIZE:
            self._window.blit(frame, self._blit_rect)
        else:
            pygame.transform.smoothscale(frame, self._blit_rect.size, self._window.subsurface(self._blit_rect))
        pygame.display.flip()

    def tick(self) -> float:
        """Advance the clock; return the elapsed seconds since the last tick."""
        return self.clock.tick(self.fps) / 1000.0

    # ------------------------------------------------------------------
    # Cursor
    # ------------------------------------------------------------------
    def set_cursor_image(self, name: str | None, hotspot: tuple[int, int] = (0, 0)) -> None:
        if name is None:
            self._cursor_image = None
            return
        try:
            self._cursor_image = self.load_image(IMAGES_SUBDIR, name)
            self._cursor_hotspot = hotspot
        except FileNotFoundError:
            self._cursor_image = None

    # ------------------------------------------------------------------
    # Asset loading
    # ------------------------------------------------------------------
    def _resolve(self, *parts: str) -> Path:
        path = ASSETS_DIR.joinpath(*parts)
        if not path.is_file():
            raise FileNotFoundError(f"asset not found: {path}")
        return path

    def load_image(self, *parts: str, alpha: bool = True) -> pygame.Surface:
        """Load (and cache) an image from ``assets/``.

        ``parts`` are path components below ``assets/`` -- e.g.
        ``load_image("images", "fond-menu.png")`` or
        ``load_image("themes-move", "animals", "logo.png")``.
        """
        path = self._resolve(*parts)
        key = str(path)
        cached = self._image_cache.get(key)
        if cached is not None:
            return cached

        image = pygame.image.load(key)
        image = image.convert_alpha() if alpha else image.convert()
        self._image_cache[key] = image
        return image

    def load_image_scaled(self, size: tuple[int, int], *parts: str,
                          alpha: bool = True) -> pygame.Surface:
        """Like :meth:`load_image` but smooth-scaled to ``size`` (cached per size)."""
        base = self.load_image(*parts, alpha=alpha)
        key = str(self._resolve(*parts)) + f"@{size[0]}x{size[1]}"
        cached = self._image_cache.get(key)
        if cached is not None:
            return cached
        scaled = pygame.transform.smoothscale(base, size)
        self._image_cache[key] = scaled
        return scaled

    def font(self, size: int, name: str = DEFAULT_FONT) -> pygame.font.Font:
        key = (name, size)
        cached = self._font_cache.get(key)
        if cached is not None:
            return cached
        try:
            path = self._resolve(FONTS_SUBDIR, name)
            font = pygame.font.Font(str(path), size)
        except FileNotFoundError:
            font = pygame.font.SysFont(None, size)
        self._font_cache[key] = font
        return font

    # ------------------------------------------------------------------
    # Sound
    # ------------------------------------------------------------------
    def load_sound(self, name: str) -> pygame.mixer.Sound | None:
        if not self.sound_enabled:
            return None
        try:
            path = self._resolve(SOUNDS_SUBDIR, name)
        except FileNotFoundError:
            return None
        key = str(path)
        cached = self._sound_cache.get(key)
        if cached is not None:
            return cached
        try:
            sound = pygame.mixer.Sound(key)
        except pygame.error:
            return None
        self._sound_cache[key] = sound
        return sound

    def play_sound(self, name: str) -> None:
        sound = self.load_sound(name)
        if sound is not None:
            sound.play()

    def play_music(self, *parts: str, loops: int = 0) -> None:
        """Stream a longer sound (ogg/wav) through ``pygame.mixer.music``."""
        if not self.sound_enabled:
            return
        try:
            path = self._resolve(*parts)
        except FileNotFoundError:
            return
        try:
            pygame.mixer.music.load(str(path))
            pygame.mixer.music.play(loops)
        except pygame.error:
            pass

    def stop_music(self) -> None:
        if self.sound_enabled and pygame.mixer.get_init():
            pygame.mixer.music.stop()

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------
    def quit(self) -> None:
        pygame.quit()
