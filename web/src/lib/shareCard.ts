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

  const logo = await loadImage(BRAND.logo.full);
  if (logo) ctx.drawImage(logo, SHARE_W / 2 - 90, 170, 180, 180);
  text(BRAND.appName, 470, 92, c.text, 800);
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
  text(`${BRAND.campusName} · ${BRAND.partnerName}`, 1800, 36, c.text, 600);
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
