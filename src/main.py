"""Main menu and activity dispatcher for PySyCache-Modern.

Run with ``python -m src.main`` (or the ``pysycache-modern`` console script).

Options
-------
--fullscreen / --windowed   start full-screen or in an 800x600 window (default)
--no-sound                  disable the audio mixer
--level {easy,medium,hard}  difficulty passed to every activity (default medium)
"""

from __future__ import annotations

import argparse
import sys

import pygame

from .engine import VIRTUAL_HEIGHT, VIRTUAL_WIDTH, Engine
from .games import ACTIVITIES
from .games.base import LEVEL_EASY, LEVEL_HARD, LEVEL_MEDIUM

LEVELS = {"easy": LEVEL_EASY, "medium": LEVEL_MEDIUM, "hard": LEVEL_HARD}

# Per-activity menu artwork (face / hover) from the legacy image set.
MENU_ART = {
    "move": ("menu-move1.png", "menu-move.png"),
    "click": ("menu-click1.png", "menu-click.png"),
    "dblclick": ("menu-dblclick1.png", "menu-dblclick.png"),
    "drag": ("menu-puzzle1.png", "menu-puzzle.png"),
    "buttons": ("menu-button1.png", "menu-button.png"),
    "quit": ("menu-quit.png", "menu-quitter.png"),
}


class MenuButton:
    def __init__(self, engine: Engine, key: str, label: str, action) -> None:
        self.key = key
        self.label = label
        self.action = action
        self._engine = engine
        self.face, self.hover = self._load_art(key, label)
        self.rect = self.face.get_rect()
        self._was_hover = False

    def _load_art(self, key: str, label: str):
        names = MENU_ART.get(key)
        if names:
            try:
                face = self._engine.load_image("images", names[0])
                try:
                    hover = self._engine.load_image("images", names[1])
                except FileNotFoundError:
                    hover = face
                return face, hover
            except FileNotFoundError:
                pass
        return self._draw_button(label, False), self._draw_button(label, True)

    def _draw_button(self, label: str, hot: bool) -> pygame.Surface:
        font = self._engine.font(28)
        text = font.render(label, True, (255, 255, 255))
        surf = pygame.Surface((max(240, text.get_width() + 48), 60), pygame.SRCALPHA)
        bg = (70, 130, 200) if hot else (40, 90, 150)
        pygame.draw.rect(surf, bg, surf.get_rect(), border_radius=14)
        pygame.draw.rect(surf, (255, 255, 255), surf.get_rect(), width=2, border_radius=14)
        surf.blit(text, text.get_rect(center=surf.get_rect().center))
        return surf

    def draw(self, surface: pygame.Surface, mouse_pos) -> None:
        hot = self.rect.collidepoint(mouse_pos)
        if hot and not self._was_hover:
            self._engine.play_sound("btnmenu.wav")
        self._was_hover = hot
        surface.blit(self.hover if hot else self.face, self.rect)


class Menu:
    def __init__(self, engine: Engine, level: int) -> None:
        self.engine = engine
        self.level = level
        self.background = self._load_background()
        self.title = self._load_title()
        self.buttons = self._build_buttons()

    # ------------------------------------------------------------------
    def _load_background(self) -> pygame.Surface:
        try:
            img = self.engine.load_image("images", "fond-menu.png", alpha=False)
        except FileNotFoundError:
            img = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT))
            img.fill((25, 55, 85))
        return pygame.transform.smoothscale(img, (VIRTUAL_WIDTH, VIRTUAL_HEIGHT))

    def _load_title(self) -> pygame.Surface | None:
        for name in ("logo.png", "pysycache.png"):
            try:
                return self.engine.load_image("images", name)
            except FileNotFoundError:
                continue
        return None

    def _build_buttons(self) -> list[MenuButton]:
        buttons = [
            MenuButton(self.engine, cls.id, cls.title, ("play", cls))
            for cls in ACTIVITIES
        ]
        buttons.append(MenuButton(self.engine, "quit", "Quit", ("quit", None)))

        # Centre the column vertically in the lower two-thirds of the screen.
        total = sum(b.rect.height for b in buttons) + 14 * (len(buttons) - 1)
        y = max(150, (VIRTUAL_HEIGHT - total) // 2 + 40)
        for button in buttons:
            button.rect.midtop = (VIRTUAL_WIDTH // 2, y)
            y += button.rect.height + 14
        return buttons

    # ------------------------------------------------------------------
    def _play_activity(self, activity_cls) -> None:
        self.engine.stop_music()
        activity = activity_cls(self.engine, level=self.level)
        activity.run()
        # Returned to the menu: reset the title and restart the ambient music.
        self.engine.set_cursor_image("souris.png")
        self._start_music()

    def _start_music(self) -> None:
        self.engine.play_music("sounds", "startup.ogg")

    def run(self) -> None:
        engine = self.engine
        self._start_music()

        while engine.running:
            engine.tick()
            mouse_pos = engine.mouse_pos()

            for event in engine.get_events():
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    engine.running = False
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    for button in self.buttons:
                        if button.rect.collidepoint(event.pos):
                            kind, payload = button.action
                            if kind == "quit":
                                engine.running = False
                            else:
                                self._play_activity(payload)
                            break

            engine.surface.blit(self.background, (0, 0))
            if self.title is not None:
                engine.surface.blit(
                    self.title, self.title.get_rect(midtop=(VIRTUAL_WIDTH // 2, 24))
                )
            for button in self.buttons:
                button.draw(engine.surface, mouse_pos)
            engine.present()


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="pysycache-modern", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    display = parser.add_mutually_exclusive_group()
    display.add_argument("--fullscreen", action="store_true", help="start full-screen")
    display.add_argument("--windowed", action="store_true", help="start in a window (default)")
    parser.add_argument("--no-sound", action="store_true", help="disable audio")
    parser.add_argument("--level", choices=list(LEVELS), default="medium",
                        help="difficulty for every activity (default: medium)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point for the ``pysycache-modern`` console script and ``python -m``."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    engine = Engine(
        caption="PySyCache-Modern",
        fullscreen=args.fullscreen,
        sound=not args.no_sound,
    )
    try:
        Menu(engine, level=LEVELS[args.level]).run()
    finally:
        engine.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
