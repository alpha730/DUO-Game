import { LINGO_COUNT } from "@shared/types";
import { BRAND } from "../config/brand";

export interface ShareStats {
  name: string;
  caught: number;
  points: number;
}

export const SHARE_W = 1080;
export const SHARE_H = 1920; // 9:16 — fits Instagram / WhatsApp stories

const fmt = (n: number) => n.toLocaleString("en-IN");

export const shareText = (s: ShareStats) =>
  `I caught ${s.caught}/${LINGO_COUNT} ${BRAND.creatureName}s · ${fmt(s.points)} pts in ${BRAND.appName}!`;

/** Runs one decorative drawing step; a failure (e.g. Safari and an SVG in a canvas) never stops the card. */
function safely(step: string, draw: () => void): void {
  try {
    draw();
  } catch (err) {
    console.warn(`share card: ${step} skipped`, err);
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a missing logo never blocks the card
    img.src = src;
  });
}

/**
 * Draws the share card (PLAN 7.5): "I caught 7/10 Lingos · 1,240 pts". Colours, font, names and logo
 * all come from brand.ts (CLAUDE.md rule 8); only same-origin images, so the canvas can be exported.
 */
export async function drawShareCard(canvas: HTMLCanvasElement, s: ShareStats): Promise<void> {
  const c = BRAND.themes.dark; // the shared image always uses the dark look
  const font = BRAND.fontFamily;
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts?.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
  bg.addColorStop(0, c.bg);
  bg.addColorStop(1, c.primaryDark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  // DET 10 pattern tile (dark), subtle, when supplied.
  const tileSrc = BRAND.det10.pattern.dark ?? BRAND.det10.pattern.light;
  const tile = tileSrc ? await loadImage(tileSrc) : null;
  if (tile)
    safely("pattern", () => {
      // Draw the tile repeatedly (createPattern with an SVG image fails in Safari).
      const size = 360;
      ctx.save();
      ctx.globalAlpha = 0.3;
      for (let y = 0; y < SHARE_H; y += size) for (let x = 0; x < SHARE_W; x += size) ctx.drawImage(tile, x, y, size, size);
      ctx.restore();
    });

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const text = (t: string, y: number, size: number, color: string, weight = 700) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    // Long names shrink to fit instead of running off the card.
    let px = size;
    while (ctx.measureText(t).width > SHARE_W - 120 && px > 24) {
      px -= 4;
      ctx.font = `${weight} ${px}px ${font}`;
    }
    ctx.fillText(t, SHARE_W / 2, y);
  };

  // The DET 10 seal on top (else the logo).
  const seal = await loadImage(BRAND.det10.seal ?? BRAND.logo.full);
  if (seal)
    safely("seal", () => {
      const h = 220;
      const w = (seal.naturalWidth / (seal.naturalHeight || 1)) * h || h;
      ctx.drawImage(seal, (SHARE_W - w) / 2, 140, w, h);
    });
  ctx.font = `800 96px ${BRAND.headlineFontFamily}`;
  ctx.fillStyle = c.text;
  ctx.fillText(BRAND.appName, SHARE_W / 2, 470);
  text(BRAND.campaignName, 540, 40, c.muted, 600);

  text("I caught", 800, 64, c.text, 700);
  text(`${s.caught}/${LINGO_COUNT}`, 1010, 230, c.primary, 900);
  text(`${BRAND.creatureName}s`, 1100, 64, c.text, 700);

  // One slot per Lingo: filled for each caught.
  const r = 34;
  const gap = 22;
  const rowW = 5 * (2 * r) + 4 * gap;
  for (let i = 0; i < LINGO_COUNT; i++) {
    const x = (SHARE_W - rowW) / 2 + r + (i % 5) * (2 * r + gap);
    const y = 1210 + Math.floor(i / 5) * (2 * r + gap);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i < s.caught ? c.gold : c.slotEmpty;
    ctx.fill();
  }

  text(`${fmt(s.points)} pts`, 1480, 120, c.gold, 900);
  text(s.name, 1600, 52, c.text, 600);
  // DET × JECRC lockup: the white DET 10 horizontal lockup + divider + × + JECRC (logo or Feather).
  const det = await loadImage(BRAND.det10.lockupH.dark ?? "");
  const jecrcLogo = BRAND.jecrcLogo.dark ? await loadImage(BRAND.jecrcLogo.dark) : null;
  if (det && (det.naturalWidth || 0) > 0) {
    safely("lockup", () => {
      const h = 64;
      const detW = (det.naturalWidth / (det.naturalHeight || 1)) * h;
      ctx.font = `800 64px ${BRAND.headlineFontFamily}`;
      const jW = jecrcLogo ? (jecrcLogo.naturalWidth / (jecrcLogo.naturalHeight || 1)) * h : ctx.measureText("JECRC").width;
      const gap = 28;
      const xW = 40;
      let x = (SHARE_W - (detW + gap + 3 + gap + xW + gap + jW)) / 2;
      const y = 1760;
      ctx.drawImage(det, x, y, detW, h);
      x += detW + gap;
      ctx.fillStyle = c.border;
      ctx.fillRect(x, y + 4, 3, h - 8);
      x += 3 + gap;
      ctx.fillStyle = c.muted;
      ctx.font = `400 48px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText("×", x, y + 48);
      x += xW + gap;
      if (jecrcLogo) ctx.drawImage(jecrcLogo, x, y, jW, h);
      else {
        ctx.fillStyle = c.text;
        ctx.font = `800 64px ${BRAND.headlineFontFamily}`;
        ctx.fillText("JECRC", x, y + 54);
      }
    });
    ctx.textAlign = "center";
  } else {
    text(BRAND.coBrandShort, 1800, 40, c.primaryText, 800); // "DET × JECRC · 10 Years"
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
}

/**
 * Web Share API with the image (Android Chrome / iOS Safari → Instagram, WhatsApp…); otherwise
 * downloads the PNG. Returns what happened.
 */
export async function shareOrDownload(blob: Blob, s: ShareStats): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], `${BRAND.appName.toLowerCase().replace(/\W+/g, "-")}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText(s) });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "cancelled";
      // Share sheet failed (e.g. not allowed here) → fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
