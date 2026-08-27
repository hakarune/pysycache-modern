// Buttons activity -- press every themed button once.
// Counterpart of src/games/buttons.py.

import { C } from "../engine.js";
import { Activity, MARGIN_LEFT, MARGIN_TOP, PLAY_H, PLAY_W, fitDown, shuffle } from "./base.js";

export class ButtonsActivity extends Activity {
  static id = "buttons";
  static suffix = "buttons";
  static bg = "buttons";
  static title = "Buttons";

  themeAssetList(data) {
    const out = [data.logo];
    for (const b of data.buttons || []) out.push(b.rest, b.pressed);
    return out.filter(Boolean);
  }

  startRound() {
    const pairs = shuffle([...(this.themeData.buttons || [])]);
    const want = C.BUTTON_COUNT[this.level] ?? 5;
    const cols = Math.min(want, 4);
    const rows = Math.ceil(want / cols);
    const cellW = PLAY_W / cols;
    const cellH = PLAY_H / (rows + 1);

    this.buttons = [];
    for (let i = 0; i < want; i++) {
      const pair = pairs.length ? pairs[i % pairs.length] : null;
      const rest = pair && this.engine.image(pair.rest);
      const pressed = (pair && this.engine.image(pair.pressed)) || rest;
      const nw = rest?.naturalWidth || 90;
      const nh = rest?.naturalHeight || 60;
      const { w, h } = fitDown(nw, nh, C.BUTTON_MAX_EDGE);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = MARGIN_LEFT + cellW * col + cellW / 2;
      const cy = MARGIN_TOP + cellH * (row + 1) + cellH / 2;
      this.buttons.push({ rest, pressed, x: cx - w / 2, y: cy - h / 2, w, h, on: false });
    }
  }

  onPointer(ev) {
    if (ev.type !== "pointerdown" || ev.button !== 0) return;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (!b.on && ev.x >= b.x && ev.x <= b.x + b.w && ev.y >= b.y && ev.y <= b.y + b.h) {
        b.on = true;
        this.score++;
        this.engine.sound?.("sounds/btncoche.ogg");
        break;
      }
    }
  }

  isRoundWon() {
    return this.buttons && this.buttons.length > 0 && this.buttons.every((b) => b.on);
  }

  paint(ctx) {
    for (const b of this.buttons) {
      const img = b.on ? b.pressed : b.rest;
      if (img) ctx.drawImage(img, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = b.on ? "#5aaa5a" : "#aaaa5a";
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
    }
  }
}
