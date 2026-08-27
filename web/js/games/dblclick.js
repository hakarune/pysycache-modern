// Double-Click activity -- collect every themed picture with a double click.

import { TargetActivity } from "./targets.js";

export class DblClickActivity extends TargetActivity {
  static id = "dblclick";
  static suffix = "dblclick";
  static bg = "dblclick";
  static title = "Double click";
  static requireDouble = true;
}
