// "Paper standee": a found Lingo appears as its official 2D pose (BRAND.lingoStandee, a 1024 px PNG
// made at build) on a card standing on the poster, no 3D model. Only used by ar/scanner.ts.
//
// Anchor space (MindAR): the poster is the XY plane, 1 unit = poster width, +Y = poster up, +Z points
// at the camera. The card stands on a base line below the poster's centre, leans slightly towards
// the viewer, bobs gently, turns a little towards the camera (at most ±20°) and pops in when found.
import {
  CanvasTexture,
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

const CARD = 0.62; // card size (the PNG is square, art standing on its bottom edge)
const BASE_Y = -0.32; // where the card stands, below the poster's centre
const BASE_Z = 0.015; // just in front of the paper (no z-fighting)
const TILT = MathUtils.degToRad(12); // forward lean: the top comes towards the viewer
const MAX_TURN = MathUtils.degToRad(20); // billboard turn limit
const BOB = 0.022; // idle lift
const POP_MS = 520;
/** 0 → 1 with a little overshoot. */
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

let shadowTexture: Texture | null = null;
/** A soft round contact shadow (drawn once, reused). */
function contactShadow(): Texture {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,0.55)");
  r.addColorStop(0.55, "rgba(0,0,0,0.22)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  shadowTexture = new CanvasTexture(c);
  return shadowTexture;
}

export interface Standee {
  object: Group;
  /** Restart the pop-in (the poster was found again). */
  pop(now: number): void;
  /** Per frame: bob, billboard turn towards the camera, pop-in. */
  update(t: number, now: number, camera: Camera): void;
}

export function createStandee(texture: Texture): Standee {
  const object = new Group();

  // Contact shadow on the paper, under the card's base.
  const shadow = new Mesh(
    new PlaneGeometry(CARD * 0.72, CARD * 0.2),
    new MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }),
  );
  shadow.position.set(0, BASE_Y + 0.005, 0.004);
  shadow.renderOrder = 1;
  object.add(shadow);

  // The card: pivots on its bottom edge (geometry moved up by half its height).
  const pivot = new Group();
  pivot.rotation.order = "YXZ"; // turn about the poster's up axis, then lean forward
  pivot.position.set(0, BASE_Y, BASE_Z);
  const geometry = new PlaneGeometry(CARD, CARD);
  geometry.translate(0, CARD / 2, 0);
  const card = new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.04, side: DoubleSide }));
  card.renderOrder = 2;
  pivot.add(card);
  object.add(pivot);

  let popAt = performance.now();
  let turn = 0;
  const cam = new Vector3();

  return {
    object,
    pop(now) {
      popAt = now;
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
      // The shadow tightens and fades a little as the card lifts.
      const shrink = 1 - (lift / BOB) * 0.18;
      shadow.scale.set(s * shrink, s * shrink, 1);
      (shadow.material as MeshBasicMaterial).opacity = 0.9 - (lift / BOB) * 0.3;
    },
  };
}
