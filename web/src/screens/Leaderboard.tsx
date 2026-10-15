import { ThemedImg } from "../components/BrandArt";
import { db, doc, onSnapshot } from "../lib/firestore";
import { useEffect, useState } from "react";
import { COL, DOC, type StudentRow } from "@shared/types";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usingEmulators } from "../lib/firebase";
import Hud from "../components/Hud";
import { BRAND } from "../config/brand";
import { useMyState } from "../lib/myState";
import { initial } from "../lib/trainer";

interface Board {
  top: StudentRow[];
  updatedAt: number | null;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

function ago(ms: number | null): string {
  if (!ms) return "";
  const min = Math.round((Date.now() - ms) / 60_000);
  return min < 1 ? "just now" : min === 1 ? "1 min ago" : `${min} min ago`;
}

/** One student list (rank, name, points), own row pinned at the bottom (SPEC §7, PLAN 5.2). */
export default function Leaderboard() {
  const { user, profile } = useAuth();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const { state: me } = useMyState(60_000); // HUD numbers; a minute-old copy is fine here

  // Cost rule: listen only while this screen is open (one doc, refreshed every 10 min).
  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.leaderboard, DOC.studentsBoard),
        (snap) => {
          const d = snap.data();
          setBoard(d ? { top: (d.top ?? []) as StudentRow[], updatedAt: d.updatedAt?.toMillis?.() ?? null } : null);
        },
        () => setBoard(null),
      ),
    [],
  );

  const top = board?.top ?? [];
  const myIndex = top.findIndex((r) => r.uid === user?.uid);
  const myRank = myIndex >= 0 ? String(myIndex + 1) : "100+";

  async function refresh() {
    setMsg("");
    try {
      await api.refreshLeaderboard({});
    } catch (err) {
      setMsg(apiErrorMessage(err));
    }
  }

  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const medal = ["gold", "silver", "bronze"];

  return (
    <main className="screen with-nav stack board-screen">
      <Hud state={me} />
      <header className="board-head">
        <p className="eyebrow with-icon" data-cobrand>
          <ThemedImg art={BRAND.det10.logo} alt="" className="board-det10" />
          {BRAND.coBrandShort}
        </p>
        <div className="section-title">
          <h1 className="headline" style={{ margin: 0 }}>leaderboard</h1>
          {board?.updatedAt && <span className="small muted">Updated {ago(board.updatedAt)}</span>}
        </div>
      </header>
      <div className="board-tabs" role="tablist" aria-label="Leaderboard">
        <span role="tab" aria-selected="true" className="board-tab">
          🎓 Students
        </span>
      </div>
      {usingEmulators && (
        <button className="btn link small" onClick={refresh} style={{ minHeight: 36, alignSelf: "flex-start", width: "auto", padding: 0 }}>
          ↻ Refresh now (emulator)
        </button>
      )}

      {board === undefined && <div className="spinner" style={{ alignSelf: "center" }} />}
      {board !== undefined && top.length === 0 && <p className="card muted">No scores yet — be the first to catch a Lingo!</p>}

      {top.length > 0 && (
        <ol className="board" aria-label="Top students">
          {podium.length > 0 && (
            <li className="podium">
              <ol className="podium-row">
                {podium.map((r, i) => (
                  <li key={r.uid} className="board-row podium-spot" data-medal={medal[i]} data-me={r.uid === user?.uid} data-rank={i + 1}>
                    <span className="podium-avatar" aria-hidden="true">
                      {initial(r.name)}
                      <span className="podium-crown">{["👑", "2", "3"][i]}</span>
                    </span>
                    <span className="board-name">{r.name}</span>
                    <span className="board-points">{fmt(r.points)}</span>
                    <span className="podium-block board-rank" aria-label={`Rank ${i + 1}`}>
                      {i + 1}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          )}
          {rest.map((r, i) => (
            <li key={r.uid} className="board-row" data-me={r.uid === user?.uid} data-rank={i + 4}>
              <span className="board-rank">{i + 4}</span>
              <span className="board-avatar" aria-hidden="true">
                {initial(r.name)}
              </span>
              <span className="board-name">{r.name}</span>
              <span className="board-points">{fmt(r.points)}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
        Ties: more accurate first, then faster answers, then who got there first. Updates every 10 minutes.
      </p>

      {msg && <p className="error small">{msg}</p>}

      <section className="board-me" aria-label="Your rank" data-rank={myRank}>
        <span className="board-rank">{myRank}</span>
        <span className="board-avatar" aria-hidden="true">
          {initial(profile?.name)}
        </span>
        <span className="board-name">{profile?.name} (you)</span>
        <span className="board-points">{fmt(profile?.points ?? 0)}</span>
      </section>
    </main>
  );
}
