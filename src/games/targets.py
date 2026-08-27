"""Shared implementation for the Click and Double-Click activities.

Both spawn a handful of themed picture "targets" at random spots in the play
area.  The child collects each one with the correct mouse gesture (a single
click, or a double click) until the board is clear.  Ports the common parts of
the legacy ``pysyclick.py`` / ``pysydblclick.py``.
"""

from __future__ import annotations

import random

import pygame

from .base import LEVEL_EASY, LEVEL_HARD, LEVEL_MEDIUM, Activity

# How many targets to place, per difficulty level.
TARGET_COUNT = {LEVEL_EASY: 3, LEVEL_MEDIUM: 5, LEVEL_HARD: 8}
DOUBLE_CLICK_MS = 400
TARGET_MAX_EDGE = 110


class _Target:
    __slots__ = ("image", "rect", "last_click_ms")

    def __init__(self, image: pygame.Surface, center: tuple[int, int]) -> None:
        self.image = image
        self.rect = image.get_rect(center=center)
        self.last_click_ms = 0


class TargetActivity(Activity):
    require_double_click = False

    def __init__(self, engine, level=LEVEL_MEDIUM) -> None:
        super().__init__(engine, level)
        self.targets: list[_Target] = []

    # ------------------------------------------------------------------
    def _distinct_theme_images(self) -> list:
        """Theme images with the -on/-off/-selected state variants folded away."""
        seen: dict[str, "object"] = {}
        for path in self.theme_images():
            stem = path.stem
            for suffix in ("-on", "-off", "-selected"):
                if stem.endswith(suffix):
                    stem = stem[: -len(suffix)]
                    break
            seen.setdefault(stem, path)
        return list(seen.values())

    def _scaled(self, path) -> pygame.Surface:
        img = self.load_theme_image(path)
        w, h = img.get_size()
        scale = min(1.0, TARGET_MAX_EDGE / max(w, h))
        if scale < 1.0:
            img = pygame.transform.smoothscale(img, (int(w * scale), int(h * scale)))
        return img

    def start_round(self) -> None:
        pool = self._distinct_theme_images()
        random.shuffle(pool)
        want = TARGET_COUNT.get(self.level, 5)

        self.targets = []
        attempts = 0
        while len(self.targets) < want and attempts < want * 40:
            attempts += 1
            if pool:
                path = pool[len(self.targets) % len(pool)]
                try:
                    image = self._scaled(path)
                except pygame.error:
                    pool.remove(path)
                    continue
            else:
                image = pygame.Surface((80, 80), pygame.SRCALPHA)
                pygame.draw.circle(image, (240, 90, 90), (40, 40), 38)
            center = self.random_point_in_play_area(margin=70)
            rect = image.get_rect(center=center)
            if any(rect.colliderect(t.rect.inflate(20, 20)) for t in self.targets):
                continue
            self.targets.append(_Target(image, center))

    on_theme_changed = start_round

    # ------------------------------------------------------------------
    def _hit(self, pos) -> _Target | None:
        for target in reversed(self.targets):
            if target.rect.collidepoint(pos):
                return target
        return None

    def _collect(self, target: _Target) -> None:
        self.targets.remove(target)
        self.score += 1
        self.engine.play_sound("pop.wav")

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type != pygame.MOUSEBUTTONDOWN or event.button != 1:
            return
        target = self._hit(event.pos)
        if target is None:
            return
        now = pygame.time.get_ticks()
        if not self.require_double_click:
            self._collect(target)
            return
        if now - target.last_click_ms <= DOUBLE_CLICK_MS:
            self.engine.play_sound("double-click.wav")
            self._collect(target)
        else:
            target.last_click_ms = now
            self.engine.play_sound("center.wav")

    def is_round_won(self) -> bool:
        return not self.targets

    def draw(self, surface: pygame.Surface) -> None:
        surface.blit(self.bg_surface, (0, 0))
        for target in self.targets:
            surface.blit(target.image, target.rect)
