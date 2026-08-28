// Shared scaffolding for the five activities -- the JS counterpart of
// src/games/base.py.  main.js owns the single requestAnimationFrame loop; an
// Activity is just a scene with update()/render()/handleEvent().

import { ASSETS, C, VH, VW } from "../engine.js";

export const MARGIN_LEFT = C.MARGIN_LEFT;
export const MARGIN_TOP = C.MARGIN_TOP;
export const PLAY_W = C.PLAY_WIDTH;
export const PLAY_H = C.PLAY_HEIGHT;

const REDUCED_MOTION =
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function fitDown(w, h, maxEdge) {
  const s = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

export function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function randInt(lo, hi) {
  return Math.floor(rand(lo, hi + 1));
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Activity {
  // subclasses set these
  static id = "activity";
  static suffix = "";
  static bg = "menu";
  static title = "Activity";

  constructor(engine, { level = "medium", onExit } = {}) {
    this.engine = engine;
    this.level = level;
    this.onExit = onExit || (() => {});
    this.score = 0;
    this.rounds = 0;
    this._state = "loading"; // loading | intro | playing | celebrate
    this._t = 0;
    const cls = this.constructor;
    this.themes = Object.keys(ASSETS.themes[cls.suffix] || {});
    this.themeName = this.themes[0] || null;
    this.controls = this._buildControls();
  }

  get themeData() {
    return ASSETS.themes[this.constructor.suffix]?.[this.themeName] || {};
  }

  // -- lifecycle ----------------------------------------------------------- -
  async enter(engine) {
    this.engine = engine;
    engine.setCursor("images/souris.png");
    await engine.loadImages([`images/fond-${this.constructor.bg}.png`, "images/souris.png", "images/gagne.png"]);
    await this._loadTheme();
    this._begin();
  }

  themeAssetList(data) {
    return [data.logo].filter(Boolean);
  }

  async _loadTheme() {
    const data = this.themeData;
    await this.engine.loadImages(this.themeAssetList(data));
  }

  _begin() {
    this.startRound();
    this._state = REDUCED_MOTION ? "playing" : "intro";
    this._t = 0;
    this.engine.sound?.("sounds/transition.ogg");
  }

  async _cycleTheme() {
    if (this.themes.length < 2) return;
    const i = (this.themes.indexOf(this.themeName) + 1) % this.themes.length;
    this.themeName = this.themes[i];
    this._state = "loading";
    await this._loadTheme();
    this.startRound();
    this._state = "playing";
  }

  // -- scene interface --------------------------------------------------- ---
  handleEvent(ev) {
    if (ev.type === "key") {
      if (ev.key === "Escape") this.onExit();
      else if (ev.key === "Tab") this._cycleTheme();
      return;
    }
    if (ev.type === "pointerdown" && ev.button === 0) {
      const hit = this.controls.find(
        (b) => ev.x >= b.x && ev.x <= b.x + b.w && ev.y >= b.y && ev.y <= b.y + b.h,
      );
      if (hit) {
        this.engine.sound?.("sounds/btnmenu.wav");
        if (hit.id === "menu") this.onExit();
        else this._cycleTheme();
        return;
      }
    }
    if (this._state === "playing") this.onPointer(ev);
  }

  // On-screen equivalents of the [Esc] / [Tab] keys, for touch devices with
  // no keyboard.  They sit in the strip below the 720x540 play area, so they
  // never overlap gameplay; desktop keeps the keyboard shortcuts too.
  _buildControls() {
    const W = 120;
    const H = 48;
    const GAP = 8;
    const y = VH - H - 4;
    const out = [];
    let x = VW - GAP - W;
    out.push({ id: "menu", label: "← Menu", x, y, w: W, h: H });
    if (this.themes.length >= 2) {
      x -= GAP + W;
      out.push({ id: "theme", label: "Theme ↻", x, y, w: W, h: H });
    }
    return out;
  }

  _drawControls(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = this.engine.font(18);
    for (const b of this.controls) {
      ctx.fillStyle = "rgba(20,40,60,0.62)";
      roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.fillStyle = "#eaf2fb";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
    ctx.restore();
  }

  update(dt) {
    this._t += dt;
    if (this._state === "intro") {
      if (this._t >= 0.35) { this._state = "playing"; this._t = 0; }
    } else if (this._state === "celebrate") {
      if (this._t >= 1.2) { this.rounds++; this._t = 0; this._state = "playing"; this.startRound(); }
    } else if (this._state === "playing") {
      this.step(dt);
      if (this.isRoundWon()) this._win();
    }
  }

  render(ctx) {
    const bg = this.engine.image(`images/fond-${this.constructor.bg}.png`);
    if (bg) ctx.drawImage(bg, 0, 0, VW, VH);
    else { ctx.fillStyle = "#1e3c5a"; ctx.fillRect(0, 0, VW, VH); }

    // enter() loads assets asynchronously; nothing to paint until startRound ran
    if (this._state !== "loading") {
      this.paint(ctx);
      this._drawHUD(ctx);

      if (this._state === "intro") {
        const p = Math.min(1, this._t / 0.35);
        ctx.fillStyle = "#0d1b2a";
        ctx.fillRect(0, VH * p, VW, VH * (1 - p));
      }
      if (this._state === "celebrate") {
        const g = this.engine.image("images/gagne.png");
        if (g) ctx.drawImage(g, (VW - g.width) / 2, (VH - g.height) / 2);
      }
    }

    // Always on top and always tappable -- a child must be able to leave even
    // mid-intro or during the win animation.
    this._drawControls(ctx);
  }

  _win() {
    this.engine.sound?.("sounds/youpee.ogg");
    this._state = "celebrate";
    this._t = 0;
  }

  _drawHUD(ctx) {
    const txt = `${this.constructor.title}   theme: ${this.themeName || "-"}   score: ${this.score}`;
    ctx.font = this.engine.font(18);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillText(txt, 13, VH - 13);
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, 12, VH - 14);
  }

  // -- helpers for subclasses --------------------------------------------- -
  randomPointInPlay(margin = 60) {
    return {
      x: randInt(MARGIN_LEFT + margin, MARGIN_LEFT + PLAY_W - margin),
      y: randInt(MARGIN_TOP + margin, MARGIN_TOP + PLAY_H - margin),
    };
  }

  // -- hooks (override) --------------------------------------------------- -
  startRound() {}
  onPointer(_ev) {}
  step(_dt) {}
  paint(_ctx) {}
  isRoundWon() { return false; }
}
