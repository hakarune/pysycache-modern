"""Activity modules for PySyCache-Modern.

``ACTIVITIES`` is the ordered registry the main menu iterates over to build its
buttons and to dispatch into the chosen activity.
"""

from __future__ import annotations

from .base import Activity
from .buttons import ButtonsActivity
from .click import ClickActivity
from .dblclick import DblClickActivity
from .drag import DragActivity
from .move import MoveActivity

#: Menu order == list order.
ACTIVITIES: list[type[Activity]] = [
    MoveActivity,
    ClickActivity,
    DblClickActivity,
    DragActivity,
    ButtonsActivity,
]

ACTIVITIES_BY_ID: dict[str, type[Activity]] = {cls.id: cls for cls in ACTIVITIES}

__all__ = [
    "Activity",
    "MoveActivity",
    "ClickActivity",
    "DblClickActivity",
    "DragActivity",
    "ButtonsActivity",
    "ACTIVITIES",
    "ACTIVITIES_BY_ID",
]
