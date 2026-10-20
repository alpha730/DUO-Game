// "Paper standee": a found Lingo appears as its official 2D pose (BRAND.lingoStandee, a 1024 px PNG
// made at build) on a die-cut card standing on the poster, no 3D model. Only used by ar/scanner.ts.
//
// The art itself is never changed. Depth comes from a white die-cut border, card thickness (stacked
// edge layers), a cast shadow on the paper and a contact shadow under the feet. The level look is
// the Lingo's own theme (ar/themes.ts): ten identities × Lv 1 / Lv 2 / Lv 3 / MAX — its pedestal,
// particles, signature prop and finale. MAX also gives the card a gold rim.
//
// Anchor space (MindAR): the poster is the XY plane, 1 unit = poster width, +Y = poster up, +Z points
// at the camera. The card stands on a base line below the poster's centre, leans slightly towards
// the viewer, bobs gently, turns a little towards the camera (at most ±20°) and pops in when found.
import type { Level } from "@shared/types";
import {
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  sRGBEncoding,
  TextureLoader,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import { all, canvas, disposeFx, fxMat, K, once, tex, type Fx } from "./fx";
import { themeFor, type Rank } from "./themes";

const CARD = 0.62; // card size (the PNG is square, art standing on its bottom edge)
const BASE_Y = -0.32; // where the card stands, below the poster's centre
const BASE_Z = 0.015; // just in front of the paper (no z-fighting)
const TILT = MathUtils.degToRad(12); // forward lean: the top comes towards the viewer
const MAX_TURN = MathUtils.degToRad(20); // billboard turn limit
const BOB = 0.022; // idle lift
const POP_MS = 520;
const BURST_MS = 1400; // level-up flash
const EDGE_LAYERS = 4; // card thickness: grey copies of the die-cut shape stacked behind it
const EDGE_STEP = 0.005;

const TEX = 1024; // standee texture size
const PAD = 72; // room around the art for the border (texture px)
const BORDER = 22; // white die-cut border width (texture px)
const RIM = 10; // MAX: gold rim outside the white border
const BEE = K.BEE;
const CAMEL = K.CAMEL;
const EDGE = "#C9C9C9"; // card edge (between Swan and Hare, reads as cardboard on any poster)

/** Card plane size: the art keeps its old on-screen size (CARD) inside the padding. */
const SIZE = (CARD * TEX) / (TEX - PAD * 2);

const popScale = (k: number) => (k >= 1 ? 1 : 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2);

const loader = new TextureLoader();
const textures = new Map<string, Promise<Texture>>();

/** Loads (once per app session) the standee texture. */
export function loadStandeeTexture(url: string): Promise<Texture> {
  let p = textures.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.encoding = sRGBEncoding; // MindAR's renderer outputs sRGB
      t.anisotropy = 4;
      return t;
    });
    p.catch(() => textures.delete(url)); // let the next scan retry
    textures.set(url, p);
  }
  return p;
}

// ---------- canvas helpers (no ctx.filter: Safari doesn't support it) ----------

/** `src`'s shape filled with one colour. */
function silhouette(src: CanvasImageSource, w: number, h: number, color: string) {
  const [c, g] = canvas(w, h);
  g.drawImage(src, 0, 0, w, h);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  return c;
}

/** Stamps `shape` around a circle of radius r: a crisp outline when drawn under the original. */
function stampRing(g: CanvasRenderingContext2D, shape: CanvasImageSource, r: number, size: number) {
  const steps = 28;
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    g.drawImage(shape, Math.cos(a) * r, Math.sin(a) * r, size, size);
  }
}

interface CardTextures {
  plain: Texture; // art + white border
  max: Texture; // art + white border + gold rim
  edge: Texture; // grey card edge
  shadow: Texture; // soft black shape (cast shadow)
}
const cardCache = new WeakMap<Texture, CardTextures>();

/** The die-cut card, its edge and its cast shadow, made once per Lingo from the official art. */
function cardTextures(art: Texture): CardTextures {
  const hit = cardCache.get(art);
  if (hit) return hit;
  const img = art.image as CanvasImageSource;
  const inner = TEX - PAD * 2;
  // The art, shrunk into the padding, feet still on the bottom edge minus the border.
  const [a, ag] = canvas(TEX);
  ag.drawImage(img, PAD, TEX - inner - BORDER - 2, inner, inner);
  const white = silhouette(a, TEX, TEX, "#FFFFFF");

  const make = (rim: boolean) => {
    const [c, g] = canvas(TEX);
    if (rim) stampRing(g, silhouette(a, TEX, TEX, CAMEL), BORDER + RIM, TEX);
    if (rim) stampRing(g, silhouette(a, TEX, TEX, BEE), BORDER + RIM * 0.55, TEX);
    stampRing(g, white, BORDER, TEX);
    g.drawImage(white, 0, 0); // fills pin-holes inside the shape
    g.drawImage(a, 0, 0);
    return c;
  };
  const plainC = make(false);
  const maxC = make(true);

  // Cast shadow: a cheap blur (the shape stamped at growing radii, low alpha) at 256 px.
  const S = 256;
  const shape = silhouette(maxC, S, S, "#000000");
  const [sc, sg] = canvas(S);
  sg.globalAlpha = 0.09;
  for (const r of [0, 3, 6, 9, 12]) stampRing(sg, shape, r, S);

  const out: CardTextures = {
    plain: tex(plainC),
    max: tex(maxC),
    edge: tex(silhouette(plainC, 512, 512, EDGE)),
    shadow: tex(sc),
  };
  cardCache.set(art, out);
  return out;
}

// ---------- shared effect textures (drawn once) ----------

/** Soft round contact shadow under the feet. */
const contactTexture = () =>
  once("contact", () => {
    const [c, g] = canvas(128);
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(0,0,0,0.55)");
    r.addColorStop(0.55, "rgba(0,0,0,0.22)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return c;
  });

export interface Standee {
  object: Group;
  /** Restart the pop-in (the poster was found again). */
  pop(now: number): void;
  /** Level look (null = not caught yet → Lv 1 look). A higher level than before plays a burst. */
  setLevel(level: Level | null, now: number): void;
  /** Per frame: bob, billboard turn towards the camera, pop-in, level effects. */
  update(t: number, now: number, camera: Camera): void;
}

/**
 * Three levels (Lv 1 → Lv 2 → MAX): Lv 1 wears the theme's 2nd look (pedestal), Lv 2 its 3rd
 * (signature prop), MAX the finale. The theme's plainest look is no longer used; a legacy level 3
 * shows as Lv 2.
 */
const rankOf = (l: Level | null): Rank => (l === "MAX" ? 4 : l === 2 || l === 3 ? 3 : 2);

/** @param posterIndex picks the Lingo's theme (ar/themes.ts). */
export function createStandee(texture: Texture, posterIndex: number): Standee {
  const object = new Group();
  const card = cardTextures(texture);
  const theme = themeFor(posterIndex);

  // --- on the paper (doesn't lean) ---
  // Theme effects that lie on the poster (rings, footprints, lights, name tag), around the base.
  const paper = new Group();
  paper.position.set(0, BASE_Y, 0.003);
  object.add(paper);

  // Cast shadow: the card's shape on the paper, offset up-right (light from the top-left, in front).
  const castGeo = new PlaneGeometry(SIZE, SIZE);
  castGeo.translate(0, SIZE / 2, 0);
  const cast = new Mesh(castGeo, fxMat(card.shadow, { opacity: 0.38 }));
  cast.position.set(0.05, BASE_Y + 0.012, 0.002);
  cast.renderOrder = 1;
  object.add(cast);

  // Contact shadow under the feet.
  const contact = new Mesh(new PlaneGeometry(CARD * 0.72, CARD * 0.2), fxMat(contactTexture()));
  contact.position.set(0, BASE_Y + 0.005, 0.004);
  contact.renderOrder = 1;
  object.add(contact);

  // --- the card: pivots on its bottom edge (geometry moved up by half its height) ---
  const pivot = new Group();
  pivot.rotation.order = "YXZ"; // turn about the poster's up axis, then lean forward
  pivot.position.set(0, BASE_Y, BASE_Z);
  object.add(pivot);

  // Theme effects on the card (glows and rays behind, props and particles around).
  const onCard = new Group();
  pivot.add(onCard);

  const cardGeo = new PlaneGeometry(SIZE, SIZE);
  cardGeo.translate(0, SIZE / 2, 0);

  // Pedestal (Lv 2+): behind the card, its top face level with the feet, so Duo stands on it.
  const PED_W = 512;
  const PED_H = 200;
  const PED_TOP = 58; // top face centre in the pedestal texture (px)
  const PED = CARD * 0.8;
  const pedH = (PED * PED_H) / PED_W;
  const ped = new Mesh(new PlaneGeometry(PED, pedH), new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  const feet = SIZE * ((BORDER + 2) / TEX); // feet line above the card's bottom edge
  ped.position.set(0, feet - pedH / 2 + pedH * ((PED_TOP + 14) / PED_H), -EDGE_STEP * (EDGE_LAYERS + 1));
  ped.renderOrder = 3;
  pivot.add(ped);

  // Card thickness: grey copies stacked behind (visible as an edge when the card turns / leans).
  const edgeMat = new MeshBasicMaterial({ map: card.edge, transparent: true, alphaTest: 0.3, side: DoubleSide });
  for (let k = 1; k <= EDGE_LAYERS; k++) {
    const e = new Mesh(cardGeo, edgeMat);
    e.position.set(0, -k * 0.0012, -k * EDGE_STEP);
    e.renderOrder = 4;
    pivot.add(e);
  }
  const front = new Mesh(cardGeo, new MeshBasicMaterial({ map: card.plain, transparent: true, alphaTest: 0.04, side: DoubleSide }));
  front.renderOrder = 5;
  pivot.add(front);

  let level: Level | null = null;
  let rank: Rank = 1;
  let fxPaper: Fx = all();
  let fxCard: Fx = all();
  let popAt = performance.now();
  let burstAt = -Infinity;
  let turn = 0;
  const cam = new Vector3();

  function applyLevel() {
    rank = rankOf(level);
    paper.remove(fxPaper.object);
    onCard.remove(fxCard.object);
    disposeFx(fxPaper); // the old level's effects (GPU memory on cheap phones)
    disposeFx(fxCard);
    const look = theme.look(rank);
    fxPaper = all(...look.paper);
    fxCard = all(...look.card);
    paper.add(fxPaper.object);
    onCard.add(fxCard.object);
    ped.visible = rank >= 2;
    const pm = ped.material as MeshBasicMaterial;
    pm.map = theme.pedestal(rank);
    pm.needsUpdate = true;
    const fm = front.material as MeshBasicMaterial;
    fm.map = rank === 4 ? card.max : card.plain;
    fm.needsUpdate = true;
  }
  applyLevel();

  return {
    object,
    pop(now) {
      popAt = now;
    },
    setLevel(next, now) {
      if (next === level) return;
      const up = rankOf(next) > rankOf(level) && level !== null;
      level = next;
      applyLevel();
      if (up) {
        burstAt = now;
        popAt = now;
      }
    },
    update(t, now, camera) {
      const k = Math.min(1, (now - popAt) / POP_MS);
      const s = Math.max(0.001, popScale(k));
      const lift = ((Math.sin(t * 2.2) + 1) / 2) * BOB; // 0 … BOB
      pivot.scale.setScalar(s);
      pivot.position.y = BASE_Y + lift;
      pivot.rotation.x = TILT;
      // Billboard: the camera's direction in the poster's space, limited to ±20°, eased.
      object.worldToLocal(cam.copy(camera.position));
      const target = MathUtils.clamp(Math.atan2(cam.x, cam.z), -MAX_TURN, MAX_TURN);
      turn += (target - turn) * 0.12;
      pivot.rotation.y = turn;
      paper.scale.setScalar(s);

      // Shadows: tighten and fade a little as the card lifts; the cast shadow narrows as it turns.
      const up = lift / BOB;
      const shrink = 1 - up * 0.18;
      contact.scale.set(s * shrink, s * shrink, 1);
      (contact.material as MeshBasicMaterial).opacity = 0.9 - up * 0.3;
      cast.scale.set(s * Math.cos(turn), s, 1);
      cast.position.x = 0.05 + up * 0.012 - Math.sin(turn) * 0.04;
      (cast.material as MeshBasicMaterial).opacity = 0.38 - up * 0.1;

      // Level-up burst: everything flares, then settles.
      const b = Math.max(0, 1 - (now - burstAt) / BURST_MS);
      const flare = b * b;
      fxPaper.update(t, flare);
      fxCard.update(t, flare);
    },
  };
}
