import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LINGO_COUNT, type CatchView } from "@shared/types";
import Hud from "../components/Hud";
import { Det10Icon } from "../components/BrandArt";

/** Dex categories → DET 10 icons. */
const RARITY_ICON = { common: "books", rare: "globe", epic: "key", legendary: "doorOpen" } as const;
import { CloseIcon, StarIcon } from "../components/Icons";
import LevelBadge from "../components/LevelBadge";
import LingoArt from "../components/LingoArt";
import { BRAND, lingoName } from "../config/brand";
import { dayBefore } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";
import { useMyState } from "../lib/myState";
import { fmt } from "../lib/trainer";

const istDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Bottom sheet with one Lingo's big art + stats (?lingo=<id>). */
function DetailSheet({
  lingo,
  c,
  favorite,
  today,
  onClose,
}: {
  lingo: Lingo;
  c: CatchView | undefined;
  favorite: boolean;
  today: string | undefined;
  onClose: () => void;
}) {
  const caught = !!c && c.timesCaught > 0;
  const name = caught ? lingoName(lingo) : "???";
  const alive = !!c?.lastCaughtDate && !!today && (c.lastCaughtDate === today || c.lastCaughtDate === dayBefore(today));
  const streak = favorite && alive ? c!.favStreak : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet dex-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={name}
        data-lingo={lingo.id}
        data-caught={caught}
        style={{ "--lingo": lingo.color } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="dex-sheet-art" data-level={c?.level}>
          <LingoArt lingo={lingo} silhouette={!caught} level={c?.level} favStreak={streak} />
        </div>
        <div className="dex-sheet-head">
          <span className="dex-no">#{String(lingo.posterIndex + 1).padStart(2, "0")}</span>
          <h2>{name}</h2>
          {caught && <LevelBadge level={c!.level} />}
          {favorite && <StarIcon className="dex-fav" aria-label="Favourite" />}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {BRAND.creatureName} of {lingo.detYear} · <span className="dex-rarity">
              <Det10Icon name={RARITY_ICON[lingo.rarity]} className="chip-icon" />
              {lingo.rarity}
            </span>
        </p>
        {caught ? (
          <>
            <div className="dex-stats">
              <div>
                <strong>{fmt(c!.timesCaught)}</strong>
                <span>times caught</span>
              </div>
              <div>
                <strong>{c!.firstCaughtAt ? istDate(c!.firstCaughtAt) : "—"}</strong>
                <span>first caught</span>
              </div>
              <div>
                <strong>{c!.lastCaughtDate === today ? "Today" : c!.lastCaughtDate ? istDate(Date.parse(c!.lastCaughtDate)) : "—"}</strong>
                <span>last caught</span>
              </div>
            </div>
            {favorite ? (
              <div className="dex-streak">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong className="fav-streak">🔥 Day {Math.min(streak, 10)}/10</strong>
                  <span className="small muted">{c!.level === "MAX" ? "MAX form unlocked" : "10 days in a row = MAX"}</span>
                </div>
                <div className="fav-bar" aria-hidden="true">
                  <div style={{ width: `${(Math.min(streak, 10) / 10) * 100}%` }} />
                </div>
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                Make it a favourite to build a streak — 10 days in a row unlocks its MAX form.
              </p>
            )}
          </>
        ) : (
          <p className="dex-hint">Find poster {lingo.posterIndex + 1} on campus and scan it to meet this {BRAND.creatureName}.</p>
        )}
        <Link className="btn" to="/scan">
          {caught ? "Scan a poster" : "Go find it"}
        </Link>
      </section>
    </div>
  );
}

/** Dex: all 10 Lingos in year order 2016 → 2025, caught in colour, uncaught as silhouettes. */
export default function Dex() {
  const { state: me } = useMyState(0);
  const [lingos, setLingos] = useState<Lingo[]>([]);
  const [params, setParams] = useSearchParams();
  const open = params.get("lingo");

  useEffect(() => {
    loadLingos().then(setLingos, () => {});
  }, []);

  const catches = new Map((me?.catches ?? []).map((c) => [c.lingoId, c]));
  const favorites = me?.user?.favorites ?? [];
  const caughtCount = (me?.catches ?? []).filter((c) => c.timesCaught > 0).length;
  const sorted = [...lingos].sort((a, b) => a.detYear - b.detYear);
  const openLingo = sorted.find((l) => l.id === open);

  return (
    <main className="screen with-nav stack dex">
      <Hud state={me} />
      <div className="section-title">
        <h1 className="headline with-icon" style={{ margin: 0 }}>
          <Det10Icon name="backpack" /> dex
        </h1>
        <span className="dex-count">
          <strong>{caughtCount}</strong>/{LINGO_COUNT} caught
        </span>
      </div>
      <div className="dex-progress" aria-hidden="true">
        <div style={{ width: `${(caughtCount / LINGO_COUNT) * 100}%` }} />
      </div>

      <ol className="dex-grid" aria-label={`${BRAND.creatureName}s`}>
        {(sorted.length ? sorted : Array.from({ length: LINGO_COUNT }, () => null)).map((l, i) => {
          const c = l ? catches.get(l.id) : undefined;
          const caught = !!c && c.timesCaught > 0;
          return (
            <li key={l?.id ?? i}>
              <button
                className="dex-card"
                data-lingo={l?.id}
                data-caught={caught}
                data-level={caught ? c!.level : undefined}
                disabled={!l}
                onClick={() => l && setParams({ lingo: l.id })}
                style={l ? ({ "--lingo": l.color } as React.CSSProperties) : undefined}
                aria-label={l ? `${caught ? lingoName(l) : "Unknown"} (${l.detYear})${caught ? `, level ${c!.level}, caught ${c!.timesCaught} times` : ", not caught yet"}` : undefined}
              >
                <span className="dex-no">#{String(i + 1).padStart(2, "0")}</span>
                {l && favorites.includes(l.id) && <StarIcon className="dex-fav" />}
                <span className="dex-card-art">{l && <LingoArt lingo={l} silhouette={!caught} level={c?.level} favStreak={favorites.includes(l.id) ? c?.favStreak : 0} />}</span>
                <span className="dex-card-name">{caught ? lingoName(l!) : "???"}</span>
                <span className="dex-card-meta">
                  <span className="dex-year">{l?.detYear ?? 2016 + i}</span>
                  {caught && <LevelBadge level={c!.level} />}
                </span>
                {caught && <span className="dex-times">×{c!.timesCaught}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {openLingo && (
        <DetailSheet
          lingo={openLingo}
          c={catches.get(openLingo.id)}
          favorite={favorites.includes(openLingo.id)}
          today={me?.today}
          onClose={() => setParams({}, { replace: true })}
        />
      )}
    </main>
  );
}
