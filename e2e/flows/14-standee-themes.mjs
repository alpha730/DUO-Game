// 14. AR standee level looks, rendered for real (the other flows use the fake scanner, which never
//     draws): all 10 Lingo themes × Lv 1 / Lv 2 / Lv 3 / MAX through three.js in the browser, plus a
//     level-up (burst + the old effects disposed). Checks: no errors, every tile draws something, the
//     looks differ by level. Writes a contact sheet (14-standee-themes.png).
import { BASE, BROWSER, finish, launch, ok, shot } from "../lib.mjs";

const { browser, page, errors } = await launch({ viewport: { width: 1200, height: 900 } });
await page.goto(BASE + "/rules"); // any page: Vite serves the modules imported below
await page.waitForLoadState("networkidle");

const result = await page.evaluate(async () => {
  const THREE = await import("/node_modules/.vite/deps/three.js").catch(() => import("three"));
  const { createStandee, loadStandeeTexture } = await import("/src/ar/standee.ts");
  const { THEMES } = await import("/src/ar/themes.ts");
  const TILE = 180;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(TILE, TILE);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0xf2efe6, 1); // a light poster
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10);
  camera.position.set(0.18, 0.05, 1.45);
  camera.lookAt(0, -0.05, 0);
  const sheet = document.createElement("canvas");
  sheet.width = TILE * 4;
  sheet.height = TILE * 10;
  const sg = sheet.getContext("2d");
  const out = { tiles: [], levelUp: null, error: null };
  const levels = [null, 2, 3, "MAX"];
  try {
    for (let i = 0; i < THEMES.length; i++) {
      const texture = await loadStandeeTexture(`/brand/standees/lingo-${2016 + i}.png`);
      for (let r = 0; r < 4; r++) {
        const scene = new THREE.Scene();
        const s = createStandee(texture, i);
        s.setLevel(levels[r], 0);
        scene.add(s.object);
        // a few frames, ending past the pop-in
        const t0 = performance.now();
        for (const dt of [0, 300, 900, 1600]) s.update(1.3 + dt / 1000, t0 + dt, camera);
        renderer.render(scene, camera);
        sg.drawImage(renderer.domElement, r * TILE, i * TILE);
        const px = sg.getImageData(r * TILE, i * TILE, TILE, TILE).data;
        let changed = 0;
        let hash = 0;
        for (let k = 0; k < px.length; k += 16) {
          if (Math.abs(px[k] - 0xf2) + Math.abs(px[k + 1] - 0xef) + Math.abs(px[k + 2] - 0xe6) > 30) changed++;
          hash = (hash * 31 + px[k] + px[k + 1] * 7 + px[k + 2] * 13) | 0;
        }
        out.tiles.push({ theme: THEMES[i].key, rank: r + 1, changed, hash, children: s.object.children.length });
      }
    }
    // Level-up on one standee: the burst plays, the old effects are freed (no errors).
    const scene = new THREE.Scene();
    const texture = await loadStandeeTexture("/brand/standees/lingo-2020.png");
    const s = createStandee(texture, 4);
    scene.add(s.object);
    s.setLevel(2, 0);
    s.update(1, 2000, camera);
    renderer.render(scene, camera);
    const before = renderer.info.memory.textures;
    s.setLevel(3, 2100);
    s.update(1.1, 2200, camera);
    renderer.render(scene, camera);
    s.setLevel("MAX", 2300);
    s.update(1.2, 2400, camera);
    renderer.render(scene, camera);
    out.levelUp = { ok: true, texturesBefore: before, texturesAfter: renderer.info.memory.textures };
  } catch (e) {
    out.error = String(e?.stack ?? e);
  }
  out.sheet = sheet.toDataURL("image/png");
  renderer.dispose();
  return out;
});

ok(!result.error, `standee renders without errors${result.error ? ": " + result.error.split("\n")[0] : ""}`);
ok(result.tiles.length === 40, `40 looks rendered (10 themes × 4 levels): ${result.tiles.length}`);
const blank = result.tiles.filter((t) => t.changed < 200);
ok(blank.length === 0, `every look draws the standee${blank.length ? " — blank: " + blank.map((t) => `${t.theme} Lv${t.rank}`).join(", ") : ""}`);
const sameAsBelow = result.tiles.filter((t, k) => t.rank > 1 && t.hash === result.tiles[k - 1].hash);
ok(sameAsBelow.length === 0, `each level looks different from the one below${sameAsBelow.length ? " — same: " + sameAsBelow.map((t) => `${t.theme} Lv${t.rank}`).join(", ") : ""}`);
ok(result.levelUp?.ok, `level-up 2 → 3 → MAX runs (textures ${result.levelUp?.texturesBefore} → ${result.levelUp?.texturesAfter})`);

// Contact sheet: rows = Lingo 0–9, columns = Lv 1, Lv 2, Lv 3, MAX.
await page.setContent(`<body style="margin:0;background:#fff"><img src="${result.sheet}"></body>`);
await shot(page, "14-standee-themes", { fullPage: true });
console.log(`(contact sheet: e2e/out/${BROWSER}/14-standee-themes.png)`);
await finish(browser, errors);
