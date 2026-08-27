// Drag activity -- drag scattered pieces back into the picture.
// Counterpart of src/games/drag.py.  Pieces are sliced from one offscreen
// board canvas at round start; no pre-cut piece files.

import { C } from "../engine.js";
import { Activity, MARGIN_LEFT, MARGIN_TOP, PLAY_H, PLAY_W, shuffle } from "./base.js";

const BW = C.BOARD_W;
const BH = C.BOARD_H;
const BX = MARGIN_LEFT + C.BOARD_DX;
const BY = MARGIN_TOP + C.BOARD_DY;
const SNAP = C.SNAP_DISTANCE;

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

    // Scatter start positions down the right-hand gutter.
    const gutterX = MARGIN_LEFT + PLAY_W - baseW - 12;
    const slots = shuffle(this.pieces.map((_, i) => i));
    const n = this.pieces.length;
    this.pieces.forEach((p, i) => {
      const slot = slots[i];
      p.x = gutterX;
      p.y = MARGIN_TOP + 20 + slot * ((PLAY_H - 40 - baseH) / Math.max(1, n - 1));
    });
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
      const dx = p.x - p.homeX;
      const dy = p.y - p.homeY;
      if (Math.hypot(dx, dy) <= SNAP) {
        p.x = p.homeX;
        p.y = p.homeY;
        p.placed = true;
        this.score++;
        this.engine.sound?.("sounds/dragdrop.ogg");
      }
    }
  }

  isRoundWon() {
    return this.pieces && this.pieces.length > 0 && this.pieces.every((p) => p.placed);
  }

  paint(ctx) {
    // faint ghost of the finished picture + slot outlines
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
