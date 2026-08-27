// Click activity -- collect every themed picture with a single click.

import { TargetActivity } from "./targets.js";

export class ClickActivity extends TargetActivity {
  static id = "click";
  static suffix = "click";
  static bg = "click";
  static title = "Single click";
  static requireDouble = false;
}
