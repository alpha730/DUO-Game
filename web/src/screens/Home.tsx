import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT, type CatchView, type GetMyStateOutput } from "@shared/types";
import LevelBadge from "../components/LevelBadge";
import { BRAND, lingoName } from "../config/brand";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dayBefore } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";
import { useOpenRaids } from "../lib/raids";
import RaidBanner from "../components/RaidBanner";

const MAX_DAY = 10;

/** A favourite's streak only counts while it was caught today or yesterday (else it restarts). */
function liveStreak(c: CatchView | undefined, today: string): number {
  if (!c?.lastCaughtDate) return 0;
  return c.lastCaughtDate === today || c.lastCaughtDate === dayBefore(today) ? c.favStreak : 0;
}

function FavoriteCard({ lingo, c, today }: { lingo: Lingo; c: CatchView | undefined; today: string }) {
  const streak = liveStreak(c, today);
  const caughtToday = c?.lastCaughtDate === today;
  return (
    <div className="fav-card" data-lingo={lingo.id} data-caught-today={caughtToday}>
      <span className="swatch" style={{ background: lingo.color }} aria-hidden="true" />
      <div className="fav-card-body">
        <div className="row" style={{ gap: 6, justifyContent: "space-between" }}>
          <strong>{lingoName(lingo)}</strong>
          {c && <LevelBadge level={c.level} />}
        </div>
        <div className="fav-streak" aria-label={`Streak day ${streak} of ${MAX_DAY}`}>
          🔥 Day {Math.min(streak, MAX_DAY)}/{MAX_DAY}
        </div>
        <div className="fav-bar">
          <div style={{ width: `${(Math.min(streak, MAX_DAY) / MAX_DAY) * 100}%` }} />
        </div>
        <span className={caughtToday ? "small done-today" : "small muted"}>{caughtToday ? "Caught today ✓" : "Not yet today"}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { profile } = useAuth();
  const [me, setMe] = useState<GetMyStateOutput | null>(null);
  const [lingos, setLingos] = useState<Lingo[]>([]);
  const [offsetMs, setOffsetMs] = useState(0); // server clock − phone clock (for countdowns)
  const raids = useOpenRaids();

  // Fresh on every visit (e.g. right after a catch); also auto-forfeits any open attempt.
  useEffect(() => {
    api.getMyState({}).then((s) => {
      setMe(s);
      setOffsetMs(s.serverNow - Date.now());
    }, () => {});
    loadLingos().then(setLingos, () => {});
  }, []);

  // DECISION (Day 8): once Home is usable, the poster data (~3.8 MB, cached 30 days) starts
  // downloading in the background, so the first scan doesn't wait for it on 3G. Skipped on Save-Data.
  useEffect(() => {
    if (!me || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const t = setTimeout(() => void import("../ar/targets").then((m) => m.loadTargets()).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [me]);

  const today = me?.today ?? "";
  const catches = new Map((me?.catches ?? []).map((c) => [c.lingoId, c]));
  const favorites = (me?.user?.favorites ?? profile?.favorites ?? [])
    .map((id) => lingos.find((l) => l.id === id))
    .filter((l): l is Lingo => !!l);
  const caughtCount = me?.user?.lingosCaught ?? profile?.lingosCaught ?? 0;
  const points = profile?.points ?? me?.user?.points ?? 0;

  return (
    <main className="screen with-nav stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            Hi {profile?.name.split(" ")[0]}
          </p>
          <h1 style={{ margin: 0 }}>{BRAND.appName}</h1>
        </div>
        <div className="row small" style={{ gap: 8 }}>
          <span className="card stat" title="Days in a row with a catch">
            🔥 {profile?.dayStreak ?? 0}
          </span>
          <span className="card stat" data-points={points} title="Points">
            ⭐ {points.toLocaleString("en-IN")}
          </span>
        </div>
      </header>

      <RaidBanner raids={raids} offsetMs={offsetMs} />

      {me && (
        <p className="attempts-pill" data-left={me.attemptsLeft}>
          Attempts left today: <strong>{me.attemptsLeft}/{me.attemptsPerDay}</strong>
        </p>
      )}

      {favorites.length > 0 ? (
        <section className="stack" aria-label="Favourites">
          <h3 style={{ margin: 0 }}>Favourites</h3>
          <div className="fav-cards">
            {favorites.map((l) => (
              <FavoriteCard key={l.id} lingo={l} c={catches.get(l.id)} today={today} />
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

      <section className="card">
        <h3>
          Your {BRAND.creatureName}s · {caughtCount}/{LINGO_COUNT}
        </h3>
        <div className="lingo-grid">
          {(lingos.length ? lingos : Array.from({ length: LINGO_COUNT }, () => null)).map((l, i) => {
            const c = l ? catches.get(l.id) : undefined;
            const caught = !!c && c.timesCaught > 0;
            return (
              <div
                key={l?.id ?? i}
                className="lingo-slot"
                data-caught={caught}
                data-lingo={l?.id}
                style={caught ? { background: l!.color } : undefined}
                aria-label={l ? `${lingoName(l)} (${l.detYear}): ${caught ? `caught, level ${c!.level}` : "not caught"}` : undefined}
              >
                {caught ? (
                  <>
                    <span className="slot-name">{lingoName(l!)}</span>
                    <LevelBadge level={c!.level} />
                  </>
                ) : (
                  <span className="slot-silhouette" aria-hidden="true">
                    ?
                  </span>
                )}
                <span className="slot-year">{l?.detYear ?? 2016 + i}</span>
              </div>
            );
          })}
        </div>
      </section>

      <Link className="btn" to="/scan">
        📷 Scan a poster
      </Link>
    </main>
  );
}
