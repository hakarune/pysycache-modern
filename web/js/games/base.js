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
    if (this._state === "playing") this.onPointer(ev);
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

  _win() {
    for (const s of ["sounds/youpee.ogg", "sounds/yahoo.ogg", "sounds/rire.ogg"]) { this.engine.sound?.(s); break; }
    this._state = "celebrate";
    this._t = 0;
  }

  _drawHUD(ctx) {
    const txt = `${this.constructor.title}   theme: ${this.themeName || "-"}   score: ${this.score}   [Esc] menu  [Tab] theme`;
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
