// Building blocks for the standee level looks (ar/themes.ts): canvas-drawn textures, simple props and
// a small sprite particle system. No image files and no new art of Duo: only shapes, glyphs and light
// placed AROUND the official pose.
//
// Two spaces (set up by ar/standee.ts):
//   "card"  = the standee's pivot: origin at the card's bottom edge (Duo's feet), +Y up the card,
//             +Z towards the viewer; it leans and turns with the card. Duo fills about y 0 … 0.62.
//   "paper" = flat on the poster, origin at the standee's base point, +Y up the poster.
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  sRGBEncoding,
  type Object3D,
  type Texture,
} from "three";
import { BRAND, DET } from "../config/brand";

/** The brand's headline face (Feather Bold), then its display face (CLAUDE.md rule 8: fonts from brand.ts). */
export const FONT_STACK = `${BRAND.headlineFontFamily.split(",")[0]}, ${BRAND.displayFontFamily}`;

/** DET kit colours by short name — all from brand.ts's DET palette (CLAUDE.md rule 8). */
export const K = {
  OWL: DET.owl,
  FROG: DET.treeFrog,
  MASK: DET.maskGreen,
  TURTLE: DET.turtle,
  SPONGE: DET.seaSponge,
  MACAW: DET.macaw,
  WHALE: DET.whale,
  BLUEJAY: DET.bluejay,
  IGUANA: DET.iguana,
  CARDINAL: DET.cardinal,
  FIREANT: DET.fireAnt,
  FLAMINGO: DET.flamingo,
  FISH: DET.walkingFish,
  BEE: DET.bee,
  CAMEL: DET.camel,
  DUCK: DET.duck,
  CANARY: DET.canary,
  FOX: DET.fox,
  GUINEA: DET.guineaPig,
  BEETLE: DET.beetle,
  BETTA: DET.betta,
  HUMPBACK: DET.humpback,
  NARWHAL: DET.narwhal,
  MANTA: DET.mantaRay,
  EEL: DET.eel,
  WOLF: DET.wolf,
  HARE: DET.hare,
  SWAN: DET.swan,
  POLAR: DET.polar,
  WHITE: DET.snow,
} as const;

// ---------------------------------------------------------------- canvas + textures

export function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

export function tex(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.encoding = sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

/** Rounded rectangle path (roundRect is missing on older Safari). */
export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

const memo = new Map<string, Texture>();
/** A texture drawn once per app session. */
export function once(key: string, draw: () => HTMLCanvasElement): Texture {
  let t = memo.get(key);
  if (!t) {
    t = tex(draw());
    memo.set(key, t);
  }
  return t;
}

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const frac = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface Fx {
  object: Object3D;
  /** t = seconds; flare = 0 … 1 right after a level-up (everything flares, then settles). */
  update(t: number, flare: number): void;
}

type MatOpts = ConstructorParameters<typeof MeshBasicMaterial>[0];
/** Effects ignore depth and draw in renderOrder, so a lean or turn never hides them. */
export const fxMat = (map: Texture, o: MatOpts = {}) =>
  new MeshBasicMaterial({ map, transparent: true, depthWrite: false, depthTest: false, ...o });

export function plane(map: Texture, w: number, h: number, o: MatOpts = {}, order = 2): Mesh {
  const m = new Mesh(new PlaneGeometry(w, h), fxMat(map, o));
  m.renderOrder = order;
  return m;
}

const opacity = (m: Mesh | Sprite, v: number) => ((m.material as MeshBasicMaterial).opacity = clamp01(v));

// ---------------------------------------------------------------- glyphs (128 px unless noted)

function glyph(key: string, draw: (g: CanvasRenderingContext2D) => void, w = 128, h = 128) {
  return once(key, () => {
    const [c, g] = canvas(w, h);
    draw(g);
    return c;
  });
}

/** White outline + fill: reads on any poster. */
function outlined(g: CanvasRenderingContext2D, fill: string | CanvasGradient, line = 8) {
  g.lineJoin = "round";
  g.lineWidth = line;
  g.strokeStyle = "#FFFFFF";
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

export const glyphs = {
  text: (ch: string, color: string, size = 92) =>
    glyph(`t:${ch}:${color}:${size}`, (g) => {
      g.font = `800 ${size}px ${FONT_STACK}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 14;
      g.strokeStyle = "#FFFFFF";
      g.strokeText(ch, 64, 68);
      g.fillStyle = color;
      g.fillText(ch, 64, 68);
    }),
  /** A word on a white pill (512 × 128). */
  word: (w: string, color: string) =>
    glyph(
      `w:${w}:${color}`,
      (g) => {
        g.font = `800 64px ${FONT_STACK}`;
        const tw = Math.min(480, g.measureText(w).width + 56);
        g.fillStyle = "#FFFFFF";
        g.beginPath();
        rrect(g, 256 - tw / 2, 22, tw, 84, 42);
        g.fill();
        g.strokeStyle = color;
        g.lineWidth = 6;
        g.stroke();
        g.fillStyle = color;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(w, 256, 66);
      },
      512,
      128,
    ),
  heart: (color: string) =>
    glyph(`heart:${color}`, (g) => {
      g.translate(64, 64);
      g.beginPath();
      g.moveTo(0, 44);
      g.bezierCurveTo(-74, 0, -38, -58, 0, -22);
      g.bezierCurveTo(38, -58, 74, 0, 0, 44);
      g.closePath();
      outlined(g, color);
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.beginPath();
      g.ellipse(-24, -16, 9, 6, -0.6, 0, Math.PI * 2);
      g.fill();
    }),
  star: (color: string) =>
    glyph(`star:${color}`, (g) => {
      g.translate(64, 66);
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 24 : 54;
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      outlined(g, color, 7);
    }),
  sparkle: (color: string) =>
    glyph(`sparkle:${color}`, (g) => {
      g.translate(64, 64);
      g.fillStyle = color;
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        g.rotate(Math.PI / 2);
        g.moveTo(0, -60);
        g.quadraticCurveTo(6, -6, 60, 0);
        g.quadraticCurveTo(6, 6, 0, 60);
        g.quadraticCurveTo(-6, 6, -60, 0);
        g.quadraticCurveTo(-6, -6, 0, -60);
      }
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
    }),
  leaf: (color: string, vein: string) =>
    glyph(`leaf:${color}:${vein}`, (g) => {
      g.translate(64, 64);
      g.rotate(0.5);
      g.beginPath();
      g.moveTo(0, -56);
      g.quadraticCurveTo(50, 0, 0, 56);
      g.quadraticCurveTo(-50, 0, 0, -56);
      outlined(g, color, 6);
      g.strokeStyle = vein;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(0, -44);
      g.lineTo(0, 50);
      g.stroke();
    }),
  flower: (petal: string, middle: string) =>
    glyph(`flower:${petal}:${middle}`, (g) => {
      g.translate(64, 64);
      for (let k = 0; k < 5; k++) {
        g.rotate((Math.PI * 2) / 5);
        g.beginPath();
        g.ellipse(0, -30, 20, 30, 0, 0, Math.PI * 2);
        outlined(g, petal, 5);
      }
      g.beginPath();
      g.arc(0, 0, 18, 0, Math.PI * 2);
      outlined(g, middle, 5);
    }),
  /** Soft glowing dot (embers, fireworks, dust). */
  dot: (color: string) =>
    glyph(`dot:${color}`, (g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, "#FFFFFF");
      r.addColorStop(0.25, color);
      r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }),
  confetti: (color: string) =>
    glyph(`conf:${color}`, (g) => {
      g.fillStyle = color;
      g.beginPath();
      rrect(g, 46, 18, 36, 92, 8);
      g.fill();
    }),
  flame: () =>
    glyph("flame", (g) => {
      g.translate(64, 70);
      const lg = g.createLinearGradient(0, -60, 0, 50);
      lg.addColorStop(0, "rgba(255,75,75,0)");
      lg.addColorStop(0.25, K.CARDINAL);
      lg.addColorStop(0.6, K.FOX);
      lg.addColorStop(1, K.BEE);
      g.beginPath();
      g.moveTo(0, -60);
      g.bezierCurveTo(34, -18, 42, 18, 30, 36);
      g.quadraticCurveTo(0, 62, -30, 36);
      g.bezierCurveTo(-42, 18, -34, -18, 0, -60);
      g.fillStyle = lg;
      g.fill();
      g.beginPath();
      g.moveTo(0, -10);
      g.bezierCurveTo(16, 10, 18, 26, 12, 34);
      g.quadraticCurveTo(0, 46, -12, 34);
      g.bezierCurveTo(-18, 26, -16, 10, 0, -10);
      g.fillStyle = K.CANARY;
      g.fill();
    }),
  balloon: (color: string) =>
    glyph(
      `balloon:${color}`,
      (g) => {
        g.strokeStyle = K.WOLF;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(64, 140);
        g.bezierCurveTo(80, 180, 48, 210, 64, 252);
        g.stroke();
        g.beginPath();
        g.ellipse(64, 76, 48, 60, 0, 0, Math.PI * 2);
        outlined(g, color, 6);
        g.beginPath();
        g.moveTo(56, 140);
        g.lineTo(72, 140);
        g.lineTo(64, 132);
        g.fillStyle = color;
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.65)";
        g.beginPath();
        g.ellipse(46, 52, 10, 16, -0.5, 0, Math.PI * 2);
        g.fill();
      },
      128,
      256,
    ),
  cap: () =>
    glyph("cap", (g) => {
      g.translate(64, 60);
      g.beginPath();
      g.moveTo(-34, 6);
      g.lineTo(-30, 34);
      g.quadraticCurveTo(0, 46, 30, 34);
      g.lineTo(34, 6);
      g.closePath();
      outlined(g, "#2B2B2B", 6);
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(60, -4);
      g.lineTo(0, 22);
      g.lineTo(-60, -4);
      g.closePath();
      outlined(g, "#3A3A3A", 6);
      g.strokeStyle = K.BEE;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(0, -4);
      g.lineTo(40, 10);
      g.lineTo(40, 40);
      g.stroke();
      g.fillStyle = K.BEE;
      g.fillRect(34, 38, 12, 14);
    }),
  check: (color: string) =>
    glyph(`check:${color}`, (g) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(26, 66);
      g.lineTo(54, 94);
      g.lineTo(104, 34);
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 34;
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = 20;
      g.stroke();
    }),
  page: () =>
    glyph("page", (g) => {
      g.translate(64, 64);
      g.rotate(-0.15);
      g.fillStyle = "#FFFFFF";
      g.strokeStyle = K.SWAN;
      g.lineWidth = 4;
      g.beginPath();
      g.rect(-34, -46, 68, 92);
      g.fill();
      g.stroke();
      g.strokeStyle = K.HARE;
      g.lineWidth = 4;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(-24, -30 + k * 13);
        g.lineTo(k === 5 ? 6 : 24, -30 + k * 13);
        g.stroke();
      }
    }),
  coin: () =>
    glyph("coin", (g) => {
      g.beginPath();
      g.arc(64, 64, 54, 0, Math.PI * 2);
      outlined(g, K.CAMEL, 6);
      g.beginPath();
      g.arc(64, 64, 42, 0, Math.PI * 2);
      g.fillStyle = K.BEE;
      g.fill();
      g.font = `800 44px ${FONT_STACK}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = K.CAMEL;
      g.fillText("10", 64, 68);
    }),
  note: (color: string, double = false) =>
    glyph(`note:${color}:${double}`, (g) => {
      const head = (x: number, y: number) => {
        g.beginPath();
        g.ellipse(x, y, 17, 12, -0.4, 0, Math.PI * 2);
        outlined(g, color, 6);
      };
      g.lineCap = "round";
      const stem = (x: number, y1: number, y2: number) => {
        g.beginPath();
        g.moveTo(x, y1);
        g.lineTo(x, y2);
        g.strokeStyle = "#FFFFFF";
        g.lineWidth = 16;
        g.stroke();
        g.strokeStyle = color;
        g.lineWidth = 8;
        g.stroke();
      };
      if (double) {
        stem(52, 92, 30);
        stem(100, 80, 18);
        g.beginPath();
        g.moveTo(52, 30);
        g.lineTo(100, 18);
        g.strokeStyle = color;
        g.lineWidth = 14;
        g.stroke();
        head(40, 94);
        head(88, 82);
      } else {
        stem(78, 92, 22);
        g.beginPath();
        g.moveTo(78, 22);
        g.quadraticCurveTo(108, 40, 100, 66);
        g.strokeStyle = color;
        g.lineWidth = 8;
        g.stroke();
        head(66, 94);
      }
    }),
  /** Shooting star: bright head, long fading tail (256 × 64). */
  streak: (color: string) =>
    glyph(
      `streak:${color}`,
      (g) => {
        const lg = g.createLinearGradient(0, 0, 256, 0);
        lg.addColorStop(0, "rgba(255,255,255,0)");
        lg.addColorStop(0.8, color);
        lg.addColorStop(1, "#FFFFFF");
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(0, 32);
        g.lineTo(226, 22);
        g.arc(226, 32, 10, -Math.PI / 2, Math.PI / 2);
        g.closePath();
        g.fill();
      },
      256,
      64,
    ),
  footprint: (color: string) =>
    glyph(`foot:${color}`, (g) => {
      g.translate(64, 70);
      g.lineCap = "round";
      g.strokeStyle = color;
      g.lineWidth = 14;
      for (const a of [-0.55, 0, 0.55]) {
        g.beginPath();
        g.moveTo(0, 18);
        g.lineTo(Math.sin(a) * 50, 18 - Math.cos(a) * 50);
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 26, 12, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }),
};

// ---------------------------------------------------------------- particles

/** Particles read small on a phone held at arm's length: every size is scaled by this. */
const SIZE_BOOST = 1.5;

export type Motion = "rise" | "fall" | "orbit" | "swirl" | "burst" | "flicker" | "streak";

export interface ParticleSpec {
  tex: Texture[];
  n: number;
  motion: Motion;
  /** Sprite height (poster widths). */
  size: number;
  /** Width / height of the texture (balloons 0.5, streaks 4). */
  aspect?: number;
  speed?: number;
  /** Horizontal spread / orbit radius. */
  r?: number;
  /** Vertical travel / band. */
  h?: number;
  /** Start height (card space). */
  y?: number;
  additive?: boolean;
}

/**
 * Sprites that loop forever (no allocation per frame). Orbit / swirl / flicker test depth, so the
 * part of the loop behind the card is hidden by it (the card writes depth).
 */
export function particles(p: ParticleSpec): Fx {
  const group = new Group();
  const depth = p.motion === "orbit" || p.motion === "swirl" || p.motion === "flicker";
  const items = Array.from({ length: p.n }, (_, k) => {
    const m = new SpriteMaterial({
      map: p.tex[k % p.tex.length],
      transparent: true,
      depthWrite: false,
      depthTest: depth,
      blending: p.additive ? AdditiveBlending : NormalBlending,
    });
    const s = new Sprite(m);
    s.renderOrder = 8;
    group.add(s);
    return { s, m, a: hash(k + 1), b: hash(k * 3.7 + 2), c: hash(k * 9.1 + 5), ph: hash(k * 5.3 + 11) };
  });
  const speed = p.speed ?? 0.25;
  const r = p.r ?? 0.3;
  const h = p.h ?? 0.5;
  const y0 = p.y ?? 0;
  const asp = p.aspect ?? 1;
  const streakAngle = Math.atan2(-h * 0.5, r * 2);
  return {
    object: group,
    update(t, flare) {
      const R = r * (1 + flare * 0.5);
      const S = p.size * SIZE_BOOST * (1 + flare * 0.6);
      items.forEach((it, k) => {
        let x = 0;
        let y = 0;
        let z = 0.03;
        let o = 1;
        let sx = 1;
        let sy = 1;
        let rot = 0;
        const u = frac(t * speed * (0.7 + 0.6 * it.a) + it.ph);
        switch (p.motion) {
          case "rise":
            x = (it.b - 0.5) * 2 * R + Math.sin(t * 1.3 + k) * R * 0.1;
            y = y0 + u * h;
            z = 0.03 + (it.c - 0.5) * 0.08;
            o = Math.sin(Math.PI * u);
            sx = sy = 0.6 + 0.4 * o;
            rot = Math.sin(t * 1.5 + k) * 0.4;
            break;
          case "fall":
            x = (it.b - 0.5) * 2 * R + Math.sin(t * 2 + k) * 0.02;
            y = y0 + h * (1 - u);
            z = 0.04 + (it.c - 0.5) * 0.1;
            o = Math.min(1, (1 - u) * 5, u * 8);
            rot = t * (it.a - 0.5) * 8;
            sx = 0.6 + 0.4 * Math.abs(Math.sin(t * 3 + k)); // tumbling
            break;
          case "orbit": {
            const ang = it.ph * Math.PI * 2 + t * speed * (0.8 + it.a * 0.6);
            x = Math.cos(ang) * R;
            z = Math.sin(ang) * R * 0.6;
            y = y0 + it.b * h + Math.sin(t * 1.7 + k) * 0.015;
            o = 0.6 + 0.4 * Math.sin(t * 4 + k * 1.7);
            sx = sy = 0.75 + 0.25 * o;
            break;
          }
          case "swirl": {
            const ang = it.ph * Math.PI * 2 + t * speed * 6 + u * 5;
            const rr = R * (0.35 + u * 0.8);
            x = Math.cos(ang) * rr;
            z = Math.sin(ang) * rr * 0.6 + 0.02;
            y = y0 + u * h;
            o = Math.sin(Math.PI * u);
            sx = sy = 0.5 + 0.6 * (1 - u);
            break;
          }
          case "burst": {
            // Fireworks: 3 bursts in turn, each at a new spot above Duo.
            const G = 3;
            const g = k % G;
            const per = Math.ceil(p.n / G);
            const j = Math.floor(k / G);
            const tt = (t * speed) / 0.4 + g / G;
            const a = frac(tt);
            const cyc = Math.floor(tt);
            const cx = (hash(cyc * 7 + g) - 0.5) * R * 1.6;
            const cy = y0 + h * (0.55 + hash(cyc * 13 + g) * 0.45);
            const dir = (j / per) * Math.PI * 2 + hash(cyc + g) * 2;
            const d = Math.sqrt(a) * R * 0.5;
            x = cx + Math.cos(dir) * d;
            y = cy + Math.sin(dir) * d - a * a * 0.12;
            z = 0.06;
            o = a < 0.04 ? 0 : (1 - a) * 1.3;
            sx = sy = 1 - a * 0.6;
            break;
          }
          case "flicker": {
            // A ring of flames (or leaves) around the feet.
            const ang = (k / p.n) * Math.PI * 2 + t * 0.15;
            const f = 0.75 + 0.2 * Math.sin(t * 11 + k * 2.3) + 0.1 * Math.sin(t * 23 + k);
            x = Math.cos(ang) * R;
            z = Math.sin(ang) * R * 0.45;
            y = y0 + S * 0.45 * f;
            o = 0.85 + 0.15 * Math.sin(t * 9 + k);
            sx = 0.8;
            sy = f;
            break;
          }
          case "streak": {
            // Shooting stars: across the top, then a pause.
            const v = u / 0.45;
            if (v > 1) {
              o = 0;
              break;
            }
            const side = it.b > 0.5 ? 1 : -1;
            x = side * (-R + v * 2 * R);
            y = y0 + h - v * h * 0.5 + it.c * 0.12;
            z = 0.05;
            o = Math.sin(Math.PI * v);
            rot = side > 0 ? streakAngle : Math.PI - streakAngle;
            break;
          }
        }
        it.s.position.set(x, y, z);
        it.s.scale.set(S * sx * asp, S * sy, 1);
        it.m.rotation = rot;
        it.m.opacity = clamp01(o + flare * 0.4);
      });
    },
  };
}

// ---------------------------------------------------------------- props

/** Soft glow behind Duo (card space). */
export function glow(color: string, size = 0.8, y = 0.32, strength = 0.7): Fx {
  const t = once(`glow:${color}`, () => {
    const [c, g] = canvas(256);
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,255,255,0.95)");
    r.addColorStop(0.2, color);
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    return c;
  });
  const m = plane(t, size, size, { blending: AdditiveBlending }, 2);
  m.position.set(0, y, -0.03);
  return {
    object: m,
    update(time, flare) {
      m.scale.setScalar(1 + Math.sin(time * 1.6) * 0.05 + flare * 0.6);
      opacity(m, strength + flare * 0.3);
    },
  };
}

/** Light rays turning behind Duo (card space). */
export function rays(color: string, size = 1.0, y = 0.32, n = 14, speed = 0.25): Fx {
  const t = once(`rays:${color}:${n}`, () => {
    const [c, g] = canvas(512);
    g.translate(256, 256);
    for (let k = 0; k < n; k++) {
      g.rotate((Math.PI * 2) / n);
      const lg = g.createLinearGradient(0, 0, 0, -256);
      lg.addColorStop(0, "rgba(255,255,255,0.95)");
      lg.addColorStop(0.15, color);
      lg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-20, -256);
      g.lineTo(20, -256);
      g.closePath();
      g.fill();
    }
    return c;
  });
  const m = plane(t, size, size, { blending: AdditiveBlending }, 2);
  m.position.set(0, y, -0.035);
  return {
    object: m,
    update(time, flare) {
      m.rotation.z = time * speed;
      m.scale.setScalar(1 + flare * 0.5);
      opacity(m, 0.55 + flare * 0.4);
    },
  };
}

/** A glowing ring on the paper around the base (paper space). */
export function ring(color: string, w = 0.62): Fx {
  const t = once(`ring:${color}`, () => {
    const [c, g] = canvas(256);
    const gr = g.createRadialGradient(128, 128, 70, 128, 128, 126);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.55, color + "99");
    gr.addColorStop(0.7, color);
    gr.addColorStop(0.78, "#FFFFFF");
    gr.addColorStop(0.86, color);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return c;
  });
  const m = plane(t, w, w * 0.3, {}, 1);
  m.position.y = 0.01;
  return {
    object: m,
    update(time, flare) {
      const s = 1 + Math.sin(time * 3) * 0.04 + flare * 0.5;
      m.scale.set(s, s, 1);
      opacity(m, 0.75 + Math.sin(time * 3) * 0.15 + flare);
    },
  };
}

/** Rainbow arc behind Duo, in Duolingo colours (card space). */
export function rainbow(w = 0.95, y = 0.05): Fx {
  const t = once("rainbow", () => {
    const [c, g] = canvas(512, 256);
    const bands = [K.CARDINAL, K.FOX, K.BEE, K.OWL, K.MACAW, K.BEETLE];
    bands.forEach((col, k) => {
      g.beginPath();
      g.arc(256, 256, 250 - k * 22, Math.PI, 0);
      g.strokeStyle = col;
      g.lineWidth = 22;
      g.stroke();
    });
    return c;
  });
  const m = plane(t, w, w / 2, {}, 2);
  m.position.set(0, y + w / 4, -0.03);
  return {
    object: m,
    update(time, flare) {
      m.scale.setScalar(1 + flare * 0.25);
      opacity(m, 0.8 + Math.sin(time * 2) * 0.1 + flare);
    },
  };
}

/** A big heart outline behind Duo that beats like a heart (card space). */
export function heartHalo(color: string, size = 0.82, y = 0.34): Fx {
  const t = once(`halo:${color}`, () => {
    const [c, g] = canvas(512);
    g.translate(256, 262);
    const path = () => {
      g.beginPath();
      g.moveTo(0, 200);
      g.bezierCurveTo(-330, 10, -170, -260, 0, -100);
      g.bezierCurveTo(170, -260, 330, 10, 0, 200);
      g.closePath();
    };
    g.shadowColor = color;
    g.shadowBlur = 40;
    path();
    g.lineWidth = 26;
    g.strokeStyle = color;
    g.stroke();
    g.shadowBlur = 0;
    path();
    g.lineWidth = 8;
    g.strokeStyle = "#FFFFFF";
    g.stroke();
    return c;
  });
  const m = plane(t, size, size, {}, 2);
  m.position.set(0, y, -0.03);
  return {
    object: m,
    update(time, flare) {
      const ph = frac(time / 0.85);
      const beat = Math.exp(-((ph * 12) ** 2)) + 0.6 * Math.exp(-(((ph - 0.2) * 12) ** 2));
      m.scale.setScalar(1 + beat * 0.08 + flare * 0.3);
      opacity(m, 0.85 + beat * 0.15);
    },
  };
}

/** A light cone from above, sweeping slowly over Duo (card space, in front). */
export function spotlight(color: string = K.CANARY, y = 0.92, sway = 0.2): Fx {
  const t = once(`spot:${color}`, () => {
    const [c, g] = canvas(256, 512);
    const lg = g.createLinearGradient(0, 0, 0, 512);
    lg.addColorStop(0, "rgba(255,255,255,0.9)");
    lg.addColorStop(0.15, color);
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(118, 0);
    g.lineTo(138, 0);
    g.lineTo(256, 512);
    g.lineTo(0, 512);
    g.closePath();
    g.fill();
    return c;
  });
  const pivot = new Group();
  pivot.position.set(0, y, 0.08);
  const h = y + 0.05;
  const m = plane(t, h * 0.5, h, { blending: AdditiveBlending }, 9);
  m.position.y = -h / 2;
  pivot.add(m);
  return {
    object: pivot,
    update(time, flare) {
      pivot.rotation.z = Math.sin(time * 0.7) * sway;
      opacity(m, 0.2 + flare * 0.3);
    },
  };
}

/** A speech bubble over Duo's head that pops in with a new line every few seconds (card space). */
export function bubble(lines: readonly string[], color: string, at: [number, number] = [0.27, 0.66]): Fx {
  const [c, g] = canvas(512, 256);
  const t = tex(c);
  const draw = (text: string) => {
    g.clearRect(0, 0, 512, 256);
    g.font = `800 68px ${FONT_STACK}`;
    const tw = Math.min(470, Math.max(200, g.measureText(text).width + 70));
    const x = 256 - tw / 2;
    g.beginPath();
    rrect(g, x, 20, tw, 150, 60);
    g.moveTo(x + 50, 160);
    g.lineTo(x + 30, 236);
    g.lineTo(x + 110, 164);
    g.closePath();
    g.fillStyle = "#FFFFFF";
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = color;
    g.stroke();
    g.fillStyle = color;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 96);
    t.needsUpdate = true;
  };
  const m = plane(t, 0.38, 0.19, {}, 9);
  m.position.set(at[0], at[1], 0.06);
  let shown = -1;
  const PERIOD = 2.8;
  return {
    object: m,
    update(time, flare) {
      const i = Math.floor(time / PERIOD) % lines.length;
      if (i !== shown) {
        shown = i;
        draw(lines[i]);
      }
      const k = frac(time / PERIOD) * PERIOD; // seconds into this line
      const pop = k < 0.35 ? 1 + 2.2 * (k / 0.35 - 1) ** 3 + 1.2 * (k / 0.35 - 1) ** 2 : 1;
      const out = k > PERIOD - 0.3 ? (PERIOD - k) / 0.3 : 1;
      m.scale.setScalar(Math.max(0.001, pop * out) * (1 + flare * 0.2));
    },
  };
}

/** Equalizer bars behind Duo, bouncing to an invisible beat (card space). */
export function equalizer(colors: readonly string[], w = 0.8, n = 11): Fx {
  const group = new Group();
  group.position.set(0, 0.04, -0.035);
  const bar = once("bar", () => {
    const [c, g] = canvas(64, 256);
    g.fillStyle = "#FFFFFF";
    g.beginPath();
    rrect(g, 4, 4, 56, 248, 22);
    g.fill();
    return c;
  });
  const bw = (w / n) * 0.7;
  const bars = Array.from({ length: n }, (_, k) => {
    const m = new Mesh(new PlaneGeometry(bw, 1), fxMat(bar, { color: colors[k % colors.length] }));
    m.geometry.translate(0, 0.5, 0);
    m.renderOrder = 2;
    m.position.x = -w / 2 + (k + 0.5) * (w / n);
    group.add(m);
    return m;
  });
  return {
    object: group,
    update(time, flare) {
      const beat = Math.max(0, Math.sin(time * Math.PI * 2 * 2)) ** 3; // 120 bpm kick
      bars.forEach((m, k) => {
        const lvl =
          0.25 +
          0.35 * Math.abs(Math.sin(time * (2.1 + k * 0.37) + k)) +
          0.25 * beat * (1 - Math.abs(k - n / 2) / n) +
          flare * 0.3;
        m.scale.y = 0.06 + lvl * 0.42;
      });
    },
  };
}

/** Coloured disco lights wandering over the poster (paper space). */
export function discoSpots(colors: readonly string[], n = 6): Fx {
  const group = new Group();
  const spots = Array.from({ length: n }, (_, k) => {
    const m = plane(glyphs.dot(colors[k % colors.length]), 0.3, 0.3, { blending: AdditiveBlending }, 1);
    group.add(m);
    return m;
  });
  return {
    object: group,
    update(time, flare) {
      spots.forEach((m, k) => {
        const a = time * (0.5 + k * 0.07) + k * 1.9;
        m.position.set(Math.sin(a) * 0.42, 0.3 + Math.sin(a * 1.7 + k) * 0.32, 0.001);
        m.scale.setScalar(1 + flare * 0.8);
        opacity(m, 0.75 + 0.25 * Math.sin(time * 6 + k) + flare);
      });
    },
  };
}

/** Footprints walking up the poster to Duo, one after another (paper space). */
export function footprints(color: string, n = 7): Fx {
  const group = new Group();
  const pts = Array.from({ length: n }, (_, k) => {
    const u = k / (n - 1);
    const x = -0.46 + u * 0.36;
    const y = -0.08 + Math.sin(u * Math.PI) * 0.1;
    const side = k % 2 ? 1 : -1;
    const m = plane(glyphs.footprint(color), 0.07, 0.07, {}, 1);
    m.position.set(x + side * 0.012, y + side * 0.012, 0.001);
    m.rotation.z = -Math.PI / 2 + 0.5;
    group.add(m);
    return m;
  });
  return {
    object: group,
    update(time, flare) {
      const step = frac(time / 3.2) * (n + 3);
      pts.forEach((m, k) => opacity(m, (step > k ? Math.max(0, 1 - (step - k) / (n + 1)) * 0.9 : 0) + flare));
    },
  };
}

/** A magnifying glass drifting over Duo, with a glint (card space, in front). */
export function magnifier(): Fx {
  const t = once("magnifier", () => {
    const [c, g] = canvas(256);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(150, 150);
    g.lineTo(236, 236);
    g.strokeStyle = "#FFFFFF";
    g.lineWidth = 40;
    g.stroke();
    g.strokeStyle = K.NARWHAL;
    g.lineWidth = 26;
    g.stroke();
    g.beginPath();
    g.arc(100, 100, 78, 0, Math.PI * 2);
    g.fillStyle = "rgba(221,244,255,0.28)";
    g.fill();
    g.lineWidth = 30;
    g.strokeStyle = "#FFFFFF";
    g.stroke();
    g.lineWidth = 18;
    g.strokeStyle = K.HUMPBACK;
    g.stroke();
    g.beginPath();
    g.arc(100, 100, 54, Math.PI * 1.1, Math.PI * 1.45);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 10;
    g.stroke();
    return c;
  });
  const m = plane(t, 0.3, 0.3, {}, 9);
  return {
    object: m,
    update(time, flare) {
      m.position.set(Math.sin(time * 0.9) * 0.2 + 0.04, 0.38 + Math.sin(time * 1.8) * 0.09, 0.08);
      m.rotation.z = Math.sin(time * 0.9) * 0.15;
      m.scale.setScalar(1 + flare * 0.3);
    },
  };
}

/** "Lv 2 · sprout" tag on the paper under the standee (paper space). */
export function nameTag(label: string, title: string, bg: string, fg: string): Fx {
  const [c, g] = canvas(640, 128);
  const t = tex(c);
  const draw = () => {
    g.clearRect(0, 0, 640, 128);
    // Long titles ("grand champion") shrink to fit the pill instead of being cut off at the edge.
    g.font = `800 52px ${FONT_STACK}`;
    const lw0 = g.measureText(label).width;
    g.font = `800 60px ${FONT_STACK}`;
    const tw0 = g.measureText(title).width;
    const fit = Math.min(1, (624 - 110) / (lw0 + tw0 + 30));
    const ls = Math.round(52 * fit);
    const ts = Math.round(60 * fit);
    const lw = lw0 * fit;
    const tw = tw0 * fit;
    const w = Math.min(624, lw + tw + 110);
    const x = 320 - w / 2;
    g.beginPath();
    rrect(g, x, 14, w, 100, 50);
    g.fillStyle = bg;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#FFFFFF";
    g.stroke();
    g.textBaseline = "middle";
    g.fillStyle = fg;
    g.globalAlpha = 0.8;
    g.font = `800 ${ls}px ${FONT_STACK}`;
    g.fillText(label, x + 40, 66);
    g.globalAlpha = 1;
    g.font = `800 ${ts}px ${FONT_STACK}`;
    g.fillText(title, x + 40 + lw + 30 * fit, 64);
    t.needsUpdate = true;
  };
  draw();
  // Redraw once the brand fonts are ready (the first draw may use a fallback).
  document.fonts?.ready.then(draw).catch(() => {});
  const m = plane(t, 0.5, 0.1, {}, 9);
  m.position.set(0, -0.18, 0.002);
  return {
    object: m,
    update(time, flare) {
      m.scale.setScalar(1 + flare * 0.25 + Math.sin(time * 2) * 0.01);
    },
  };
}

/**
 * Frees an effect that was taken off the scene (a level change): its geometries, materials and their
 * GPU textures. Memoised textures (`once`) stay valid — three.js uploads them again on next use.
 */
export function disposeFx(fx: Fx): void {
  fx.object.traverse((o) => {
    const m = o as Mesh | Sprite;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as MeshBasicMaterial).map?.dispose();
      mat.dispose();
    }
  });
}

/** Wraps several effects as one. */
export function all(...fx: Fx[]): Fx {
  const g = new Group();
  fx.forEach((f) => g.add(f.object));
  return { object: g, update: (t, f) => fx.forEach((x) => x.update(t, f)) };
}
