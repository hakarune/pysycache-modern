"""Drag activity - drag-and-drop puzzle pieces into place.

A lightweight port of the legacy ``pysypuzzle.py``: a themed picture is sliced
into a grid, the pieces are scattered down the side of the screen, and the child
drags each one back to its slot.  A piece snaps home when dropped close enough.
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

GRID = {LEVEL_EASY: (2, 2), LEVEL_MEDIUM: (3, 2), LEVEL_HARD: (3, 3)}
SNAP_DISTANCE = 45
BOARD_W, BOARD_H = 520, 420
BOARD_X = MARGIN_LEFT + 20
BOARD_Y = MARGIN_TOP + 60


class _Piece:
    __slots__ = ("image", "home", "pos", "placed")

    def __init__(self, image, home) -> None:
        self.image = image
        self.home = pygame.Vector2(home)
        self.pos = pygame.Vector2(home)
        self.placed = False

    @property
    def rect(self) -> pygame.Rect:
        return self.image.get_rect(topleft=(round(self.pos.x), round(self.pos.y)))


class DragActivity(Activity):
    id = "drag"
    title = "Drag and drop"
    background = "puzzle"
    themes_suffix = "puzzle"

    def __init__(self, engine, level=LEVEL_MEDIUM) -> None:
        super().__init__(engine, level)
        self.cols, self.rows = GRID.get(self.level, GRID[LEVEL_MEDIUM])
        self.pieces: list[_Piece] = []
        self.dragging: _Piece | None = None
        self.drag_offset = pygame.Vector2()
        self.outline = pygame.Rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H)

    # ------------------------------------------------------------------
    def _pick_picture(self) -> pygame.Surface:
        candidates = [
            p for p in self.theme_images(extensions=(".png", ".jpeg", ".jpg"))
            if not p.stem.lower().startswith(("fond", "logo"))
        ]
        random.shuffle(candidates)
        for path in candidates:
            try:
                img = self.load_theme_image(path, (BOARD_W, BOARD_H), alpha=False)
                return img.copy()
            except pygame.error:
                continue
        surface = pygame.Surface((BOARD_W, BOARD_H))
        for i in range(0, BOARD_W, 40):
            pygame.draw.rect(surface, (200, 120, 60) if (i // 40) % 2 else (60, 120, 200),
                             (i, 0, 40, BOARD_H))
        return surface

    def start_round(self) -> None:
        picture = self._pick_picture()
        piece_w = BOARD_W // self.cols
        piece_h = BOARD_H // self.rows

        self.pieces = []
        for r in range(self.rows):
            for c in range(self.cols):
                sub = picture.subsurface(
                    pygame.Rect(c * piece_w, r * piece_h, piece_w, piece_h)
                ).copy()
                home = (BOARD_X + c * piece_w, BOARD_Y + r * piece_h)
                self.pieces.append(_Piece(sub, home))

        # Scatter start positions in the right-hand gutter.
        gutter_x = MARGIN_LEFT + PLAY_WIDTH - piece_w - 12
        slots = list(range(self.rows * self.cols))
        random.shuffle(slots)
        for piece, slot in zip(self.pieces, slots):
            y = MARGIN_TOP + 20 + slot * ((PLAY_HEIGHT - 40 - piece_h) //
                                          max(1, self.rows * self.cols - 1))
            piece.pos = pygame.Vector2(gutter_x, y)
        self.dragging = None

    on_theme_changed = start_round

    # ------------------------------------------------------------------
    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for piece in reversed(self.pieces):
                if not piece.placed and piece.rect.collidepoint(event.pos):
                    self.dragging = piece
                    self.drag_offset = pygame.Vector2(event.pos) - piece.pos
                    self.pieces.remove(piece)
                    self.pieces.append(piece)  # draw on top
                    break
        elif event.type == pygame.MOUSEMOTION and self.dragging is not None:
            self.dragging.pos = pygame.Vector2(event.pos) - self.drag_offset
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1 and self.dragging:
            piece = self.dragging
            self.dragging = None
            if piece.pos.distance_to(piece.home) <= SNAP_DISTANCE:
                piece.pos = pygame.Vector2(piece.home)
                piece.placed = True
                self.score += 1
                self.engine.play_sound("dragdrop.ogg")

    def is_round_won(self) -> bool:
        return bool(self.pieces) and all(p.placed for p in self.pieces)

    def draw(self, surface: pygame.Surface) -> None:
        surface.blit(self.bg_surface, (0, 0))
        pygame.draw.rect(surface, (255, 255, 255), self.outline, 2)
        for piece in self.pieces:
            surface.blit(piece.image, piece.rect)
            if not piece.placed:
                pygame.draw.rect(surface, (0, 0, 0), piece.rect, 1)
