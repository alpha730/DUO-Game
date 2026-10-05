import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT } from "@shared/types";
import { CoinIcon, FlameIcon, SoundIcon } from "../components/Icons";
import ShareCard from "../components/ShareCard";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";
import { haptic, isMuted, play, setMuted } from "../lib/feedback";
import { useMyState } from "../lib/myState";
import { fmt, initial, liveDayStreak, playerLevel, POINTS_PER_LEVEL } from "../lib/trainer";

/** Profile card, prize QR, share card, sound toggle, logout (SPEC §7, PLAN 5.3). */
export default function Me() {
  const { user, profile, signOut } = useAuth();
  const { state: me } = useMyState(60_000);
  const qr = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted);

  // QR of the uid: the prize desk scans it (SPEC §7). Big quiet zone + error correction M so cheap
  // phone cameras read it off a cracked screen.
  useEffect(() => {
    if (!user || !qr.current) return;
    void QRCode.toCanvas(qr.current, user.uid, { width: 220, margin: 3, errorCorrectionLevel: "M" });
  }, [user]);

  const points = profile?.points ?? 0;
  const lvl = playerLevel(points);
  const streak = liveDayStreak(profile?.dayStreak, profile?.lastPlayDate, me?.today);
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const played = wins + losses;
  const accuracy = played ? Math.round((wins / played) * 100) : null;
  const avgSec = wins ? ((profile?.totalAnswerMs ?? 0) / wins / 1000).toFixed(1) : null;

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    haptic.tap();
    if (!next) play("correct");
  }

  return (
    <main className="screen with-nav stack me">
      <section className="card profile-card">
        <div className="profile-top">
          <span className="avatar avatar-lg" aria-hidden="true">
            {initial(profile?.name)}
          </span>
          <div className="profile-id">
            <h1>{profile?.name}</h1>
            <p className="small muted">{user?.email}</p>
          </div>
        </div>
        <div className="level-row">
          <span className="level-pill">Level {lvl.level}</span>
          <div className="level-bar" aria-hidden="true">
            <div style={{ width: `${lvl.progress * 100}%` }} />
          </div>
          <span className="small muted">{fmt(lvl.toNext)} to Lv {lvl.level + 1}</span>
        </div>
        <div className="stats" aria-label="Your stats">
          <div className="stat-box" data-stat="points">
            <CoinIcon size={22} />
            <strong>{fmt(points)}</strong>
            <span>points</span>
          </div>
          <div className="stat-box" data-stat="streak">
            <FlameIcon size={22} className="stat-flame" data-lit={streak.lit} />
            <strong>{streak.days}</strong>
            <span>days in a row</span>
          </div>
          <div className="stat-box" data-stat="caught">
            <span aria-hidden="true">📖</span>
            <strong>
              {profile?.lingosCaught ?? 0}/{LINGO_COUNT}
            </strong>
            <span>{BRAND.creatureName}s caught</span>
          </div>
          <div className="stat-box" data-stat="wins">
            <span aria-hidden="true">🎯</span>
            <strong>{wins}</strong>
            <span>catches</span>
          </div>
          <div className="stat-box" data-stat="accuracy">
            <span aria-hidden="true">✅</span>
            <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
            <span>accuracy</span>
          </div>
          <div className="stat-box" data-stat="speed">
            <span aria-hidden="true">⚡</span>
            <strong>{avgSec === null ? "—" : `${avgSec}s`}</strong>
            <span>avg answer</span>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Player level is just for fun: every {fmt(POINTS_PER_LEVEL)} points is a level.
        </p>
      </section>

      <section className="card qr-card" aria-label="Your prize QR code">
        <h2>🎁 Prize QR</h2>
        <canvas ref={qr} className="qr" data-uid={user?.uid} aria-label="QR code of your account" />
        <p className="small muted" style={{ margin: 0 }}>
          Show this at the prize desk. Prizes go only to this account, and your name must match your college ID card.
        </p>
      </section>

      {profile && (profile.favorites.length === 0 || profile.favoriteChangesLeft > 0) && (
        <Link className="btn secondary" to="/favorites">
          {profile.favorites.length === 0 ? "⭐ Pick your 2 favourites" : `⭐ Change favourites (${profile.favoriteChangesLeft} left)`}
        </Link>
      )}
      {profile && <ShareCard stats={{ name: profile.name, caught: profile.lingosCaught, points: profile.points }} />}

      <section className="card settings">
        <button className="setting-row" role="switch" aria-checked={!muted} onClick={toggleSound} data-sound={muted ? "off" : "on"}>
          <SoundIcon off={muted} />
          <span className="setting-label">
            <strong>Sound effects</strong>
            <span className="small muted">{muted ? "Off" : "On"} · vibration stays on where the phone supports it</span>
          </span>
          <span className="toggle" aria-hidden="true">
            <span />
          </span>
        </button>
      </section>

      <button className="btn secondary" onClick={signOut}>
        Log out
      </button>
    </main>
  );
}
