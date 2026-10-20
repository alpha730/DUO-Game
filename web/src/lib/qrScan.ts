// Prize desk QR reading: the browser's BarcodeDetector where it exists (Android Chrome), else jsQR on
// a canvas frame (iPhone Safari, desktop). Loaded only by /redeem.
import jsQR from "jsqr";

interface Detector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

let detector: Promise<Detector | null> | null = null;

/** The native QR detector, or null when the browser has none (cached). */
function nativeDetector(): Promise<Detector | null> {
  detector ??= (async () => {
    const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? ["qr_code"];
      return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : null;
    } catch {
      return null;
    }
  })();
  return detector;
}

let canvas: HTMLCanvasElement | null = null;

/** The text of a QR code in this frame (video or canvas), or null. Never throws. */
export async function readQr(source: HTMLVideoElement | HTMLCanvasElement): Promise<string | null> {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) return null;
  const native = await nativeDetector();
  if (native) {
    try {
      const [hit] = await native.detect(source);
      if (hit?.rawValue) return hit.rawValue;
    } catch {
      // fall through to jsQR
    }
  }
  canvas ??= document.createElement("canvas");
  // Big enough for a phone held at arm's length, small enough to scan a few times a second.
  const scale = Math.min(1, 640 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

/** A prize code is a player's uid (Me → Prize QR). */
export const isPrizeCode = (s: string) => /^[\w-]{6,128}$/.test(s.trim());
