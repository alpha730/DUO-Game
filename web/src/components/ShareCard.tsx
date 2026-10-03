import { useEffect, useRef, useState } from "react";
import { canvasToBlob, drawShareCard, shareOrDownload, type ShareStats } from "../lib/shareCard";

/** Share card on Me (PLAN 7.5): preview + "Share" (Web Share API with the image, else download). */
export default function ShareCard({ stats }: { stats: ShareStats }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const { name, caught, points } = stats;

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    const el = canvas.current;
    if (!el) return;
    drawShareCard(el, { name, caught, points })
      .then(() => canvasToBlob(el))
      .then((b) => {
        if (!live) return;
        url = URL.createObjectURL(b);
        setPreview(url);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [name, caught, points]);

  async function share() {
    if (!canvas.current) return;
    setBusy(true);
    setNote("");
    try {
      const out = await shareOrDownload(await canvasToBlob(canvas.current), stats);
      if (out === "downloaded") setNote("Saved the image — post it to your story!");
    } catch {
      setNote("Couldn't make the image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card share-card stack" aria-label="Share card">
      <canvas ref={canvas} hidden />
      {preview && <img className="share-preview" src={preview} alt={`Share card: ${caught} caught, ${points} points`} />}
      <button className="btn" onClick={share} disabled={busy || !preview} data-share>
        {busy ? "Preparing…" : "📤 Share my card"}
      </button>
      {note && (
        <p className="small muted" style={{ margin: 0 }} role="status">
          {note}
        </p>
      )}
    </section>
  );
}
