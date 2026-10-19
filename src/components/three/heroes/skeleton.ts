/** Website skeletons drawn on canvas – used as screens of the 3D devices and portfolio frames. */
import * as THREE from "three";

const W = 1024;
const H = 710;

export type Ctx = CanvasRenderingContext2D;

const INK = "#b8c8c9";
const INK_SOFT = "#dfe8e8";
const TEAL = "#028D86";
const MINT = "#9fdcd5";
const PETROL = "#025159";

export function bar(c: Ctx, x: number, y: number, w: number, h: number, color = INK, r = h / 2) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

function nav(c: Ctx, dark = false) {
  c.fillStyle = dark ? PETROL : "#ffffff";
  c.fillRect(0, 0, W, 78);
  bar(c, 44, 26, 26, 26, dark ? "#ffffff" : TEAL, 8);
  bar(c, 82, 32, 92, 14, dark ? "rgba(255,255,255,.85)" : INK);
  [0, 1, 2, 3].forEach((i) => bar(c, 520 + i * 92, 33, 66, 12, dark ? "rgba(255,255,255,.45)" : INK));
  bar(c, 900, 22, 84, 34, dark ? "#ffffff" : TEAL, 17);
}

/** Classic agency layout: text left, image right, three cards. */
export function layoutA(c: Ctx) {
  nav(c);
  bar(c, 44, 130, 380, 34, PETROL, 10);
  bar(c, 44, 178, 300, 34, PETROL, 10);
  bar(c, 44, 236, 360, 14);
  bar(c, 44, 260, 320, 14);
  bar(c, 44, 284, 340, 14);
  bar(c, 44, 330, 150, 44, TEAL, 22);
  bar(c, 206, 330, 120, 44, INK_SOFT, 22);
  bar(c, 500, 120, 480, 290, MINT, 22);
  bar(c, 640, 205, 200, 120, "rgba(255,255,255,.65)", 16);
  [0, 1, 2].forEach((i) => {
    const x = 44 + i * 320;
    bar(c, x, 460, 296, 210, INK_SOFT, 18);
    bar(c, x + 24, 484, 52, 52, MINT, 14);
    bar(c, x + 24, 556, 180, 16, INK);
    bar(c, x + 24, 586, 240, 12, INK);
    bar(c, x + 24, 608, 200, 12, INK);
  });
}

/** Shop layout: dark nav, wide banner, product grid. */
export function layoutB(c: Ctx) {
  nav(c, true);
  bar(c, 44, 110, 936, 220, "#e3f3f1", 22);
  bar(c, 90, 168, 360, 32, PETROL, 10);
  bar(c, 90, 214, 280, 14);
  bar(c, 90, 258, 140, 40, TEAL, 20);
  bar(c, 640, 136, 300, 170, MINT, 18);
  [0, 1, 2, 3].forEach((i) => {
    const x = 44 + i * 238;
    bar(c, x, 360, 214, 200, INK_SOFT, 18);
    bar(c, x + 18, 378, 178, 120, MINT, 12);
    bar(c, x + 18, 514, 120, 14, INK);
    bar(c, x + 18, 538, 70, 12, TEAL);
  });
  bar(c, 44, 600, 936, 80, PETROL, 18);
  bar(c, 80, 630, 260, 16, "rgba(255,255,255,.6)");
  bar(c, 820, 622, 124, 34, "#ffffff", 17);
}

/** Service layout: centred hero, stats row, text + image. */
export function layoutC(c: Ctx) {
  nav(c);
  bar(c, 262, 128, 500, 36, PETROL, 10);
  bar(c, 332, 178, 360, 36, PETROL, 10);
  bar(c, 312, 236, 400, 14);
  bar(c, 352, 260, 320, 14);
  bar(c, 402, 300, 220, 46, TEAL, 23);
  [0, 1, 2].forEach((i) => {
    const x = 120 + i * 270;
    bar(c, x, 386, 250, 96, INK_SOFT, 16);
    bar(c, x + 24, 410, 80, 26, TEAL, 8);
    bar(c, x + 24, 450, 150, 12, INK);
  });
  bar(c, 44, 520, 440, 160, MINT, 20);
  bar(c, 530, 534, 300, 22, PETROL, 8);
  bar(c, 530, 574, 420, 13);
  bar(c, 530, 597, 380, 13);
  bar(c, 530, 620, 400, 13);
}

/** Draws a skeleton onto a canvas and returns it as a texture (desktop size by default). */
export function skeletonTexture(draw: (c: Ctx) => void, w = W, h = H) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f6f8f8";
  c.fillRect(0, 0, w, h);
  draw(c);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Phone layout (600 × 1200): compact header with menu, stacked hero, image, cards. */
export function layoutPhone(c: Ctx) {
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 600, 120);
  bar(c, 36, 44, 34, 34, TEAL, 10);
  bar(c, 82, 52, 120, 18);
  [0, 1, 2].forEach((i) => bar(c, 500, 44 + i * 14, 56, 6, INK, 3));
  bar(c, 36, 170, 470, 40, PETROL, 12);
  bar(c, 36, 224, 380, 40, PETROL, 12);
  bar(c, 36, 290, 510, 18);
  bar(c, 36, 320, 460, 18);
  bar(c, 36, 372, 230, 60, TEAL, 30);
  bar(c, 36, 470, 528, 300, MINT, 26);
  bar(c, 200, 570, 200, 100, "rgba(255,255,255,.65)", 18);
  [0, 1].forEach((i) => {
    const y = 806 + i * 196;
    bar(c, 36, y, 528, 176, INK_SOFT, 22);
    bar(c, 64, y + 28, 64, 64, MINT, 16);
    bar(c, 150, y + 34, 260, 20);
    bar(c, 150, y + 70, 340, 14);
    bar(c, 150, y + 96, 300, 14);
  });
}

/** Tablet layout (900 × 1200): header, hero with image, two-column cards. */
export function layoutTablet(c: Ctx) {
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 900, 100);
  bar(c, 44, 34, 32, 32, TEAL, 10);
  bar(c, 88, 42, 110, 16);
  [0, 1, 2].forEach((i) => bar(c, 470 + i * 96, 44, 70, 12));
  bar(c, 770, 30, 90, 40, TEAL, 20);
  bar(c, 44, 150, 560, 40, PETROL, 12);
  bar(c, 44, 204, 440, 40, PETROL, 12);
  bar(c, 44, 272, 620, 16);
  bar(c, 44, 300, 560, 16);
  bar(c, 44, 350, 200, 54, TEAL, 27);
  bar(c, 44, 446, 812, 330, MINT, 26);
  bar(c, 330, 556, 240, 110, "rgba(255,255,255,.65)", 18);
  [0, 1, 2, 3].forEach((i) => {
    const x = 44 + (i % 2) * 418;
    const y = 812 + Math.floor(i / 2) * 190;
    bar(c, x, y, 394, 170, INK_SOFT, 20);
    bar(c, x + 26, y + 26, 56, 56, MINT, 14);
    bar(c, x + 26, y + 102, 220, 16);
    bar(c, x + 26, y + 130, 300, 12);
  });
}
