import { useEffect, useState } from "react";
import type { Level, SubmitAttemptOutput } from "@shared/types";
import { BRAND } from "../config/brand";
import { haptic, play } from "../lib/feedback";
import type { Lingo } from "../lib/lingos";
import LingoArt from "./LingoArt";

const fmt = (n: number) => n.toLocaleString("en-IN");
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Counts 0 → value over ~0.9 s (instant with reduced motion). */
function useCountUp(value: number, delayMs = 250) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    let id = 0;
    const startAt = performance.now() + delayMs;
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - startAt) / 900));
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value, delayMs]);
  return shown;
}

const CONFETTI = BRAND.themes.light.confetti;

/** Confetti burst from the centre of its (overflow-hidden) parent. */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--i": i,
              "--a": `${(i * 137.5) % 360}deg`,
              "--d": `${90 + ((i * 53) % 110)}px`,
              background: CONFETTI[i % CONFETTI.length],
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

type Big = { kind: "level-up" | "max" | "all-ten"; icon: string; title: string; sub: string };

/** Full-screen card for the big moments (level up, MAX form, all 10). */
function BigMoment({ big, lingo, onClose }: { big: Big; lingo: Lingo | null; onClose: () => void }) {
  useEffect(() => {
    play("levelup");
    haptic.win();
  }, []);
  return (
    <div className="celebration-backdrop" onClick={onClose}>
      <section className="celebration-card" data-big={big.kind} role="dialog" aria-modal="true" aria-label={big.title} onClick={(e) => e.stopPropagation()}>
        <Confetti pieces={44} />
        <div className="celebration-art">
          {lingo ? <LingoArt lingo={lingo} className="react-win" /> : <span className="celebration-icon">{big.icon}</span>}
        </div>
        <span className="celebration-kicker">
          {big.icon} {big.kind === "max" ? "MAX form" : big.kind === "all-ten" ? "Collection complete" : "Level up"}
        </span>
        <h2 className={`celebrate ${big.kind}`}>{big.title}</h2>
        <p className="muted">{big.sub}</p>
        <button className="btn big" onClick={onClose} autoFocus>
          Awesome!
        </button>
      </section>
    </div>
  );
}

/** PLAN 4.7: "+169" count-up, a DET-style breakdown list, then a full-screen card for level-up / MAX / all 10. */
export default function WinCelebration({
  data,
  lingoName,
  lingo = null,
  prevLevel,
}: {
  data: SubmitAttemptOutput;
  lingoName: string;
  lingo?: Lingo | null;
  /** Level before this catch; null on the first-ever catch. */
  prevLevel: Level | null;
}) {
  const shown = useCountUp(data.pointsAdded);
  const bonusTotal = data.bonuses.reduce((s, b) => s + b.points, 0);
  const base = data.pointsAdded - data.speedBonus - bonusTotal;
  const max = data.bonuses.find((b) => b.kind === "max");
  const allTen = data.bonuses.find((b) => b.kind === "allTen");
  const levelUp = prevLevel !== null && data.newLevel !== prevLevel && !max;
  const kind = max ? "max" : allTen ? "all-ten" : levelUp ? "level-up" : "catch";

  // The biggest moment gets the full-screen card (MAX beats all-10 beats level up).
  const big: Big | null = max
    ? { kind: "max", icon: "🌟", title: `${lingoName} MAX form unlocked! +${fmt(max.points)}`, sub: "10 days in a row — legendary dedication." }
    : allTen
      ? { kind: "all-ten", icon: "🏆", title: `All 10 ${BRAND.creatureName}s collected! +${fmt(allTen.points)}`, sub: "Every poster, every year. The full Dex!" }
      : levelUp
        ? { kind: "level-up", icon: "⬆️", title: `${lingoName} reached Level ${String(data.newLevel)}!`, sub: "Keep catching it to grow it further." }
        : null;
  const [showBig, setShowBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    const t = setTimeout(() => setShowBig(true), reducedMotion() ? 0 : 1300);
    return () => clearTimeout(t);
  }, [!!big]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseLabel = data.raid
    ? BRAND.raidName
    : prevLevel === null
      ? "First catch"
      : data.favStreak
        ? `Favourite · day ${data.favStreak}`
        : "Catch";

  return (
    <div className="win" data-celebration={kind}>
      <p className="points-pop" aria-label={`plus ${data.pointsAdded} points`}>
        +{fmt(shown)}
      </p>
      {/* DET-style score breakdown: one row per part, then the total for this catch. */}
      <dl className="breakdown">
        <div className="bd-row">
          <dt>{baseLabel}</dt>
          <dd>+{fmt(base)}</dd>
        </div>
        {data.speedBonus > 0 && (
          <div className="bd-row">
            <dt>⚡ Speed bonus</dt>
            <dd>+{data.speedBonus}</dd>
          </div>
        )}
        {max && (
          <div className="bd-row">
            <dt>🌟 MAX bonus</dt>
            <dd>+{fmt(max.points)}</dd>
          </div>
        )}
        {allTen && (
          <div className="bd-row">
            <dt>🏆 All 10 bonus</dt>
            <dd>+{fmt(allTen.points)}</dd>
          </div>
        )}
        <div className="bd-row bd-total">
          <dt>This catch</dt>
          <dd>+{fmt(data.pointsAdded)}</dd>
        </div>
      </dl>
      <p className="win-total">
        Your total: <strong>{fmt(data.newTotal)}</strong> points
      </p>
      {/* Kept in the page (screen readers, tests) even while the full-screen card isn't open. */}
      {big && !showBig && (
        <p className={`celebrate-line ${big.kind}`}>
          {big.icon} {big.title}
        </p>
      )}
      {big && showBig && <BigMoment big={big} lingo={lingo} onClose={() => setShowBig(false)} />}
    </div>
  );
}
