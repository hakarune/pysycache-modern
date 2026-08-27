// Drag activity -- drag scattered pieces back into the picture.
// Counterpart of src/games/drag.py.  Pieces are sliced from one offscreen
// board canvas at round start; no pre-cut piece files.
//
// The board is smaller than the Python version's 520x420: at 800x600 with the
// pieces scattered beside it, 520 wide leaves no usable gutter, so the web
// board is 400x320 (see review C5).

import { C } from "../engine.js";
import { Activity, MARGIN_LEFT, MARGIN_TOP, PLAY_H, PLAY_W, rand, shuffle } from "./base.js";

const BW = 400;
const BH = 320;
const BX = MARGIN_LEFT + 15;
const BY = MARGIN_TOP + 36;
const SNAP = C.SNAP_DISTANCE;

const GX0 = BX + BW + 16;
const GX1 = MARGIN_LEFT + PLAY_W - 8;
const GY0 = MARGIN_TOP + 8;
const GY1 = MARGIN_TOP + PLAY_H - 8;

const overlaps = (a, b) =>
  a.x < b.x + b.w + 8 && a.x + a.w + 8 > b.x && a.y < b.y + b.h + 8 && a.y + a.h + 8 > b.y;

export class DragActivity extends Activity {
  static id = "drag";
  static suffix = "puzzle";
  static bg = "puzzle";
  static title = "Drag and drop";

  constructor(engine, opts) {
    super(engine, opts);
    [this.cols, this.rows] = C.DRAG_GRID[this.level] || C.DRAG_GRID.medium;
    this._board = document.createElement("canvas");
    this._board.width = BW;
    this._board.height = BH;
    this.pieces = [];
    this._drag = null;
  }

  themeAssetList(data) {
    return [data.logo, ...(data.pictures || [])].filter(Boolean);
  }

  startRound() {
    const pics = this.themeData.pictures || [];
    const img = pics.length ? this.engine.image(pics[(Math.random() * pics.length) | 0]) : null;
    const bctx = this._board.getContext("2d");
    if (img) {
      bctx.drawImage(img, 0, 0, BW, BH);
    } else {
      for (let i = 0; i < BW; i += 40) {
        bctx.fillStyle = (i / 40) % 2 ? "#3c78c8" : "#c8783c";
        bctx.fillRect(i, 0, 40, BH);
      }
    }

    // Cut into cols x rows; the last column/row absorbs the rounding remainder
    // so pieces tile with no seams.
    const baseW = Math.floor(BW / this.cols);
    const baseH = Math.floor(BH / this.rows);
    this.pieces = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const sw = c === this.cols - 1 ? BW - baseW * c : baseW;
        const sh = r === this.rows - 1 ? BH - baseH * r : baseH;
        const sx = baseW * c;
        const sy = baseH * r;
        this.pieces.push({ sx, sy, sw, sh, homeX: BX + sx, homeY: BY + sy, x: 0, y: 0, placed: false });
      }
    }

    // Scatter in the right-hand gutter, avoiding overlap where it fits.
    const placed = [];
    for (const p of shuffle([...this.pieces])) {
      const maxX = Math.max(GX0, GX1 - p.sw);
      const maxY = Math.max(GY0, GY1 - p.sh);
      let spot = null;
      for (let t = 0; t < 40; t++) {
        const cand = { x: rand(GX0, maxX), y: rand(GY0, maxY), w: p.sw, h: p.sh };
        if (!placed.some((q) => overlaps(cand, q))) { spot = cand; break; }
        spot = cand; // keep the last try as a fallback if the gutter is crowded
      }
      p.x = spot.x;
      p.y = spot.y;
      placed.push({ x: p.x, y: p.y, w: p.sw, h: p.sh });
    }
    this._drag = null;
  }

  onPointer(ev) {
    if (ev.type === "pointerdown" && ev.button === 0) {
      for (let i = this.pieces.length - 1; i >= 0; i--) {
        const p = this.pieces[i];
        if (!p.placed && ev.x >= p.x && ev.x <= p.x + p.sw && ev.y >= p.y && ev.y <= p.y + p.sh) {
          this._drag = p;
          this._off = { x: ev.x - p.x, y: ev.y - p.y };
          this.pieces.splice(i, 1);
          this.pieces.push(p); // render on top
          break;
        }
      }
    } else if (ev.type === "pointermove" && this._drag) {
      this._drag.x = ev.x - this._off.x;
      this._drag.y = ev.y - this._off.y;
    } else if ((ev.type === "pointerup" || ev.type === "pointercancel") && this._drag) {
      const p = this._drag;
      this._drag = null;
      if (Math.hypot(p.x - p.homeX, p.y - p.homeY) <= SNAP) {
        p.x = p.homeX;
        p.y = p.homeY;
        p.placed = true;
        this.score++;
        this.engine.sound?.("sounds/dragdrop.ogg");
      }
    }
  }

  isRoundWon() {
    return this.pieces.length > 0 && this.pieces.every((p) => p.placed);
  }

  paint(ctx) {
    // faint ghost of the finished picture + board outline
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.drawImage(this._board, BX, BY, BW, BH);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BX, BY, BW, BH);

    for (const p of this.pieces) {
      ctx.drawImage(this._board, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.sw, p.sh);
      if (!p.placed) {
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.sw - 1, p.sh - 1);
      }
    }
  }
}
