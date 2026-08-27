// Boot + main menu + scene wiring.  Counterpart of src/main.py.

import { ASSETS, Engine, VH, VW } from "./engine.js";
import { ACTIVITIES } from "./games/index.js";

const MENU_ART = {
  move: ["images/menu-move1.png", "images/menu-move.png"],
  click: ["images/menu-click1.png", "images/menu-click.png"],
  dblclick: ["images/menu-dblclick1.png", "images/menu-dblclick.png"],
  drag: ["images/menu-puzzle1.png", "images/menu-puzzle.png"],
  buttons: ["images/menu-button1.png", "images/menu-button.png"],
  quit: ["images/menu-quit.png", "images/menu-quitter.png"],
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
    this.title = engine.image("images/logo.png") || engine.image("images/pysycache.png");
    this._build();
    engine.music?.("sounds/startup.ogg", { loop: true });
  }

  _build() {
    const items = ACTIVITIES.map((cls) => ({ key: cls.id, action: () => this._play(cls) }));
    items.push({ key: "quit", action: () => this._quit() });

    this.buttons = items.map((it) => {
      const [faceRel, hoverRel] = MENU_ART[it.key];
      const face = this.engine.image(faceRel);
      const hover = this.engine.image(hoverRel) || face;
      const w = face?.naturalWidth || 240;
      const h = face?.naturalHeight || 60;
      return { ...it, face, hover, w, h, x: 0, y: 0 };
    });

    const gap = 14;
    const total = this.buttons.reduce((s, b) => s + b.h, 0) + gap * (this.buttons.length - 1);
    let y = Math.max(150, (VH - total) / 2 + 40);
    for (const b of this.buttons) {
      b.x = (VW - b.w) / 2;
      b.y = y;
      y += b.h + gap;
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

  _quit() {
    // No process to exit in a browser; just show a blank calm screen.
    this.engine.setScene({ render: (ctx) => { ctx.fillStyle = "#0d1b2a"; ctx.fillRect(0, 0, VW, VH); } });
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
    if (this.title) ctx.drawImage(this.title, (VW - this.title.width) / 2, 24);
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
  engine.preloadSounds?.(ASSETS.core.sounds);

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
