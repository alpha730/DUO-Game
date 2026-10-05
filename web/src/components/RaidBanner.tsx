import { Link } from "react-router-dom";
import { BRAND } from "../config/brand";
import { mmss, raidPhase, useServerNow, type Raid } from "../lib/raids";

/** Home banner for the next/live Owl Raid with a countdown (PLAN 6.2). Hidden when none. */
export default function RaidBanner({ raids, offsetMs }: { raids: Raid[]; offsetMs: number }) {
  const now = useServerNow(offsetMs);
  const live = raids.filter((r) => raidPhase(r, now) === "active").sort((a, b) => a.endAt - b.endAt)[0];
  const next = raids.filter((r) => raidPhase(r, now) === "scheduled").sort((a, b) => a.startAt - b.startAt)[0];
  const raid = live ?? next;
  if (!raid) return null;

  return (
    <Link to="/scan" className="raid-banner" data-phase={live ? "active" : "scheduled"} data-raid={raid.id}>
      <span className="raid-icon" aria-hidden="true">
        🦉
      </span>
      <span className="raid-text">
        <span className="raid-kicker">{live ? "Live now" : "Coming up"}</span>
        <strong>
          {`${BRAND.raidName}${live ? " live" : ""} at poster ${raid.posterIndex + 1}${live ? "!" : ""}`}
        </strong>
        <span className="small">
          {live ? (raid.unlocked ? "Unlocked — go!" : "Scan the poster to join") : "Get there with your friends"}
        </span>
      </span>
      <span className="raid-clock">
        <span className="raid-clock-label">{live ? "Ends in" : "Starts in"}</span>
        <span data-countdown>{mmss((live ? raid.endAt : raid.startAt) - now)}</span>
      </span>
    </Link>
  );
}
