import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT } from "@shared/types";
import AboutSheet from "../components/AboutSheet";
import { Det10Icon, DuoArt, StreakFlame } from "../components/BrandArt";
import { CoinIcon, SoundIcon } from "../components/Icons";
import PrepCard from "../components/PrepCard";
import ShareCard from "../components/ShareCard";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";
import { haptic, isMuted, play, setMuted } from "../lib/feedback";
import { useMyState } from "../lib/myState";
import { periodWords } from "../lib/period";
import { readSkills, type SkillCounts } from "../lib/skills";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";
import { fmt, initial, liveDayStreak, playerLevel, POINTS_PER_LEVEL } from "../lib/trainer";

const pct = (c: { right: number; total: number }) => (c.total ? Math.round((c.right / c.total) * 100) : null);

/** One DET-style skill bar (accuracy on this phone). */
function SkillBar({ label, sub, c }: { label: string; sub: string; c: { right: number; total: number } }) {
  const p = pct(c);
  return (
    <div className="skill" data-skill={label.toLowerCase()}>
      <div className="skill-head">
        <strong>{label}</strong>
        <span className="skill-val">{p === null ? "—" : `${p}%`}</span>
      </div>
      <div className="skill-bar" role="img" aria-label={p === null ? `${label}: no answers yet` : `${label}: ${p}% right`}>
        <i style={{ width: `${p ?? 0}%` }} />
      </div>
      <span className="small muted">
        {sub} · {c.total ? `${c.right}/${c.total} right` : "no answers yet"}
      </span>
    </div>
  );
}

/** Your skills: Reading + Speaking from this phone's answers, catches + accuracy from the server. */
function SkillsPanel({ skills, wins, accuracy }: { skills: SkillCounts; wins: number; accuracy: number | null }) {
  return (
    <section className="card skills" aria-label="Your skills" data-skills>
      <h2 className="with-icon">
        <Det10Icon name="books" /> Your skills
      </h2>
      {BRAND.duo.placementTest && <DuoArt mood="placementTest" className="skills-duo" />}
      <SkillBar label="Reading" sub="Choose the Meaning + Fill in the Blanks" c={skills.reading} />
      <SkillBar label="Speaking" sub="Read Aloud" c={skills.speaking} />
      <div className="skills-totals">
        <span>
          <strong>{wins}</strong> catches
        </span>
        <span>
          <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong> accuracy
        </span>
      </div>
      <p className="skills-note small">
        {BRAND.appName} stats — not an official {BRAND.examShortName} score. Reading and Speaking count the answers given on this phone.
      </p>
    </section>
  );
}

const THEMES: Array<[ThemePref, string]> = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "System"],
];

/** Profile card, skills, prize QR, share card, appearance + sound, about, logout (SPEC §7, PLAN 5.3). */
export default function Me() {
  const { user, profile, signOut } = useAuth();
  const { state: me } = useMyState(60_000);
  const qr = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [about, setAbout] = useState(false);
  const [skills] = useState(() => readSkills(user?.uid));

  function chooseTheme(t: ThemePref) {
    setThemePref(t);
    setTheme(t);
  }

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
            <StreakFlame size={streak.lit ? 30 : 22} className="stat-flame" lit={streak.lit} />
            <strong>{streak.days}</strong>
            <span>{periodWords(me?.round).unit}s in a row</span>
          </div>
          <div className="stat-box" data-stat="caught">
            <Det10Icon name="books" fallback="📖" className="stat-icon" />
            <strong>
              {profile?.lingosCaught ?? 0}/{LINGO_COUNT}
            </strong>
            <span>{BRAND.creatureName}s caught</span>
          </div>
          <div className="stat-box" data-stat="wins">
            <Det10Icon name="backpack" fallback="🎯" className="stat-icon" />
            <strong>{wins}</strong>
            <span>catches</span>
          </div>
          <div className="stat-box" data-stat="accuracy">
            <Det10Icon name="key" fallback="✅" className="stat-icon" />
            <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
            <span>accuracy</span>
          </div>
          <div className="stat-box" data-stat="speed">
            <Det10Icon name="doorOpen" fallback="⚡" className="stat-icon" />
            <strong>{avgSec === null ? "—" : `${avgSec}s`}</strong>
            <span>avg answer</span>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Player level is just for fun: every {fmt(POINTS_PER_LEVEL)} points is a level.
        </p>
      </section>

      <SkillsPanel skills={skills} wins={wins} accuracy={accuracy} />
      <PrepCard />

      <section className="card qr-card" aria-label="Your prize QR code">
        <h2 className="with-icon">
          <Det10Icon name="key" fallback="🎁" /> Prize QR
        </h2>
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
      {profile && <ShareCard stats={{ name: profile.name, caught: profile.lingosCaught, points: profile.points, caughtIds: me?.catches.filter((c) => c.timesCaught > 0).map((c) => c.lingoId) }} />}

      <section className="card settings">
        <div className="setting-row appearance">
          <span className="setting-label">
            <strong id="appearance-label">Appearance</strong>
            <span className="small muted">System follows your phone</span>
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="appearance-label">
            {THEMES.map(([t, label]) => (
              <button key={t} role="radio" aria-checked={theme === t} data-theme-option={t} onClick={() => chooseTheme(t)}>
                {label}
              </button>
            ))}
          </div>
        </div>
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

      <Link className="btn secondary" to="/rules" data-rules-link>
        Game rules
      </Link>
      <button className="btn secondary" onClick={() => setAbout(true)} data-about-open>
        About {BRAND.appName}
      </button>
      <button className="btn secondary" onClick={signOut}>
        Log out
      </button>
      {about && <AboutSheet onClose={() => setAbout(false)} />}
    </main>
  );
}
