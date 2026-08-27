// Shared implementation for Click and Double-Click.
// Counterpart of src/games/targets.py.

import { C } from "../engine.js";
import { Activity, fitDown, shuffle } from "./base.js";

export class TargetActivity extends Activity {
  static suffix = "";
  static requireDouble = false;

  themeAssetList(data) {
    return [data.logo, ...(data.sprites || []).map((s) => s.image)].filter(Boolean);
  }

  startRound() {
    const sprites = shuffle([...(this.themeData.sprites || [])]);
    const want = C.TARGET_COUNT[this.level] ?? 5;
    this.targets = [];
    let attempts = 0;
    while (this.targets.length < want && attempts < want * 40) {
      attempts++;
      let img = null;
      if (sprites.length) img = this.engine.image(sprites[this.targets.length % sprites.length].image);
      const nw = img?.naturalWidth || 80;
      const nh = img?.naturalHeight || 80;
      const { w, h } = fitDown(nw, nh, C.TARGET_MAX_EDGE);
      const { x, y } = this.randomPointInPlay(70);
      const rect = { x: x - w / 2, y: y - h / 2, w, h };
      if (this.targets.some((t) => overlaps(inflate(rect, 20), t))) continue;
      this.targets.push({ img, ...rect, last: 0 });
    }
  }

  _hit(x, y) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
    }
    return null;
  }

  _collect(t) {
    this.targets.splice(this.targets.indexOf(t), 1);
    this.score++;
    this.engine.sound?.("sounds/pop.wav");
  }

  onPointer(ev) {
    if (ev.type !== "pointerdown" || ev.button !== 0) return;
    const t = this._hit(ev.x, ev.y);
    if (!t) return;
    const now = performance.now();
    if (!this.constructor.requireDouble) {
      this._collect(t);
      return;
    }
    if (now - t.last <= C.DOUBLE_CLICK_MS) {
      this.engine.sound?.("sounds/double-click.wav");
      this._collect(t);
    } else {
      t.last = now;
      this.engine.sound?.("sounds/center.wav");
    }
  }

  isRoundWon() {
    return this.targets && this.targets.length === 0;
  }

  paint(ctx) {
    for (const t of this.targets) {
      if (t.img) ctx.drawImage(t.img, t.x, t.y, t.w, t.h);
      else { ctx.fillStyle = "#f05a5a"; ctx.beginPath(); ctx.arc(t.x + t.w / 2, t.y + t.h / 2, t.w / 2, 0, 7); ctx.fill(); }
    }
  }
}

const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
