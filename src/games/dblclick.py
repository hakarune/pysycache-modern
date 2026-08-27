"""Double-Click activity - collect every themed picture with a double click."""

from __future__ import annotations

from .targets import TargetActivity


class DblClickActivity(TargetActivity):
    id = "dblclick"
    title = "Double click"
    background = "dblclick"
    themes_suffix = "dblclick"
    require_double_click = True
