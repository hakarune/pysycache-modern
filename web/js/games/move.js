// Move activity -- sweep the pointer to uncover a hidden picture.
// Counterpart of src/games/move.py.

import { C } from "../engine.js";
import { Activity, MARGIN_LEFT, MARGIN_TOP, PLAY_H, PLAY_W } from "./base.js";

function offscreen(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class MoveActivity extends Activity {
  static id = "move";
  static suffix = "move";
  static bg = "move";
  static title = "Move the mouse";

  constructor(engine, opts) {
    super(engine, opts);
    [this.tileW, this.tileH] = C.MOVE_TILE[this.level] || C.MOVE_TILE.medium;
    this.cols = Math.floor(PLAY_W / this.tileW);
    this.rows = Math.floor(PLAY_H / this.tileH);
    this._pic = offscreen(PLAY_W, PLAY_H);
    this._cover = offscreen(PLAY_W, PLAY_H);
    this.revealed = [];
    this.remaining = 0;
  }

  themeAssetList(data) {
    return [data.cover, data.logo, ...(data.pictures || [])].filter(Boolean);
  }

  startRound() {
    const data = this.themeData;
    const pics = data.pictures || [];
    const pic = pics.length ? this.engine.image(pics[(Math.random() * pics.length) | 0]) : null;
    const pc = this._pic.getContext("2d");
    pc.fillStyle = "#3c5a3c";
    pc.fillRect(0, 0, PLAY_W, PLAY_H);
    if (pic) pc.drawImage(pic, 0, 0, PLAY_W, PLAY_H);

    const cover = data.cover && this.engine.image(data.cover);
    const cc = this._cover.getContext("2d");
    if (cover) cc.drawImage(cover, 0, 0, PLAY_W, PLAY_H);
    else { cc.fillStyle = "#78788c"; cc.fillRect(0, 0, PLAY_W, PLAY_H); }

    this.revealed = Array.from({ length: this.cols }, () => new Array(this.rows).fill(false));
    this.remaining = this.cols * this.rows;
  }

  _reveal(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    if (this.revealed[col][row]) return false;
    this.revealed[col][row] = true;
    this.remaining--;
    this.score++;
    return true;
  }

  _tileAt(x, y) {
    return this._reveal(
      Math.floor((x - MARGIN_LEFT) / this.tileW),
      Math.floor((y - MARGIN_TOP) / this.tileH),
    );
  }

  onPointer(ev) {
    if (ev.type !== "pointermove" && ev.type !== "pointerdown") return;
    const from = ev.from || { x: ev.x, y: ev.y };
    const dist = Math.hypot(ev.x - from.x, ev.y - from.y);
    let count = 0;
    if (dist > 4 * Math.max(this.tileW, this.tileH)) {
      // pointer jumped (re-entered the canvas, or first move) -- don't draw a
      // line of tiles the child never swept over
      count += this._tileAt(ev.x, ev.y) ? 1 : 0;
    } else {
      // walk the segment so a fast sweep doesn't skip tiles between events
      const steps = Math.max(1, Math.ceil(dist / (Math.min(this.tileW, this.tileH) / 2)));
      for (let i = 0; i <= steps; i++) {
        count += this._tileAt(
          from.x + ((ev.x - from.x) * i) / steps,
          from.y + ((ev.y - from.y) * i) / steps,
        ) ? 1 : 0;
      }
    }
    if (count) this.engine.sound?.("sounds/pop.wav"); // one pop per event, not per tile
  }

  isRoundWon() {
    return this.remaining <= 0;
  }

  paint(ctx) {
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const src = this.revealed[c][r] ? this._pic : this._cover;
        const x = c * this.tileW;
        const y = r * this.tileH;
        ctx.drawImage(src, x, y, this.tileW, this.tileH, MARGIN_LEFT + x, MARGIN_TOP + y, this.tileW, this.tileH);
      }
    }
  }
}
