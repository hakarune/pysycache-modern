// Canvas, virtual-resolution scaling, asset loading, input and audio.
//
// Every scene draws in a fixed 800x600 "virtual" space; the engine sizes the
// real backing store for the device pixel ratio and lets CSS letter-box the
// canvas.  Pointer coordinates are mapped back into virtual space before they
// reach a scene, so scene code never thinks about the window size.

import CONST from "./constants.generated.js";
import MANIFEST from "./assets.generated.js";

export const VW = CONST.VIRTUAL_WIDTH;
export const VH = CONST.VIRTUAL_HEIGHT;
export const C = CONST;
export const ASSETS = MANIFEST;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scene = null;
    this.pointer = { x: VW / 2, y: VH / 2, down: false };
    this._images = new Map();
    this._buffers = new Map();
    this._cursor = null;
    this._events = [];
    this._raf = 0;
    this._last = 0;
    this._fade = null; // {dir:1|-1, t, dur, next}
    this._muted = false;
    this._crashed = null;

    this._audio = null; // lazily created on first gesture
    this._music = null;
    this._pendingMusic = null;

    this._rect = canvas.getBoundingClientRect();
    this._frame = this._frame.bind(this);
    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(this._resize).observe(canvas);
    }
    document.addEventListener("fullscreenchange", this._resize);
    this._resize();
    this._bindInput();
  }

  // -- display ---------------------------------------------------------------
  _resize() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    const rect = this.canvas.getBoundingClientRect();
    this._rect = rect;
    this.canvas.width = Math.max(1, Math.round((rect.width || VW) * dpr));
    this.canvas.height = Math.max(1, Math.round((rect.height || VH) * dpr));
    // Map the virtual 800x600 onto the (letter-boxed, ~4:3) backing store.
    this._sx = this.canvas.width / VW;
    this._sy = this.canvas.height / VH;
  }

  _toVirtual(clientX, clientY) {
    const r = this._rect;
    return {
      x: clamp(((clientX - r.left) / r.width) * VW, 0, VW),
      y: clamp(((clientY - r.top) / r.height) * VH, 0, VH),
    };
  }

  // -- input --------------------------------------------------------------- -
  _bindInput() {
    const push = (type, e, extra = {}) => {
      if (e.pointerType && e.isPrimary === false) return; // ignore extra touches
      const p = this._toVirtual(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this._events.push({ type, x: p.x, y: p.y, button: e.button ?? 0, ...extra });
    };
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture?.(e.pointerId);
      this.pointer.down = true;
      this._unlockAudio();
      push("pointerdown", e);
    });
    c.addEventListener("pointermove", (e) => {
      // segment info lets scenes fill gaps on a fast sweep
      const prev = { x: this.pointer.x, y: this.pointer.y };
      push("pointermove", e, { from: prev });
    });
    c.addEventListener("pointerup", (e) => { this.pointer.down = false; push("pointerup", e); });
    c.addEventListener("pointercancel", (e) => { this.pointer.down = false; push("pointercancel", e); });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      // kiosk: Esc leaves an activity, Tab cycles theme, F11 is the browser's
      if (["Escape", "Tab", "F11"].includes(e.key)) e.preventDefault();
      this._events.push({ type: "key", key: e.key });
    });
  }

  _drainEvents() {
    const evs = this._events;
    this._events = [];
    return evs;
  }

  // -- assets -------------------------------------------------------------- -
  assetURL(rel) {
    return new URL(`../assets/${rel}`, import.meta.url).href;
  }

  image(rel) {
    return this._images.get(rel) || null;
  }

  async loadImages(list, onProgress) {
    const need = [...new Set(list)].filter((r) => r && !this._images.has(r));
    let done = 0;
    await Promise.all(
      need.map(async (rel) => {
        try {
          const img = new Image();
          img.src = this.assetURL(rel);
          await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
          this._images.set(rel, img);
        } catch {
          this._images.set(rel, null); // record the miss, keep going
        }
        done++;
        onProgress?.(done, need.length);
      }),
    );
  }

  // -- audio ------------------------------------------------------------- ---
  _unlockAudio() {
    if (this._audio) { if (this._audio.state === "suspended") this._audio.resume(); return; }
    try {
      this._audio = new (window.AudioContext || window.webkitAudioContext)();
      this._music = this._audio.createGain();
      this._music.gain.value = 0.6;
      this._music.connect(this._audio.destination);
    } catch { this._audio = null; return; }
    if (this._pendingPreload) this.preloadSounds(this._pendingPreload);
    if (this._pendingMusic) this.music(this._pendingMusic.rel, this._pendingMusic.opts);
  }

  async _buffer(rel) {
    if (!this._audio) return null;
    if (this._buffers.has(rel)) return this._buffers.get(rel);
    try {
      const res = await fetch(this.assetURL(rel));
      const buf = await this._audio.decodeAudioData(await res.arrayBuffer());
      this._buffers.set(rel, buf);
      return buf;
    } catch {
      this._buffers.set(rel, null);
      return null;
    }
  }

  preloadSounds(list) {
    // No audio context until the first gesture; remember what to warm up then.
    if (!this._audio) { this._pendingPreload = list; return; }
    Promise.all([...new Set(list)].filter(Boolean).map((r) => this._buffer(r)));
  }

  async sound(rel) {
    if (this._muted || !this._audio || !rel) return;
    const buf = await this._buffer(rel);
    if (!buf) return;
    const src = this._audio.createBufferSource();
    src.buffer = buf;
    src.connect(this._audio.destination);
    src.start();
  }

  async music(rel, opts = {}) {
    const { loop = true } = opts;
    if (!this._audio) { this._pendingMusic = { rel, opts }; return; }
    this.stopMusic();
    if (this._muted || !rel) return;
    const tok = (this._musicTok = {});
    const buf = await this._buffer(rel);
    if (this._musicTok !== tok || this._muted || !buf) return; // stopped/superseded while decoding
    const src = this._audio.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(this._music);
    src.start();
    this._musicSrc = src;
  }

  stopMusic() {
    this._musicTok = {}; // invalidates any in-flight music() past its await
    this._pendingMusic = null;
    try { this._musicSrc?.stop(); } catch { /* already stopped */ }
    this._musicSrc = null;
  }

  // -- scenes / loop ---------------------------------------------------------
  setScene(scene, { fade = false } = {}) {
    if (!fade || !this.scene) {
      this._activate(scene);
      return;
    }
    this._fade = { dir: 1, t: 0, dur: 0.22, next: scene };
  }

  _activate(scene) {
    this.scene = scene;
    Promise.resolve(scene.enter?.(this)).catch((e) => this._crash(e));
  }

  start(scene) {
    this._activate(scene);
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }

  _crash(err) {
    console.error(err);
    this._crashed = String(err && err.stack ? err.stack : err);
  }

  _frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;

    // Keep the loop alive after a crash: a resize clears the backing store, so
    // we must repaint the error each frame or it goes blank again.
    if (this._crashed) {
      this._drainEvents();
      const { ctx } = this;
      ctx.save();
      ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
      this._paintCrash(ctx);
      ctx.restore();
      return;
    }

    try {
      const events = this._drainEvents();
      if (!this._fade) {
        for (const ev of events) this.scene?.handleEvent?.(ev, this);
        this.scene?.update?.(dt, this);
      } else {
        this._fade.t += dt;
        if (this._fade.dir === 1 && this._fade.t >= this._fade.dur) {
          this._activate(this._fade.next);
          this._fade = { dir: -1, t: 0, dur: this._fade.dur };
        } else if (this._fade.dir === -1 && this._fade.t >= this._fade.dur) {
          this._fade = null;
        }
      }
    } catch (e) {
      this._crash(e);
    }

    const { ctx } = this;
    ctx.save();
    ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    if (this._crashed) {
      this._paintCrash(ctx);
    } else {
      try {
        this.scene?.render?.(ctx, this);
        this._drawCursor(ctx);
      } catch (e) {
        this._crash(e);
        this._paintCrash(ctx);
      }
      if (this._fade) {
        const f = this._fade;
        const a = f.dir === 1 ? f.t / f.dur : 1 - f.t / f.dur;
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, VW, VH);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  _paintCrash(ctx) {
    ctx.fillStyle = "#780000";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#fff";
    ctx.font = this.font(16);
    ctx.textBaseline = "top";
    (this._crashed || "error").split("\n").slice(0, 16).forEach((line, i) => {
      ctx.fillText(line.slice(0, 96), 16, 20 + i * 22);
    });
  }

  setCursor(rel) {
    this._cursor = rel;
  }

  _drawCursor(ctx) {
    const img = this._cursor && this.image(this._cursor);
    if (!img) return;
    const x = clamp(this.pointer.x, 0, VW - img.width);
    const y = clamp(this.pointer.y, 0, VH - img.height);
    ctx.drawImage(img, x, y);
  }

  // -- misc ---------------------------------------------------------------- -
  font(px) {
    return `${px}px "PySy", system-ui, sans-serif`;
  }
}
