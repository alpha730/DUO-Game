// Ten identities for the AR standee, one per Lingo (by posterIndex), each with four levels:
//   Lv 1  the Lingo's colour ring + a few of its own particles drifting around
//   Lv 2  + its own pedestal, more particles
//   Lv 3  + its signature prop (spotlight, rainbow, flame ring, heart halo, balloons …) + a glow
//   MAX   + its finale (magnifier, shooting stars, fire tornado, fireworks …), light rays, the
//         pedestal gets a gold lip and the card a gold rim (ar/standee.ts)
// Names per level: config/lingoLevels.ts. Everything is drawn in code; the Duo art is never changed.
import { LINGO_LEVELS } from "../config/lingoLevels";
import {
  bubble,
  canvas,
  discoSpots,
  equalizer,
  footprints,
  glow,
  glyphs,
  hash,
  heartHalo,
  K,
  magnifier,
  nameTag,
  once,
  particles,
  rainbow,
  rays,
  ring,
  rrect,
  spotlight,
  FONT_STACK,
  type Fx,
} from "./fx";
import type { Texture } from "three";

/** 1 = Lv 1 … 4 = MAX. */
export type Rank = 1 | 2 | 3 | 4;

export interface LevelLook {
  /** Flat on the poster (rings, footprints, lights, name tag). */
  paper: Fx[];
  /** On the leaning card (glows, rays, props, particles). */
  card: Fx[];
}

export interface StandeeTheme {
  key: string;
  titles: readonly [string, string, string, string];
  /** Pedestal texture (512 × 200, top face centred at y 58) — shown from Lv 2. */
  pedestal(rank: Rank): Texture;
  look(rank: Rank): LevelLook;
}

// ---------------------------------------------------------------- pedestals (512 × 200)

const PW = 512;
const PH = 200;
const CX = 256;
const RX = 248;
const RY = 52;
const TOP = 58; // top face centre (Duo's feet)
const BAND = 72;

type Draw = (g: CanvasRenderingContext2D) => void;

/** A round pedestal seen from the front: side band (with decoration) + top face + white lip. */
function drum(key: string, rank: Rank, o: { top: string; topLight: string; side: string; sideDark: string; decor?: Draw; topDecor?: Draw }) {
  return once(`ped:${key}:${rank === 4}`, () => {
    const [c, g] = canvas(PW, PH);
    const band = () => {
      g.beginPath();
      g.ellipse(CX, TOP + BAND, RX, RY, 0, 0, Math.PI);
      g.lineTo(CX - RX, TOP);
      g.ellipse(CX, TOP, RX, RY, 0, Math.PI, 0, true);
      g.closePath();
    };
    const sg = g.createLinearGradient(0, 0, PW, 0);
    sg.addColorStop(0, o.sideDark);
    sg.addColorStop(0.3, o.side);
    sg.addColorStop(0.7, o.side);
    sg.addColorStop(1, o.sideDark);
    band();
    g.fillStyle = sg;
    g.fill();
    if (o.decor) {
      g.save();
      band();
      g.clip();
      o.decor(g);
      g.restore();
    }
    const tg = g.createRadialGradient(CX, TOP - RY * 0.4, 10, CX, TOP, RX);
    tg.addColorStop(0, o.topLight);
    tg.addColorStop(1, o.top);
    g.fillStyle = tg;
    g.beginPath();
    g.ellipse(CX, TOP, RX, RY, 0, 0, Math.PI * 2);
    g.fill();
    if (o.topDecor) {
      g.save();
      g.beginPath();
      g.ellipse(CX, TOP, RX, RY, 0, 0, Math.PI * 2);
      g.clip();
      o.topDecor(g);
      g.restore();
    }
    lip(g, rank);
    return c;
  });
}

/** The front lip of the top face: white, or gold at MAX. */
function lip(g: CanvasRenderingContext2D, rank: Rank) {
  g.beginPath();
  g.ellipse(CX, TOP, RX - 4, RY - 4, 0, 0.08, Math.PI - 0.08);
  g.strokeStyle = rank === 4 ? K.BEE : "rgba(255,255,255,0.8)";
  g.lineWidth = rank === 4 ? 12 : 5;
  g.stroke();
  if (rank === 4) {
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 3;
    g.stroke();
  }
}

/** Repeats a small mark over the side band. */
const pattern =
  (mark: (g: CanvasRenderingContext2D, x: number, y: number, k: number) => void, step = 64) =>
  (g: CanvasRenderingContext2D) => {
    for (let k = 0, x = 26; x < PW; x += step, k++) mark(g, x, TOP + BAND / 2 + 20 + (k % 2 ? 10 : -6), k);
  };

const textMark = (ch: string, color: string, size = 34) => (g: CanvasRenderingContext2D, x: number, y: number) => {
  g.font = `800 ${size}px ${FONT_STACK}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(ch, x, y);
};

const imgMark = (t: () => Texture, size = 34) => (g: CanvasRenderingContext2D, x: number, y: number) => {
  const img = t().image as CanvasImageSource;
  g.drawImage(img, x - size / 2, y - size / 2, size, size);
};

/** Three books stacked (Bookworm). */
function bookStack(rank: Rank) {
  return once(`ped:books:${rank === 4}`, () => {
    const [c, g] = canvas(PW, PH);
    const book = (y: number, h: number, w: number, cover: string, x0 = 0) => {
      const x = CX - w / 2 + x0;
      g.fillStyle = cover;
      g.beginPath();
      rrect(g, x, y, w, h, 10);
      g.fill();
      g.fillStyle = "#FFFFFF"; // pages on the right
      g.fillRect(x + w - 26, y + 6, 18, h - 12);
      g.fillStyle = "rgba(255,255,255,0.5)"; // spine bands
      g.fillRect(x + 22, y + 6, 8, h - 12);
      g.fillRect(x + 40, y + 6, 8, h - 12);
    };
    book(142, 52, 470, K.HUMPBACK);
    book(94, 50, 430, K.CARDINAL, 12);
    book(50, 46, 392, K.OWL, -8);
    // the top cover, seen a little from above
    g.fillStyle = K.MASK;
    g.beginPath();
    g.moveTo(CX - 196 - 8, 50);
    g.lineTo(CX + 196 - 8, 50);
    g.lineTo(CX + 180 - 8, 26);
    g.lineTo(CX - 180 - 8, 26);
    g.closePath();
    g.fill();
    g.strokeStyle = rank === 4 ? K.BEE : "rgba(255,255,255,0.8)";
    g.lineWidth = rank === 4 ? 10 : 4;
    g.beginPath();
    g.moveTo(CX - 200, 52);
    g.lineTo(CX + 184, 52);
    g.stroke();
    return c;
  });
}

/** A winner's podium block with a big "1" (Champion). */
function podium(rank: Rank) {
  return once(`ped:podium:${rank === 4}`, () => {
    const [c, g] = canvas(PW, PH);
    const gold = rank === 4;
    const front = gold ? K.BEE : K.OWL;
    const dark = gold ? K.CAMEL : K.FROG;
    g.fillStyle = gold ? K.DUCK : K.MASK; // top face
    g.beginPath();
    g.moveTo(20, 66);
    g.lineTo(492, 66);
    g.lineTo(456, 30);
    g.lineTo(56, 30);
    g.closePath();
    g.fill();
    const fg = g.createLinearGradient(0, 66, 0, 196);
    fg.addColorStop(0, front);
    fg.addColorStop(1, dark);
    g.fillStyle = fg;
    g.fillRect(20, 66, 472, 130);
    g.font = `800 112px ${FONT_STACK}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#FFFFFF";
    g.fillText("1", CX, 136);
    g.strokeStyle = gold ? "#FFFFFF" : "rgba(255,255,255,0.8)";
    g.lineWidth = gold ? 8 : 4;
    g.beginPath();
    g.moveTo(20, 66);
    g.lineTo(492, 66);
    g.stroke();
    return c;
  });
}

// ---------------------------------------------------------------- shared level recipe

const LABEL = ["Lv 1", "Lv 2", "Lv 3", "MAX"] as const;

interface Recipe {
  color: string; // ring + name tag
  tagInk?: string;
  /** Particles at Lv 1 / Lv 2+ (counts scale with level). */
  ambient: (n: number) => Fx;
  glowColor: string;
  raysColor: string;
  sig3: () => Fx[]; // Lv 3 (kept at MAX)
  max: () => Fx[]; // MAX finale
  sig2?: () => { paper?: Fx[]; card?: Fx[] }; // optional Lv 2 extra
  paper3?: () => Fx[];
  paperMax?: () => Fx[];
}

function build(titles: readonly string[], rank: Rank, r: Recipe): LevelLook {
  const paper: Fx[] = [];
  const card: Fx[] = [];
  paper.push(ring(r.color));
  if (rank === 4) paper.push(ring(K.BEE, 0.8));
  card.push(r.ambient([3, 6, 9, 12][rank - 1]));
  if (rank >= 2 && r.sig2) {
    const x = r.sig2();
    paper.push(...(x.paper ?? []));
    card.push(...(x.card ?? []));
  }
  if (rank >= 3) {
    card.push(glow(r.glowColor, rank === 4 ? 0.95 : 0.8));
    card.push(...r.sig3());
    paper.push(...(r.paper3?.() ?? []));
  }
  if (rank === 4) {
    card.push(rays(r.raysColor, 1.15));
    card.push(...r.max());
    paper.push(...(r.paperMax?.() ?? []));
  }
  paper.push(
    nameTag(LABEL[rank - 1], titles[rank - 1], rank === 4 ? K.BEE : r.color, rank === 4 ? K.EEL : (r.tagInk ?? "#FFFFFF")),
  );
  return { paper, card };
}

const C = [K.CARDINAL, K.FOX, K.BEE, K.OWL, K.MACAW, K.BEETLE, K.HUMPBACK];

// ---------------------------------------------------------------- the ten

const T = (i: number) => LINGO_LEVELS[i].titles;

export const THEMES: readonly StandeeTheme[] = [
  // 0 · Rookie Duo — a seed that grows
  {
    key: "rookie",
    titles: T(0),
    pedestal: (r) =>
      drum("pot", r, {
        top: "#5A3A1E",
        topLight: "#7A5230",
        side: K.FOX,
        sideDark: K.GUINEA,
        decor: (g) => {
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.fillRect(0, TOP + 14, PW, 12); // pot rim
        },
        topDecor: (g) => {
          g.fillStyle = K.MASK; // little sprouts in the soil
          for (const x of [120, 170, 350, 400]) {
            g.beginPath();
            g.ellipse(x, TOP - 6, 14, 6, -0.5, 0, Math.PI * 2);
            g.fill();
          }
        },
      }),
    look: (rank) =>
      build(T(0), rank, {
        color: K.OWL,
        ambient: (n) =>
          particles({ tex: [glyphs.leaf(K.OWL, K.FROG), glyphs.leaf(K.MASK, K.FROG), glyphs.leaf(K.TURTLE, K.OWL)], n, motion: "rise", size: 0.06, r: 0.36, h: 0.7, speed: 0.12 }),
        glowColor: K.MASK,
        raysColor: K.BEE,
        sig3: () => [
          particles({ tex: [glyphs.leaf(K.OWL, K.FROG), glyphs.leaf(K.MASK, K.FROG)], n: 14, motion: "flicker", size: 0.08, r: 0.27, y: -0.02 }),
        ],
        max: () => [
          particles({ tex: [glyphs.flower(K.WHITE, K.BEE), glyphs.flower(K.FLAMINGO, K.BEE), glyphs.flower(K.DUCK, K.FOX)], n: 10, motion: "orbit", size: 0.075, r: 0.36, h: 0.55, y: 0.08, speed: 0.6 }),
          particles({ tex: [glyphs.dot(K.DUCK)], n: 10, motion: "rise", size: 0.04, r: 0.3, h: 0.8, speed: 0.3, additive: true }),
        ],
      }),
  },
  // 1 · Curious Duo — a detective case
  {
    key: "curious",
    titles: T(1),
    pedestal: (r) =>
      drum("case", r, {
        top: K.IGUANA,
        topLight: K.WHITE,
        side: K.NARWHAL,
        sideDark: K.MANTA,
        decor: pattern(textMark("?", "rgba(255,255,255,0.55)", 36), 56),
      }),
    look: (rank) =>
      build(T(1), rank, {
        color: K.HUMPBACK,
        ambient: (n) =>
          particles({ tex: [glyphs.text("?", K.MACAW), glyphs.text("?", K.HUMPBACK), glyphs.text("?", K.NARWHAL)], n, motion: "rise", size: 0.07, r: 0.34, h: 0.65, speed: 0.14 }),
        glowColor: K.BLUEJAY,
        raysColor: K.MACAW,
        sig2: () => ({ paper: [footprints(K.NARWHAL)] }),
        sig3: () => [spotlight(K.CANARY), particles({ tex: [glyphs.dot(K.CANARY)], n: 10, motion: "orbit", size: 0.025, r: 0.22, h: 0.7, speed: 0.4, additive: true })],
        max: () => [
          magnifier(),
          particles({ tex: [glyphs.text("!", K.BEE), glyphs.text("!", K.FOX), glyphs.sparkle(K.BEE)], n: 18, motion: "burst", size: 0.06, r: 0.5, h: 0.75, speed: 0.4 }),
        ],
      }),
  },
  // 2 · Winking Duo — a little star
  {
    key: "winking",
    titles: T(2),
    pedestal: (r) =>
      drum("stage", r, {
        top: "#E3BFFF",
        topLight: K.WHITE,
        side: K.BETTA,
        sideDark: "#6B4AA0",
        decor: pattern(imgMark(() => glyphs.star(K.BEE), 30), 52),
      }),
    look: (rank) =>
      build(T(2), rank, {
        color: K.BEETLE,
        ambient: (n) =>
          particles({ tex: [glyphs.star(K.BEE), glyphs.sparkle(K.BEETLE), glyphs.sparkle(K.WHITE)], n, motion: "orbit", size: 0.06, r: 0.36, h: 0.6, y: 0.05, speed: 0.5 }),
        glowColor: K.BEETLE,
        raysColor: K.BEETLE,
        sig2: () => ({ card: [particles({ tex: [glyphs.sparkle(K.BEE)], n: 5, motion: "rise", size: 0.05, r: 0.3, h: 0.6, speed: 0.3 })] }),
        sig3: () => [rainbow()],
        max: () => [
          particles({ tex: [glyphs.streak(K.BEE), glyphs.streak(K.WHITE), glyphs.streak(K.BEETLE)], n: 5, motion: "streak", size: 0.04, aspect: 4, r: 0.38, h: 0.4, y: 0.4, speed: 0.35, additive: true }),
          particles({ tex: [glyphs.star(K.BEE), glyphs.star(K.WHITE)], n: 8, motion: "burst", size: 0.05, r: 0.5, h: 0.75, speed: 0.35 }),
        ],
      }),
  },
  // 3 · Thumbs-Up Duo — the hype owl
  {
    key: "thumbs-up",
    titles: T(3),
    pedestal: (r) =>
      drum("hype", r, {
        top: K.IGUANA,
        topLight: K.WHITE,
        side: K.MACAW,
        sideDark: K.WHALE,
        decor: pattern(textMark("+", "rgba(255,255,255,0.75)", 44), 50),
      }),
    look: (rank) =>
      build(T(3), rank, {
        color: K.MACAW,
        ambient: (n) =>
          particles({ tex: [glyphs.text("+", K.MACAW), glyphs.text("+", K.OWL), glyphs.check(K.OWL)], n, motion: "rise", size: 0.065, r: 0.36, h: 0.65, speed: 0.16 }),
        glowColor: K.BLUEJAY,
        raysColor: K.MACAW,
        sig3: () => [bubble(["hi!", "hello!", "namaste!", "nice one!"], K.MACAW)],
        max: () => [
          bubble(["you got this!", "legend!", "10 years!", "keep going!"], K.OWL, [-0.27, 0.56]),
          particles({ tex: [glyphs.confetti(K.MACAW), glyphs.confetti(K.OWL), glyphs.confetti(K.BEE), glyphs.check(K.OWL)], n: 16, motion: "fall", size: 0.045, r: 0.42, h: 0.9, y: 0.05, speed: 0.35 }),
        ],
      }),
  },
  // 4 · Fierce Duo — fire
  {
    key: "fierce",
    titles: T(4),
    pedestal: (r) =>
      drum("lava", r, {
        top: "#3A3A3A",
        topLight: "#5A5A5A",
        side: "#2E2E2E",
        sideDark: "#1A1A1A",
        decor: (g) => {
          g.strokeStyle = K.FOX;
          g.shadowColor = K.BEE;
          g.shadowBlur = 12;
          g.lineWidth = 4;
          for (let k = 0; k < 9; k++) {
            const x = 30 + k * 55;
            g.beginPath();
            g.moveTo(x, TOP + 10);
            g.lineTo(x + 14, TOP + 40);
            g.lineTo(x - 6, TOP + 62);
            g.lineTo(x + 10, TOP + 110);
            g.stroke();
          }
        },
        topDecor: (g) => {
          g.strokeStyle = K.FOX;
          g.shadowColor = K.BEE;
          g.shadowBlur = 10;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(80, TOP + 10);
          g.lineTo(200, TOP - 8);
          g.lineTo(300, TOP + 14);
          g.lineTo(430, TOP - 4);
          g.stroke();
        },
      }),
    look: (rank) =>
      build(T(4), rank, {
        color: K.CARDINAL,
        ambient: (n) =>
          particles({ tex: [glyphs.dot(K.FOX), glyphs.dot(K.BEE), glyphs.dot(K.CARDINAL)], n: n + 4, motion: "rise", size: 0.035, r: 0.3, h: 0.75, speed: 0.4, additive: true }),
        glowColor: K.FOX,
        raysColor: K.CARDINAL,
        sig2: () => ({ paper: [ring(K.FOX, 0.72)] }),
        sig3: () => [particles({ tex: [glyphs.flame()], n: 14, motion: "flicker", size: 0.12, r: 0.28, y: -0.03 })],
        max: () => [
          particles({ tex: [glyphs.flame()], n: 24, motion: "swirl", size: 0.09, r: 0.38, h: 0.8, speed: 0.35 }),
          particles({ tex: [glyphs.dot(K.BEE)], n: 10, motion: "rise", size: 0.03, r: 0.4, h: 1.0, speed: 0.6, additive: true }),
        ],
      }),
  },
  // 5 · Lovestruck Duo — love
  {
    key: "lovestruck",
    titles: T(5),
    pedestal: (r) =>
      drum("cushion", r, {
        top: K.FLAMINGO,
        topLight: K.FISH,
        side: K.CARDINAL,
        sideDark: K.FIREANT,
        decor: pattern(imgMark(() => glyphs.heart(K.FISH), 30), 52),
      }),
    look: (rank) =>
      build(T(5), rank, {
        color: K.CARDINAL,
        ambient: (n) =>
          particles({ tex: [glyphs.heart(K.CARDINAL), glyphs.heart(K.FLAMINGO), glyphs.heart(K.FISH)], n, motion: "rise", size: 0.065, r: 0.36, h: 0.7, speed: 0.15 }),
        glowColor: K.FLAMINGO,
        raysColor: K.FLAMINGO,
        sig3: () => [heartHalo(K.CARDINAL)],
        max: () => [
          particles({ tex: [glyphs.heart(K.CARDINAL), glyphs.heart(K.FLAMINGO)], n: 18, motion: "burst", size: 0.055, r: 0.5, h: 0.75, speed: 0.4 }),
          particles({ tex: [glyphs.heart(K.FISH)], n: 8, motion: "orbit", size: 0.05, r: 0.38, h: 0.5, y: 0.1, speed: 0.7 }),
        ],
      }),
  },
  // 6 · Joyful Duo — a party
  {
    key: "joyful",
    titles: T(6),
    pedestal: (r) =>
      drum("cake", r, {
        top: K.POLAR,
        topLight: K.WHITE,
        side: K.BEE,
        sideDark: K.CAMEL,
        decor: (g) => {
          g.fillStyle = K.WHITE; // frosting drips
          g.beginPath();
          g.moveTo(0, TOP);
          for (let x = 0; x <= PW; x += 32) g.quadraticCurveTo(x + 16, TOP + 38 + ((x / 32) % 2) * 14, x + 32, TOP + 8);
          g.lineTo(PW, TOP - 20);
          g.lineTo(0, TOP - 20);
          g.fill();
          for (let k = 0; k < 26; k++) {
            g.fillStyle = C[k % C.length];
            g.save();
            g.translate(20 + hash(k) * 470, TOP + 60 + hash(k + 50) * 60);
            g.rotate(hash(k + 9) * 3);
            g.fillRect(-7, -2.5, 14, 5);
            g.restore();
          }
        },
      }),
    look: (rank) =>
      build(T(6), rank, {
        color: K.FOX,
        ambient: (n) =>
          particles({ tex: C.map((c) => glyphs.confetti(c)), n: n + 2, motion: "fall", size: 0.04, r: 0.4, h: 0.85, y: 0.05, speed: 0.25 }),
        glowColor: K.BEE,
        raysColor: K.BEE,
        sig3: () => [
          particles({ tex: [glyphs.balloon(K.CARDINAL), glyphs.balloon(K.MACAW), glyphs.balloon(K.BEE), glyphs.balloon(K.BEETLE), glyphs.balloon(K.OWL)], n: 6, motion: "rise", size: 0.16, aspect: 0.5, r: 0.4, h: 0.9, y: 0.0, speed: 0.12 }),
        ],
        max: () => [
          particles({ tex: C.map((c) => glyphs.dot(c)), n: 30, motion: "burst", size: 0.035, r: 0.55, h: 0.6, speed: 0.45, additive: true }),
          particles({ tex: C.map((c) => glyphs.confetti(c)), n: 14, motion: "fall", size: 0.04, r: 0.45, h: 0.95, y: 0.05, speed: 0.4 }),
        ],
      }),
  },
  // 7 · Bookworm Duo — words
  {
    key: "bookworm",
    titles: T(7),
    pedestal: bookStack,
    look: (rank) =>
      build(T(7), rank, {
        color: K.HUMPBACK,
        ambient: (n) =>
          particles({
            tex: ["A", "b", "C", "d", "E", "f", "G", "h"].map((ch, k) => glyphs.text(ch, [K.HUMPBACK, K.OWL, K.CARDINAL, K.FOX][k % 4])),
            n,
            motion: "rise",
            size: 0.065,
            r: 0.36,
            h: 0.7,
            speed: 0.14,
          }),
        glowColor: K.BLUEJAY,
        raysColor: K.BEE,
        sig3: () => [particles({ tex: [glyphs.page()], n: 7, motion: "orbit", size: 0.09, r: 0.38, h: 0.45, y: 0.12, speed: 0.55 })],
        max: () => [
          particles({
            tex: ["hello", "fluent", "decade", "english", "speak", "dream"].map((w, k) => glyphs.word(w, [K.HUMPBACK, K.OWL, K.CARDINAL, K.BEETLE, K.FOX, K.MACAW][k])),
            n: 6,
            motion: "orbit",
            size: 0.055,
            aspect: 4,
            r: 0.42,
            h: 0.55,
            y: 0.08,
            speed: 0.4,
          }),
        ],
      }),
  },
  // 8 · Cool Duo — music
  {
    key: "cool",
    titles: T(8),
    pedestal: (r) =>
      drum("speaker", r, {
        top: "#2E2E2E",
        topLight: "#4A4A4A",
        side: "#1E1E1E",
        sideDark: "#0E0E0E",
        decor: (g) => {
          g.fillStyle = K.MACAW;
          g.shadowColor = K.MACAW;
          g.shadowBlur = 14;
          g.fillRect(0, TOP + 10, PW, 6); // neon stripe
          g.shadowBlur = 0;
          for (const x of [150, 256, 362]) {
            g.beginPath();
            g.arc(x, TOP + 66, 30, 0, Math.PI * 2);
            g.fillStyle = "#3A3A3A";
            g.fill();
            g.beginPath();
            g.arc(x, TOP + 66, 12, 0, Math.PI * 2);
            g.fillStyle = "#555555";
            g.fill();
          }
        },
      }),
    look: (rank) =>
      build(T(8), rank, {
        color: K.BEETLE,
        ambient: (n) =>
          particles({ tex: [glyphs.note(K.BEETLE), glyphs.note(K.MACAW, true), glyphs.note(K.BEE)], n, motion: "rise", size: 0.07, r: 0.36, h: 0.7, speed: 0.18 }),
        glowColor: K.MACAW,
        raysColor: K.BEETLE,
        sig2: () => ({ paper: [ring(K.MACAW, 0.74)] }),
        sig3: () => [equalizer([K.MACAW, K.BEETLE, K.OWL, K.BEE, K.CARDINAL])],
        max: () => [particles({ tex: [glyphs.sparkle(K.WHITE), glyphs.sparkle(K.BEETLE)], n: 12, motion: "orbit", size: 0.04, r: 0.4, h: 0.65, speed: 0.9 })],
        paperMax: () => [discoSpots([K.MACAW, K.BEETLE, K.CARDINAL, K.BEE, K.OWL])],
      }),
  },
  // 9 · Champion Duo — the final
  {
    key: "champion",
    titles: T(9),
    pedestal: podium,
    look: (rank) =>
      build(T(9), rank, {
        color: K.CAMEL,
        ambient: (n) => particles({ tex: [glyphs.sparkle(K.BEE), glyphs.coin()], n, motion: "orbit", size: 0.06, r: 0.38, h: 0.6, y: 0.05, speed: 0.5 }),
        glowColor: K.BEE,
        raysColor: K.BEE,
        sig3: () => [particles({ tex: [glyphs.cap()], n: 6, motion: "burst", size: 0.09, r: 0.6, h: 0.7, speed: 0.3 })],
        max: () => [
          spotlight(K.DUCK, 0.92, 0.25),
          particles({ tex: [glyphs.confetti(K.BEE), glyphs.confetti(K.CAMEL), glyphs.confetti(K.WHITE), glyphs.coin()], n: 20, motion: "fall", size: 0.045, r: 0.45, h: 0.95, y: 0.05, speed: 0.4 }),
        ],
      }),
  },
];

/** Theme for a poster (0–9). */
export const themeFor = (posterIndex: number): StandeeTheme => THEMES[((posterIndex % 10) + 10) % 10];
