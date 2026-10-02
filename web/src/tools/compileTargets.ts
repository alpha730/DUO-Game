// Dev-only: compiles poster images into a MindAR targets.mind in file-name order.
import { Compiler } from "mind-ar/dist/mindar-image.prod.js";

const input = document.getElementById("files") as HTMLInputElement;
const thumbs = document.getElementById("thumbs")!;
const button = document.getElementById("compile") as HTMLButtonElement;
const status = document.getElementById("status")!;

let images: HTMLImageElement[] = [];

// Posters are scaled down to this width before compiling: full-size renders give a huge targets.mind.
// Override with ?width=<px> (0 = no resize).
// DECISION: 600 px — tested 400/600/800 at 1–3 m, angled, blurred and dim: all tracked equally well, and
// 600 is the smallest of the two shortlisted widths (7.0 MB raw, 2.4 MB with brotli for 10 posters).
const DEFAULT_WIDTH = 600;
const WIDTH = Number(new URLSearchParams(location.search).get("width") ?? DEFAULT_WIDTH);

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
  if (scale === 1) return img;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    `compiled at ${images[0]?.naturalWidth}×${images[0]?.naturalHeight}`;
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
