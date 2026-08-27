"""Move activity - uncover a hidden picture by sweeping the mouse across it.

Port of the legacy ``pysymove.py``.  A themed picture is hidden under a "cache"
image; the play area is split into a grid of tiles and every tile the pointer
touches is revealed.  Clear the whole grid to win the round.
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

# Tile size per difficulty level (legacy DoInitLevel): 6x6, 10x10, 15x15 grids.
TILE_SIZE = {
    LEVEL_EASY: (120, 90),
    LEVEL_MEDIUM: (72, 54),
    LEVEL_HARD: (48, 36),
}


class MoveActivity(Activity):
    id = "move"
    title = "Move the mouse"
    background = "move"
    themes_suffix = "move"

    def __init__(self, engine, level=LEVEL_MEDIUM) -> None:
        super().__init__(engine, level)
        self.tile_w, self.tile_h = TILE_SIZE.get(self.level, TILE_SIZE[LEVEL_MEDIUM])
        self.cols = PLAY_WIDTH // self.tile_w
        self.rows = PLAY_HEIGHT // self.tile_h
        self.picture = pygame.Surface((PLAY_WIDTH, PLAY_HEIGHT))
        self.canvas = pygame.Surface((PLAY_WIDTH, PLAY_HEIGHT))
        self.revealed: list[list[bool]] = []
        self.remaining = 0

    # ------------------------------------------------------------------
    def _load_cover(self) -> pygame.Surface:
        cache_dir = self.theme_dir() / "cache"
        candidates = []
        if cache_dir.is_dir():
            preferred = cache_dir / "cache-theme.png"
            if preferred.is_file():
                candidates.append(preferred)
            candidates += [p for p in sorted(cache_dir.glob("*.png")) if p not in candidates]
        for path in candidates:
            try:
                img = self.load_theme_image(path, (PLAY_WIDTH, PLAY_HEIGHT), alpha=False)
                return img
            except pygame.error:
                continue
        cover = pygame.Surface((PLAY_WIDTH, PLAY_HEIGHT))
        cover.fill((120, 120, 140))
        return cover

    def start_round(self) -> None:
        pictures = self.theme_images(extensions=(".jpeg", ".jpg"))
        if not pictures:
            # Fall back to any bitmap in the theme folder.
            pictures = self.theme_images()
        if pictures:
            chosen = random.choice(pictures)
            try:
                self.picture = self.load_theme_image(
                    chosen, (PLAY_WIDTH, PLAY_HEIGHT), alpha=False
                ).copy()
            except pygame.error:
                self.picture.fill((60, 90, 60))
        else:
            self.picture.fill((60, 90, 60))

        cover = self._load_cover()
        self.canvas = self.picture.copy()
        self.canvas.blit(cover, (0, 0))

        self.revealed = [[False] * self.rows for _ in range(self.cols)]
        self.remaining = self.cols * self.rows

    on_theme_changed = start_round

    # ------------------------------------------------------------------
    def _reveal_tile(self, col: int, row: int) -> None:
        if not (0 <= col < self.cols and 0 <= row < self.rows):
            return
        if self.revealed[col][row]:
            return
        self.revealed[col][row] = True
        self.remaining -= 1
        rect = pygame.Rect(col * self.tile_w, row * self.tile_h, self.tile_w, self.tile_h)
        self.canvas.blit(self.picture, rect, rect)
        self.engine.play_sound("pop.wav")
        self.score += 1

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type in (pygame.MOUSEMOTION, pygame.MOUSEBUTTONDOWN):
            mx, my = event.pos
            col = (mx - MARGIN_LEFT) // self.tile_w
            row = (my - MARGIN_TOP) // self.tile_h
            self._reveal_tile(col, row)

    def is_round_won(self) -> bool:
        return self.remaining <= 0

    def draw(self, surface: pygame.Surface) -> None:
        surface.blit(self.bg_surface, (0, 0))
        surface.blit(self.canvas, (MARGIN_LEFT, MARGIN_TOP))
