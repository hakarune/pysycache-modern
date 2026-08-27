"""Headless smoke test.

Boots the engine and drives every activity for a couple of hundred frames with
no real display or audio, so CI can catch crashes, missing assets and broken
game-loop wiring without a GPU.  Run it with the dummy SDL drivers::

    SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy pytest
"""

from __future__ import annotations

import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

import pytest  # noqa: E402  (import must follow the env setup above)

from src.engine import VIRTUAL_SIZE, Engine  # noqa: E402
from src.games import ACTIVITIES  # noqa: E402
from src.games.base import LEVEL_EASY, LEVEL_HARD, LEVEL_MEDIUM  # noqa: E402


@pytest.fixture
def engine():
    eng = Engine(sound=False)
    try:
        yield eng
    finally:
        eng.quit()


def test_engine_boots(engine):
    assert engine.surface.get_size() == VIRTUAL_SIZE


@pytest.mark.parametrize("level", [LEVEL_EASY, LEVEL_MEDIUM, LEVEL_HARD])
@pytest.mark.parametrize("activity_cls", ACTIVITIES, ids=lambda c: c.id)
def test_activity_drives_frames(engine, activity_cls, level):
    activity = activity_cls(engine, level=level)
    activity.start_round()

    for _ in range(180):
        engine.tick()
        for event in engine.get_events():
            activity.handle_event(event)
        activity.update(1 / 60)
        if activity.is_round_won():
            activity.start_round()
        activity.draw(engine.surface)

    # Cycle through every discovered theme at least once.
    for _ in range(len(activity.themes) + 1):
        activity.next_theme()


def test_menu_starts_and_quits(monkeypatch):
    """Run the real menu loop briefly, then force it to exit."""
    from src import main as main_mod

    real_engine_cls = main_mod.Engine
    box = {}

    class _Engine(real_engine_cls):
        def __init__(self, *a, **kw):
            kw["sound"] = False
            super().__init__(*a, **kw)
            box["engine"] = self
            self._frames = 0

        def present(self, *a, **kw):
            super().present(*a, **kw)
            self._frames += 1
            if self._frames >= 30:
                self.running = False

    monkeypatch.setattr(main_mod, "Engine", _Engine)
    rc = main_mod.main([])
    assert rc == 0
    assert box["engine"]._frames >= 30
