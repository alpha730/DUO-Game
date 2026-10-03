import { useEffect, useState } from "react";
import type { Level, SubmitAttemptOutput } from "@shared/types";
import { BRAND } from "../config/brand";

const fmt = (n: number) => n.toLocaleString("en-IN");
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Counts 0 → value over ~0.8 s (instant with reduced motion). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    let id = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return shown;
}

const CONFETTI = BRAND.colors.confetti;

/** PLAN 4.7: "+100" pop, breakdown, level-up / MAX / all-10 celebrations. */
export default function WinCelebration({
  data,
  lingoName,
  prevLevel,
}: {
  data: SubmitAttemptOutput;
  lingoName: string;
  /** Level before this catch; null on the first-ever catch. */
  prevLevel: Level | null;
}) {
  const shown = useCountUp(data.pointsAdded);
  const bonusTotal = data.bonuses.reduce((s, b) => s + b.points, 0);
  const base = data.pointsAdded - data.speedBonus - bonusTotal;
  const max = data.bonuses.find((b) => b.kind === "max");
  const allTen = data.bonuses.find((b) => b.kind === "allTen");
  const levelUp = prevLevel !== null && data.newLevel !== prevLevel && !max;

  return (
    <div className="win" data-celebration={max ? "max" : allTen ? "all-ten" : levelUp ? "level-up" : "catch"}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ "--i": i, background: CONFETTI[i % CONFETTI.length] } as React.CSSProperties} />
        ))}
      </div>
      {BRAND.mascots.celebrate && <img className="mascot-celebrate" src={BRAND.mascots.celebrate} alt="" />}
      <p className="points-pop" aria-label={`plus ${data.pointsAdded} points`}>
        +{fmt(shown)}
      </p>
      <p className="breakdown small muted">
        {data.raid ? BRAND.raidName : prevLevel === null ? "First catch" : data.favStreak ? `Favourite · day ${data.favStreak}` : "Catch"} +
        {fmt(base)}
        {data.speedBonus > 0 && <> · Speed +{data.speedBonus}</>}
      </p>
      {data.favStreak !== undefined && data.favStreak > 0 && !max && (
        <p className="celebrate streak-text">🔥 Day {data.favStreak} streak — keep it going!</p>
      )}
      {levelUp && (
        <p className="celebrate level-up">
          ⬆️ {lingoName} reached Level {String(data.newLevel)}!
        </p>
      )}
      {max && (
        <p className="celebrate max">
          🌟 {lingoName} MAX form unlocked! +{fmt(max.points)}
        </p>
      )}
      {allTen && (
        <p className="celebrate all-ten">
          🏆 All 10 {BRAND.creatureName}s collected! +{fmt(allTen.points)}
        </p>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Total: {fmt(data.newTotal)} points
      </p>
    </div>
  );
}
