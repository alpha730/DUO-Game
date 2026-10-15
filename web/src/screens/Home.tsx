import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT, type CatchView, type GetMyStateOutput } from "@shared/types";
import CoBrand from "../components/CoBrand";
import EmptyState from "../components/EmptyState";
import GameClock, { gamePhase, useServerNow } from "../components/GameClock";
import Hud from "../components/Hud";
import { ScanIcon } from "../components/Icons";
import LevelBadge from "../components/LevelBadge";
import LingoArt from "../components/LingoArt";
import LingoPips from "../components/LingoPips";
import Mascot from "../components/Mascot";
import RaidBanner from "../components/RaidBanner";
import { BRAND, lingoName } from "../config/brand";
import { useAuth } from "../lib/auth";
import { dayBefore, triesLeft, triesUsed } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";
import { serverOffsetMs, useMyState } from "../lib/myState";
import { useOpenRaids } from "../lib/raids";

const MAX_DAY = 10;

/** A favourite's streak only counts while it was caught today or yesterday (else it restarts). */
function liveStreak(c: CatchView | undefined, today: string): number {
  if (!c?.lastCaughtDate) return 0;
  return c.lastCaughtDate === today || c.lastCaughtDate === dayBefore(today) ? c.favStreak : 0;
}

function FavoriteCard({ lingo, c, me }: { lingo: Lingo; c: CatchView | undefined; me: GetMyStateOutput | null }) {
  const today = me?.today ?? "";
  const streak = Math.min(liveStreak(c, today), MAX_DAY);
  const caughtToday = !!today && c?.lastCaughtDate === today;
  const used = caughtToday ? 0 : triesUsed(lingo.id, me);
  const left = triesLeft(lingo.id, me);
  const state = caughtToday ? "caught" : used > 0 && left === 0 ? "tried" : used > 0 ? "retry" : "open";
  return (
    <div className="fav-card" data-lingo={lingo.id} data-caught-today={caughtToday} data-state={state} style={{ "--lingo": lingo.color } as React.CSSProperties}>
      <div className="fav-card-art">
        <LingoArt lingo={lingo} mood={caughtToday ? "happy" : "calm"} />
      </div>
      <div className="fav-card-body">
        <div className="fav-card-name">
          <strong>{lingoName(lingo)}</strong>
          {c && <LevelBadge level={c.level} />}
        </div>
        <div className="fav-streak" aria-label={`Streak day ${streak} of ${MAX_DAY}`}>
          🔥 Day {streak}/{MAX_DAY}
        </div>
        <div className="fav-bar" aria-hidden="true">
          <div style={{ width: `${(streak / MAX_DAY) * 100}%` }} />
        </div>
        <span className="fav-today">{state === "caught" ? "Caught today ✓" : state === "tried" ? "Tried today ✗" : state === "retry" ? `Missed — ${left === 1 ? "1 more try" : `${left} more tries`} today` : "Not yet today"}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { profile } = useAuth();
  // Fresh on every visit (e.g. right after a catch); getMyState also auto-forfeits any open attempt.
  const { state: me, error, reload } = useMyState(0);
  const [lingos, setLingos] = useState<Lingo[]>([]);
  const raids = useOpenRaids();

  useEffect(() => {
    loadLingos().then(setLingos, () => {});
  }, []);

  // DECISION (Day 8): once Home is usable, the poster data (~3.8 MB, cached 30 days) starts
  // downloading in the background, so the first scan doesn't wait for it on 3G. Skipped on Save-Data.
  useEffect(() => {
    if (!me || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const t = setTimeout(() => void import("../ar/targets").then((m) => m.loadTargets()).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [me]);

  const catches = new Map((me?.catches ?? []).map((c) => [c.lingoId, c]));
  const favorites = (me?.user?.favorites ?? profile?.favorites ?? [])
    .map((id) => lingos.find((l) => l.id === id))
    .filter((l): l is Lingo => !!l);
  const caughtCount = me?.user?.lingosCaught ?? profile?.lingosCaught ?? 0;
  const firstName = profile?.name.split(" ")[0];
  const now = useServerNow(me ? serverOffsetMs() : 0);
  const phase = gamePhase(me, now);
  // The countdown reached 0: fetch the state again so Home switches to the open game.
  useEffect(() => {
    if (me && me.startAt !== null && phase === "before" && me.startAt - now <= 0) reload();
  }, [me, now, phase, reload]);

  return (
    <main className="screen with-nav stack home">
      <header className="topbar">
        <CoBrand variant="compact" />
      </header>
      <Hud state={me} />
      <GameClock phase={phase} me={me} now={now} />
      {me?.user?.disabled && (
        <EmptyState badge="⏸" title="Your account is paused" role="alert" data-empty="disabled">
          <p className="muted">The organisers have paused this account. Please talk to them at the help desk.</p>
        </EmptyState>
      )}

      {/* DET-style hero: one clear heading, one clear action. */}
      <section className="home-hero card" aria-label="Scan">
        <div className="home-hero-top">
          <div className="home-hero-text">
            <p className="eyebrow">
              Hi {firstName} <span aria-hidden="true">👋</span>
            </p>
            <h1 className="headline">ready to show your English?</h1>
            <p className="muted">Scan a poster on campus to meet a {BRAND.creatureName}.</p>
          </div>
          <Mascot slot="hero" mood="happy" className="home-hero-art" />
        </div>
        {phase === "open" ? (
          <Link to="/scan" className="btn big brand scan-hero-btn" aria-label="Scan a poster">
            <ScanIcon size={24} /> Scan a poster
          </Link>
        ) : (
          <button className="btn big brand scan-hero-btn" disabled aria-label="Scan a poster">
            <ScanIcon size={24} /> {phase === "before" ? "Opens soon" : "Hunt over"}
          </button>
        )}
        {me && <LingoPips left={me.attemptsLeft} total={me.attemptsPerDay} />}
        <Link className="rules-link" to="/rules" data-rules-link>
          {BRAND.uiIcons.overview && <img className="link-icon" src={BRAND.uiIcons.overview} alt="" aria-hidden="true" loading="lazy" />}
          How it works · Game rules →
        </Link>
      </section>

      {error && !me && (
        <EmptyState
          badge="📶"
          duo="dizzy"
          title="You're offline"
          data-empty="offline"
          actions={
            <button className="btn secondary" onClick={reload}>
              Try again
            </button>
          }
        >
          <p className="muted">We can't reach the game right now. Check Wi-Fi or mobile data.</p>
        </EmptyState>
      )}

      {favorites.length > 0 ? (
        <section className="stack" aria-label="Favourites" style={{ gap: 10 }}>
          <div className="section-title">
            <h3>⭐ Favourites</h3>
            <span className="small muted">10-day streak = MAX</span>
          </div>
          <div className="fav-cards">
            {favorites.map((l) => (
              <FavoriteCard key={l.id} lingo={l} c={catches.get(l.id)} me={me} />
            ))}
          </div>
        </section>
      ) : (
        caughtCount >= 2 && (
          <Link className="btn secondary" to="/favorites">
            ⭐ Pick your 2 favourites to start streaks
          </Link>
        )
      )}

      <RaidBanner raids={raids} offsetMs={me ? serverOffsetMs() : 0} />

      <section className="stack" aria-label={`Your ${BRAND.creatureName}s`} style={{ gap: 10 }}>
        <div className="section-title">
          <h3>
            Your Dex · {caughtCount}/{LINGO_COUNT}
          </h3>
          <Link to="/dex">See all ›</Link>
        </div>
        <div className="dex-strip">
          {(lingos.length ? lingos : Array.from({ length: LINGO_COUNT }, () => null)).map((l, i) => {
            const c = l ? catches.get(l.id) : undefined;
            const caught = !!c && c.timesCaught > 0;
            return (
              <Link
                key={l?.id ?? i}
                to={l ? `/dex?lingo=${l.id}` : "/dex"}
                className="lingo-slot"
                data-caught={caught}
                data-lingo={l?.id}
                style={l ? ({ "--lingo": l.color } as React.CSSProperties) : undefined}
                aria-label={l ? `${lingoName(l)} (${l.detYear}): ${caught ? `caught, level ${c!.level}` : "not caught"}` : undefined}
              >
                <span className="slot-art">{l && <LingoArt lingo={l} silhouette={!caught} />}</span>
                <span className="slot-name">{caught ? lingoName(l!) : "???"}</span>
                {caught ? <LevelBadge level={c!.level} /> : <span className="slot-year">{l?.detYear ?? 2016 + i}</span>}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
