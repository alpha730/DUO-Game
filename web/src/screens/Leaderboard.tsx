import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { COL, DOC, type StudentRow } from "@shared/types";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { db, usingEmulators } from "../lib/firebase";

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

  return (
    <main className="screen with-nav stack board-screen">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Leaderboard</h1>
        {board?.updatedAt && <span className="small muted">Updated {ago(board.updatedAt)}</span>}
      </header>
      {usingEmulators && (
        <button className="btn link small" onClick={refresh} style={{ minHeight: 36, alignSelf: "flex-start", width: "auto", padding: 0 }}>
          ↻ Refresh now (emulator)
        </button>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Ties: more accurate first, then faster answers, then who got there first. Updates every 10 minutes.
      </p>

      {board === undefined && <div className="spinner" style={{ alignSelf: "center" }} />}
      {board !== undefined && top.length === 0 && <p className="card muted">No scores yet — be the first to catch a Lingo!</p>}

      {top.length > 0 && (
        <ol className="board" aria-label="Top students">
          {top.map((r, i) => (
            <li key={r.uid} className="board-row" data-me={r.uid === user?.uid} data-rank={i + 1}>
              <span className="board-rank">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <span className="board-name">{r.name}</span>
              <span className="board-points">{fmt(r.points)}</span>
            </li>
          ))}
        </ol>
      )}

      {msg && <p className="error small">{msg}</p>}

      <section className="board-me" aria-label="Your rank" data-rank={myRank}>
        <span className="board-rank">{myRank}</span>
        <span className="board-name">{profile?.name} (you)</span>
        <span className="board-points">{fmt(profile?.points ?? 0)}</span>
      </section>
    </main>
  );
}
