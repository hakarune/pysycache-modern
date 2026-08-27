"""Shared scaffolding for the individual mouse activities.

Every activity runs its own small game loop (:meth:`Activity.run`) and returns
control to the main menu when the child presses *Escape* or the window is closed.
The loop is deliberately close to the legacy ``ApplicationPysy.Execute`` shape:

    fade in  ->  play rounds  ->  on win: celebrate, load next round  ->  repeat
"""

from __future__ import annotations

import asyncio
import random
from pathlib import Path

import pygame

from ..engine import ASSETS_DIR, VIRTUAL_HEIGHT, VIRTUAL_WIDTH, Engine

# Play-area margins from the legacy ``const.py`` (MARGELEFT / MARGETOP).
MARGIN_LEFT = 10
MARGIN_TOP = 4
PLAY_WIDTH = 720
PLAY_HEIGHT = 540

# Difficulty levels, matching legacy GLevel 0/1/2.
LEVEL_EASY, LEVEL_MEDIUM, LEVEL_HARD = 0, 1, 2
LEVEL_NAMES = {LEVEL_EASY: "easy", LEVEL_MEDIUM: "medium", LEVEL_HARD: "hard"}


class Activity:
    """Base class for Move / Click / Double-Click / Drag / Buttons."""

    #: kebab-case id, also the ``assets/themes-<id>`` directory suffix.
    id: str = "activity"
    #: human-readable title shown in the menu and title bar.
    title: str = "Activity"
    #: ``assets/images/fond-<background>.png`` used as the activity backdrop.
    background: str = "menu"
    #: ``assets/themes-<themes_suffix>/`` holds this activity's themes.
    themes_suffix: str = ""

    def __init__(self, engine: Engine, level: int = LEVEL_MEDIUM) -> None:
        self.engine = engine
        self.level = level
        self.score = 0
        self.rounds_completed = 0
        self.done = False

        self.bg_surface = self._load_background()
        self.themes = self._discover_themes()
        self.theme = self.themes[0] if self.themes else None

    # ------------------------------------------------------------------
    # Asset / theme discovery
    # ------------------------------------------------------------------
    def _load_background(self) -> pygame.Surface:
        for candidate in (f"fond-{self.background}.png", "fond-menu.png", "fond1.png"):
            try:
                img = self.engine.load_image("images", candidate, alpha=False)
                return pygame.transform.smoothscale(img, (VIRTUAL_WIDTH, VIRTUAL_HEIGHT))
            except FileNotFoundError:
                continue
        surface = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT))
        surface.fill((30, 60, 90))
        return surface

    def _themes_dir(self) -> Path:
        return ASSETS_DIR / f"themes-{self.themes_suffix or self.id}"

    def _discover_themes(self) -> list[str]:
        root = self._themes_dir()
        if not root.is_dir():
            return []
        return sorted(p.name for p in root.iterdir() if p.is_dir())

    def theme_dir(self) -> Path:
        return self._themes_dir() / (self.theme or "")

    def next_theme(self) -> None:
        if not self.themes:
            return
        idx = (self.themes.index(self.theme) + 1) % len(self.themes)
        self.theme = self.themes[idx]
        self.on_theme_changed()

    # ------------------------------------------------------------------
    # Hooks for subclasses
    # ------------------------------------------------------------------
    def start_round(self) -> None:
        """Prepare a fresh round (pick a picture, build sprites, ...)."""

    def on_theme_changed(self) -> None:
        self.start_round()

    def handle_event(self, event: pygame.event.Event) -> None:
        """React to a single pygame event (positions already in virtual space)."""

    def update(self, dt: float) -> None:
        """Advance animation / timers by ``dt`` seconds."""

    def draw(self, surface: pygame.Surface) -> None:
        """Render the current frame onto ``surface`` (800x600)."""
        surface.blit(self.bg_surface, (0, 0))

    def is_round_won(self) -> bool:
        return False

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    async def run(self) -> int:
        """Play until the child leaves.  Returns the accumulated score.

        This is a coroutine: it yields to the event loop once per frame
        (``await asyncio.sleep(0)``) so the same loop drives a native desktop
        run and a pygbag/WebAssembly build in the browser.
        """
        engine = self.engine
        await self._fade_in()
        self.start_round()

        while engine.running and not self.done:
            dt = engine.tick()

            for event in engine.get_events():
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    self.done = True
                elif event.type == pygame.KEYDOWN and event.key == pygame.K_TAB:
                    self.next_theme()
                else:
                    self.handle_event(event)

            self.update(dt)

            if self.is_round_won():
                self.rounds_completed += 1
                self.draw(engine.surface)
                await self._celebrate()
                self.start_round()
                await asyncio.sleep(0)
                continue

            self.draw(engine.surface)
            self._draw_hud(engine.surface)
            engine.present()
            await asyncio.sleep(0)

        engine.stop_music()
        return self.score

    # ------------------------------------------------------------------
    # Presentation helpers
    # ------------------------------------------------------------------
    async def _fade_in(self) -> None:
        """Legacy-style top-to-bottom wipe onto the activity background."""
        engine = self.engine
        engine.play_sound("transition.ogg")
        target = self.bg_surface
        prev = engine.surface.copy()
        step = max(4, VIRTUAL_HEIGHT // 60)
        for y in range(0, VIRTUAL_HEIGHT + step, step):
            engine.surface.blit(prev, (0, 0))
            engine.surface.blit(target, (0, 0), (0, 0, VIRTUAL_WIDTH, y))
            engine.present()
            engine.tick()
            await asyncio.sleep(0)

    async def _celebrate(self) -> None:
        engine = self.engine
        for name in ("youpee.ogg", "yahoo.ogg", "rire.ogg"):
            if engine.load_sound(name) is not None:
                engine.play_sound(name)
                break
        try:
            banner = engine.load_image("images", "gagne.png")
            rect = banner.get_rect(center=(VIRTUAL_WIDTH // 2, VIRTUAL_HEIGHT // 2))
            engine.surface.blit(banner, rect)
        except FileNotFoundError:
            pass
        engine.present()
        await asyncio.sleep(1.5)

    def _draw_hud(self, surface: pygame.Surface) -> None:
        font = self.engine.font(20)
        theme = self.theme or "-"
        text = f"{self.title}   theme: {theme}   score: {self.score}   [Esc] menu  [Tab] theme"
        label = font.render(text, True, (255, 255, 255))
        shadow = font.render(text, True, (0, 0, 0))
        surface.blit(shadow, (12, VIRTUAL_HEIGHT - 26))
        surface.blit(label, (11, VIRTUAL_HEIGHT - 27))

    # ------------------------------------------------------------------
    # Small utilities for subclasses
    # ------------------------------------------------------------------
    def theme_images(self, *, extensions=(".jpeg", ".jpg", ".png"),
                     exclude_prefixes=("fond", "logo", "cache")) -> list[Path]:
        d = self.theme_dir()
        if not d.is_dir():
            return []
        out = []
        for p in sorted(d.iterdir()):
            if not p.is_file() or p.suffix.lower() not in extensions:
                continue
            if p.stem.lower().startswith(exclude_prefixes):
                continue
            out.append(p)
        return out

    def load_theme_image(self, path: Path, size: tuple[int, int] | None = None,
                         alpha: bool = True) -> pygame.Surface:
        rel = path.relative_to(ASSETS_DIR).parts
        if size is None:
            return self.engine.load_image(*rel, alpha=alpha)
        return self.engine.load_image_scaled(size, *rel, alpha=alpha)

    @staticmethod
    def random_point_in_play_area(margin: int = 60) -> tuple[int, int]:
        return (
            random.randint(MARGIN_LEFT + margin, MARGIN_LEFT + PLAY_WIDTH - margin),
            random.randint(MARGIN_TOP + margin, MARGIN_TOP + PLAY_HEIGHT - margin),
        )
