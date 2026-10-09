// Dev-only: compiles poster images into a MindAR targets.mind in file-name order.
import { Compiler } from "mind-ar/dist/mindar-image.prod.js";

const input = document.getElementById("files") as HTMLInputElement;
const thumbs = document.getElementById("thumbs")!;
const button = document.getElementById("compile") as HTMLButtonElement;
const status = document.getElementById("status")!;

let images: HTMLImageElement[] = [];

// Posters are scaled down to this width before compiling: full-size renders give a huge targets.mind.
// Override with ?width=<px> (0 = no resize).
// Final posters (assets/posters/final, 1131×1600): compiled at 1000 px wide (user, Oct 9).
const DEFAULT_WIDTH = 1000;
const params = new URLSearchParams(location.search);
const WIDTH = Number(params.get("width") ?? DEFAULT_WIDTH);

// Every final poster has the same "DECADE HUNT" header and the same quote-box frame at the bottom.
// Those bands are painted flat (no features) before compiling, so only the middle (Duo + background,
// different on every poster) is ever matched — a header or footer alone can't be taken for the wrong
// poster — and targets.mind is ~35 % smaller. Top % and bottom %; ?mask=0,0 turns it off.
// DECISION: 24 % / 20 % — checked on the final posters (header ends at ~24 %, quote box starts at ~80 %).
const [MASK_TOP, MASK_BOTTOM] = (params.get("mask") ?? "24,20").split(",").map((n) => Number(n) / 100);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function shrink(img: HTMLImageElement): Promise<HTMLImageElement> {
  const scale = WIDTH > 0 ? Math.min(1, WIDTH / img.naturalWidth) : 1;
  if (scale === 1 && !MASK_TOP && !MASK_BOTTOM) return img;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, canvas.width, Math.round(canvas.height * MASK_TOP));
  const bottom = Math.round(canvas.height * MASK_BOTTOM);
  ctx.fillRect(0, canvas.height - bottom, canvas.width, bottom);
  const out = new Image();
  out.src = canvas.toDataURL("image/png");
  await out.decode();
  return out;
}

input.addEventListener("change", async () => {
  const files = [...(input.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  images = await Promise.all(files.map(async (f) => shrink(await loadImage(f))));
  thumbs.innerHTML = "";
  files.forEach((f, i) => {
    const fig = document.createElement("figure");
    fig.innerHTML = `<img src="${images[i].src}" alt=""><figcaption>${i}: ${f.name}</figcaption>`;
    thumbs.append(fig);
  });
  button.disabled = images.length === 0;
  status.textContent =
    `${images.length} image(s) → posterIndex 0–${images.length - 1}, ` +
    `compiled at ${images[0]?.naturalWidth}×${images[0]?.naturalHeight}, ` +
    `header/footer masked ${Math.round(MASK_TOP * 100)} %/${Math.round(MASK_BOTTOM * 100)} %`;
});

button.addEventListener("click", async () => {
  button.disabled = true;
  const started = performance.now();
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (p) => {
    status.textContent = `Compiling… ${p.toFixed(0)}%`;
  });
  const data = compiler.exportData();
  const blob = new Blob([data as BlobPart]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "targets.mind";
  a.click();
  status.textContent = `Done: ${images.length} targets, ${(data.byteLength / 1024).toFixed(0)} KB in ${((performance.now() - started) / 1000).toFixed(0)} s`;
  status.dataset.done = "1";
  button.disabled = false;
});
