"""Click activity - collect every themed picture with a single click."""

from __future__ import annotations

from .targets import TargetActivity


class ClickActivity(TargetActivity):
    id = "click"
    title = "Single click"
    background = "click"
    themes_suffix = "click"
    require_double_click = False
