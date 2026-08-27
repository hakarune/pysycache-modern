// Boot + main menu + scene wiring.  Counterpart of src/main.py.

import { ASSETS, Engine, VH, VW } from "./engine.js";
import { ACTIVITIES } from "./games/index.js";

// face (idle) / hover art per activity.  No Quit entry: a browser tab has no
// process to exit, and a dead-end "quit" screen is worse than none.
const MENU_ART = {
  move: ["images/menu-move1.png", "images/menu-move.png"],
  click: ["images/menu-click1.png", "images/menu-click.png"],
  dblclick: ["images/menu-dblclick1.png", "images/menu-dblclick.png"],
  drag: ["images/menu-puzzle1.png", "images/menu-puzzle.png"],
  buttons: ["images/menu-button1.png", "images/menu-button.png"],
};

class Menu {
  constructor(engine, level) {
    this.engine = engine;
    this.level = level;
    this.buttons = [];
    this._hover = null;
  }

  enter(engine) {
    engine.setCursor("images/souris.png");
    this.bg = engine.image("images/fond-menu.png");
    this._build();
    engine.music?.("sounds/startup.ogg", { loop: true });
    if (typeof window !== "undefined") window.__menu = this; // test/debug hook
  }

  _build() {
    const items = ACTIVITIES.map((cls) => ({ key: cls.id, action: () => this._play(cls) }));

    this.buttons = items.map((it) => {
      const [faceRel, hoverRel] = MENU_ART[it.key];
      const face = this.engine.image(faceRel);
      const hover = this.engine.image(hoverRel) || face;
      return { ...it, face, hover, aspect: (face?.naturalWidth || 1) / (face?.naturalHeight || 1) };
    });

    // Vertical column of the (100x100) art, scaled down if needed so the whole
    // column fits with a comfortable margin top and bottom.
    const gap = 18;
    const margin = 40;
    const n = this.buttons.length;
    const size = Math.min(100, (VH - 2 * margin - gap * (n - 1)) / n);
    let y = (VH - (size * n + gap * (n - 1))) / 2;
    for (const b of this.buttons) {
      b.h = size;
      b.w = size * b.aspect;
      b.x = (VW - b.w) / 2;
      b.y = y;
      y += size + gap;
    }
  }

  _play(cls) {
    this.engine.stopMusic?.();
    this.engine.setScene(
      new cls(this.engine, { level: this.level, onExit: () => this._back() }),
      { fade: true },
    );
  }

  _back() {
    this.engine.setScene(new Menu(this.engine, this.level), { fade: true });
  }

  handleEvent(ev) {
    if (ev.type === "pointermove") {
      const b = this._at(ev.x, ev.y);
      if (b !== this._hover) {
        this._hover = b;
        if (b) this.engine.sound?.("sounds/btnmenu.wav");
      }
    } else if (ev.type === "pointerdown" && ev.button === 0) {
      const b = this._at(ev.x, ev.y);
      if (b) b.action();
    }
  }

  _at(x, y) {
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }

  update() {}

  render(ctx) {
    if (this.bg) ctx.drawImage(this.bg, 0, 0, VW, VH);
    else { ctx.fillStyle = "#19375a"; ctx.fillRect(0, 0, VW, VH); }
    for (const b of this.buttons) {
      const img = b === this._hover ? b.hover : b.face;
      if (img) ctx.drawImage(img, b.x, b.y, b.w, b.h);
    }
  }
}

// ---------------------------------------------------------------------------
async function boot() {
  const canvas = document.getElementById("game");
  const bootEl = document.getElementById("boot");
  const barEl = bootEl.querySelector("i");
  const engine = new Engine(canvas);

  const core = [...ASSETS.core.images];
  await engine.loadImages(core, (done, total) => {
    barEl.style.width = `${Math.round((done / total) * 100)}%`;
  });
  engine.preloadSounds?.(ASSETS.core.sounds); // warmed up on the first gesture
  try { await document.fonts?.load('bold 18px "PySy"'); } catch { /* FOUT is fine */ }

  bootEl.classList.add("hidden");
  const level = new URLSearchParams(location.search).get("level") || "medium";
  engine.start(new Menu(engine, ["easy", "medium", "hard"].includes(level) ? level : "medium"));

  document.getElementById("fs").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.getElementById("stage").requestFullscreen?.();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () =>
      navigator.serviceWorker
        .register(new URL("../sw.js", import.meta.url), { type: "module" })
        .catch(() => {}),
    );
  }
}

boot();
