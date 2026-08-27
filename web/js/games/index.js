// Ordered activity registry -- mirrors src/games/__init__.py ACTIVITIES.

import { MoveActivity } from "./move.js";
import { ClickActivity } from "./click.js";
import { DblClickActivity } from "./dblclick.js";
import { DragActivity } from "./drag.js";
import { ButtonsActivity } from "./buttons.js";

export const ACTIVITIES = [
  MoveActivity,
  ClickActivity,
  DblClickActivity,
  DragActivity,
  ButtonsActivity,
];
