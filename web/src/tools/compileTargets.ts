// Dev-only: compiles poster images into a MindAR targets.mind in file-name order.
import { Compiler } from "mind-ar/dist/mindar-image.prod.js";

const input = document.getElementById("files") as HTMLInputElement;
const thumbs = document.getElementById("thumbs")!;
const button = document.getElementById("compile") as HTMLButtonElement;
const status = document.getElementById("status")!;

let images: HTMLImageElement[] = [];

// DECISION: posters are scaled to ≤ 1000 px on the long side before compiling. Full-size A4 renders
// (1240×1754) give a ~10 MB targets.mind, too heavy for cheap phones on campus Wi-Fi; MindAR tracks
// fine at this size. Override with ?max=<px> (0 = no resize).
const MAX_SIDE = Number(new URLSearchParams(location.search).get("max") ?? 1000);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function shrink(img: HTMLImageElement): Promise<HTMLImageElement> {
  const scale = MAX_SIDE > 0 ? Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
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
