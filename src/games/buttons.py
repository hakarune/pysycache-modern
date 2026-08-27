"""Buttons activity - press every themed button once.

Port of the spirit of the legacy ``pysybuttons.py``: a set of themed objects is
laid out on screen, each with a "resting" and a "pressed" picture (``NN.png`` /
``NNb.png`` in the theme folder).  Clicking an object presses it; press them all
to win the round.
"""

from __future__ import annotations

import random

import pygame

from .base import (
    LEVEL_EASY,
    LEVEL_HARD,
    LEVEL_MEDIUM,
    MARGIN_LEFT,
    MARGIN_TOP,
    PLAY_HEIGHT,
    PLAY_WIDTH,
    Activity,
)

BUTTON_COUNT = {LEVEL_EASY: 3, LEVEL_MEDIUM: 5, LEVEL_HARD: 8}
BUTTON_MAX_EDGE = 120


class _Button:
    __slots__ = ("rest", "pressed", "rect", "is_pressed")

    def __init__(self, rest, pressed, center) -> None:
        self.rest = rest
        self.pressed = pressed
        self.rect = rest.get_rect(center=center)
        self.is_pressed = False

    @property
    def image(self):
        return self.pressed if self.is_pressed else self.rest


class ButtonsActivity(Activity):
    id = "buttons"
    title = "Buttons"
    background = "buttons"
    themes_suffix = "buttons"

    def __init__(self, engine, level=LEVEL_MEDIUM) -> None:
        super().__init__(engine, level)
        self.buttons: list[_Button] = []

    # ------------------------------------------------------------------
    def _button_pairs(self) -> list[tuple]:
        """Return (rest_path, pressed_path_or_None) pairs from the theme folder."""
        by_stem = {p.stem: p for p in self.theme_images(exclude_prefixes=("fond", "logo"))}
        pairs = []
        for stem, path in sorted(by_stem.items()):
            if stem.endswith("b"):
                continue
            pairs.append((path, by_stem.get(stem + "b")))
        return pairs

    def _scaled(self, path) -> pygame.Surface:
        img = self.load_theme_image(path)
        w, h = img.get_size()
        scale = min(1.0, BUTTON_MAX_EDGE / max(w, h))
        if scale < 1.0:
            img = pygame.transform.smoothscale(img, (int(w * scale), int(h * scale)))
        return img

    def _fallback(self, pressed: bool) -> pygame.Surface:
        surf = pygame.Surface((90, 60), pygame.SRCALPHA)
        colour = (90, 170, 90) if pressed else (170, 170, 90)
        pygame.draw.rect(surf, colour, surf.get_rect(), border_radius=10)
        return surf

    def start_round(self) -> None:
        pairs = self._button_pairs()
        random.shuffle(pairs)
        want = BUTTON_COUNT.get(self.level, 5)
        cols = min(want, 4)
        rows = (want + cols - 1) // cols
        cell_w = PLAY_WIDTH // cols
        cell_h = PLAY_HEIGHT // (rows + 1)

        self.buttons = []
        for i in range(want):
            if pairs:
                rest_path, pressed_path = pairs[i % len(pairs)]
                try:
                    rest = self._scaled(rest_path)
                    pressed = self._scaled(pressed_path) if pressed_path else rest
                except pygame.error:
                    rest, pressed = self._fallback(False), self._fallback(True)
            else:
                rest, pressed = self._fallback(False), self._fallback(True)
            col, row = i % cols, i // cols
            center = (
                MARGIN_LEFT + cell_w * col + cell_w // 2,
                MARGIN_TOP + cell_h * (row + 1) + cell_h // 2,
            )
            self.buttons.append(_Button(rest, pressed, center))

    on_theme_changed = start_round

    # ------------------------------------------------------------------
    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type != pygame.MOUSEBUTTONDOWN or event.button != 1:
            return
        for button in reversed(self.buttons):
            if not button.is_pressed and button.rect.collidepoint(event.pos):
                button.is_pressed = True
                self.score += 1
                self.engine.play_sound("btncoche.ogg")
                break

    def is_round_won(self) -> bool:
        return bool(self.buttons) and all(b.is_pressed for b in self.buttons)

    def draw(self, surface: pygame.Surface) -> None:
        surface.blit(self.bg_surface, (0, 0))
        for button in self.buttons:
            surface.blit(button.image, button.rect)
