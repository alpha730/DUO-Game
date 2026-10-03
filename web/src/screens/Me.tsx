import QRCode from "qrcode";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT } from "@shared/types";
import Placeholder from "../components/Placeholder";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";

const fmt = (n: number) => n.toLocaleString("en-IN");

/** Prize QR (uid), stats, favourites, logout (SPEC §7, PLAN 5.3). */
export default function Me() {
  const { user, profile, signOut } = useAuth();
  const qr = useRef<HTMLCanvasElement>(null);

  // QR of the uid: the prize desk scans it (SPEC §7). Big quiet zone + error correction M so cheap
  // phone cameras read it off a cracked screen.
  useEffect(() => {
    if (!user || !qr.current) return;
    void QRCode.toCanvas(qr.current, user.uid, { width: 220, margin: 3, errorCorrectionLevel: "M" });
  }, [user]);

  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const played = wins + losses;
  const accuracy = played ? Math.round((wins / played) * 100) : null;
  const avgSec = wins ? ((profile?.totalAnswerMs ?? 0) / wins / 1000).toFixed(1) : null;

  return (
    <main className="screen with-nav stack">
      <header>
        <h1 style={{ margin: 0 }}>{profile?.name}</h1>
        <p className="small muted" style={{ margin: 0 }}>
          {user?.email}
        </p>
      </header>

      <section className="card qr-card" aria-label="Your prize QR code">
        <canvas ref={qr} className="qr" data-uid={user?.uid} aria-label="QR code of your account" />
        <p className="small muted" style={{ margin: 0 }}>
          Show this at the prize desk. Prizes go only to this account, and your name must match your college ID card.
        </p>
      </section>

      <section className="stats" aria-label="Your stats">
        <div className="stat-box" data-stat="points">
          <strong>{fmt(profile?.points ?? 0)}</strong>
          <span>points</span>
        </div>
        <div className="stat-box" data-stat="caught">
          <strong>
            {profile?.lingosCaught ?? 0}/{LINGO_COUNT}
          </strong>
          <span>{BRAND.creatureName}s caught</span>
        </div>
        <div className="stat-box" data-stat="wins">
          <strong>{wins}</strong>
          <span>catches</span>
        </div>
        <div className="stat-box" data-stat="accuracy">
          <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
          <span>accuracy</span>
        </div>
        <div className="stat-box" data-stat="speed">
          <strong>{avgSec === null ? "—" : `${avgSec}s`}</strong>
          <span>avg answer</span>
        </div>
        <div className="stat-box" data-stat="streak">
          <strong>🔥 {profile?.dayStreak ?? 0}</strong>
          <span>days in a row</span>
        </div>
      </section>

      {profile && (profile.favorites.length === 0 || profile.favoriteChangesLeft > 0) && (
        <Link className="btn secondary" to="/favorites">
          {profile.favorites.length === 0 ? "⭐ Pick your 2 favourites" : `⭐ Change favourites (${profile.favoriteChangesLeft} left)`}
        </Link>
      )}
      <Placeholder day={7}>Share card</Placeholder>
      <button className="btn secondary" onClick={signOut}>
        Log out
      </button>
    </main>
  );
}
