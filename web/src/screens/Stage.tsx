import { useCallback, useEffect, useState } from "react";
import { COL, DOC, type StageQuestion, type StageReveal, type StudentRow } from "@shared/types";
import CoBrand from "../components/CoBrand";
import { useServerNow } from "../components/GameClock";
import { api, apiErrorMessage } from "../lib/api";
import { db, doc, getDoc } from "../lib/firestore";
import { serverOffsetMs, useMyState, useRoundRefresh } from "../lib/myState";
import { istTime } from "../lib/period";
import { stageTop } from "../lib/stage";

/** About every 30 s (the board itself is rebuilt every 10 min, or by "Refresh leaderboard"). */
const POLL_MS = 30_000;
const fmt = (n: number) => n.toLocaleString("en-IN");

/** "1:05:09" / "05:09" */
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

type MyState = ReturnType<typeof useMyState>["state"];

/** Round status: "Round 2 of 3" + a big countdown (to the round's end, or to the next start). */
function RoundStatus({ me, now }: { me: MyState; now: number }) {
  if (!me) return <section className="stage-round" aria-busy="true" />;
  const r = me.round;
  const over = me.locked || (me.lockAt !== null && now >= me.lockAt) || (r !== null && !r.active && now >= r.endAt);
  let title: string;
  let label = "";
  let target: number | null = null;
  if (over) title = r ? "All rounds are over" : "The hunt is over";
  else if (!r) {
    title = "The hunt is on";
    label = "until the lock";
    target = me.lockAt;
  } else if (r.active) {
    title = `Round ${r.n} of ${r.of}`;
    label = `left in the round · until ${istTime(r.endAt)}`;
    target = r.endAt;
  } else {
    title = `Round ${r.n} of ${r.of}`;
    label = `until it starts · ${istTime(r.startAt)}`;
    target = r.startAt;
  }
  return (
    <section className="stage-round" data-stage-round={over ? "over" : r?.active === false ? "between" : "active"}>
      <h1 className="stage-round-title">{title}</h1>
      {target !== null && (
        <p className="stage-countdown">
          <span className="stage-countdown-time" data-countdown>
            {clock(target - now)}
          </span>
          <span className="stage-countdown-label">{label}</span>
        </p>
      )}
    </section>
  );
}

function TopTen({ rows, afterLock, updatedAt }: { rows: StudentRow[] | null; afterLock: boolean; updatedAt: number | null }) {
  const top = stageTop(rows ?? [], afterLock);
  return (
    <section className="stage-board" aria-label="Live top 10">
      <header className="stage-board-head">
        <h2>Live top 10</h2>
        {updatedAt && <span className="stage-muted">Updated {istTime(updatedAt)}</span>}
      </header>
      {rows === null ? (
        <p className="stage-muted">No leaderboard yet — tap “Refresh leaderboard”.</p>
      ) : (
        <ol className="stage-rows">
          {top.map((r, i) => {
            const fav = Math.min(r.favMax ?? 0, 2);
            return (
              <li key={r.uid} className="stage-row" data-uid={r.uid} data-qualified={fav >= 2}>
                <span className="stage-rank">{i + 1}</span>
                <span className="stage-name">{r.name}</span>
                {fav > 0 && (
                  <span className="stage-fav" data-fav-max={fav} title={fav >= 2 ? "Both favourites at MAX — qualified" : "One favourite at MAX"}>
                    <span aria-hidden="true">{"★".repeat(fav)}</span> Fav MAX
                  </span>
                )}
                {fav >= 2 && <span className="stage-qualified">Qualified</span>}
                <span className="stage-points">{fmt(r.points)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Sudden-death tiebreaker: a Hard question, 4 options; the answer only after "Reveal answer". */
function SuddenDeath() {
  const [q, setQ] = useState<StageQuestion | null>(null);
  const [reveal, setReveal] = useState<StageReveal | null>(null);
  const [seen, setSeen] = useState<string[]>([]); // never repeated during this session
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const next = () =>
    run(async () => {
      const out = await api.adminStageQuestion({ action: "next", seen });
      if (!("question" in out)) return;
      setQ(out.question);
      setReveal(null);
      setSeen((s) => [...s, out.question.id]);
    });
  const show = () =>
    run(async () => {
      if (!q) return;
      const out = await api.adminStageQuestion({ action: "reveal", id: q.id });
      if ("reveal" in out) setReveal(out.reveal);
    });

  return (
    <section className="stage-sd" data-sudden-death={q ? (reveal ? "revealed" : "asking") : "idle"}>
      {q && (
        <>
          <p className="stage-eyebrow">Sudden-death question</p>
          <h2 className="stage-question">{q.type === "meaning" ? <>What is the closest meaning of “{q.word}”?</> : q.prompt}</h2>
          <ol className="stage-options">
            {q.options.map((o, i) => (
              <li key={o} className="stage-option" data-correct={reveal ? o === reveal.answer : undefined}>
                <span className="stage-option-key">{"ABCD"[i]}</span>
                {o}
              </li>
            ))}
          </ol>
          {reveal?.explanation && <p className="stage-explanation">{reveal.explanation}</p>}
        </>
      )}
      <div className="stage-sd-actions">
        {!q && (
          <button className="btn" onClick={next} disabled={busy}>
            Sudden-death question
          </button>
        )}
        {q && !reveal && (
          <button className="btn gold" onClick={show} disabled={busy}>
            Reveal answer
          </button>
        )}
        {q && (
          <button className="btn secondary" onClick={next} disabled={busy}>
            Next question
          </button>
        )}
        {q && <span className="stage-muted">{q.left} hard questions left</span>}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** /stage: the projector screen (admin only, 16:9, light theme, no nav). SPEC §10. */
export default function Stage() {
  const { state: me, reload: reloadMe } = useMyState(0);
  useRoundRefresh(me, reloadMe);
  const now = useServerNow(me ? serverOffsetMs() : 0);
  const [board, setBoard] = useState<{ rows: StudentRow[] | null; updatedAt: number | null }>({ rows: null, updatedAt: null });
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // The projector is always the light theme, whatever this laptop prefers.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "light");
    return () => (before === null ? html.removeAttribute("data-theme") : html.setAttribute("data-theme", before));
  }, []);

  // Cost rule: one doc, read every ~30 s only while this screen is open. The same poll picks up a
  // lock made elsewhere (getMyState).
  const loadBoard = useCallback(async () => {
    const d = (await getDoc(doc(db, COL.leaderboard, DOC.studentsBoard))).data();
    setBoard(d ? { rows: (d.top ?? []) as StudentRow[], updatedAt: d.updatedAt?.toMillis?.() ?? null } : { rows: null, updatedAt: null });
  }, []);
  useEffect(() => {
    const poll = () => void loadBoard().catch(() => {});
    poll();
    const t = setInterval(() => {
      poll();
      reloadMe();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loadBoard, reloadMe]);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ kind: "ok", text: await fn() });
    } catch (err) {
      setMsg({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const refresh = () =>
    act(async () => {
      const { rows } = await api.refreshLeaderboard({});
      await loadBoard();
      return `Leaderboard refreshed (${fmt(rows)} players).`;
    });
  const locked = !!me?.locked;
  const lock = () => {
    const next = !locked;
    if (!window.confirm(next ? "Lock the game now? Nobody can play until you reopen it." : "Reopen the game?")) return;
    void act(async () => {
      await api.lockGame({ locked: next });
      reloadMe();
      return next ? "Game locked." : "Game reopened.";
    });
  };
  const afterLock = locked || (me?.lockAt != null && now >= me.lockAt);

  return (
    <main className="stage" data-after-lock={afterLock}>
      <header className="stage-head">
        <CoBrand className="stage-lockup" />
      </header>
      <div className="stage-main">
        <div className="stage-left">
          <RoundStatus me={me} now={now} />
          <SuddenDeath />
        </div>
        <TopTen rows={board.rows} afterLock={afterLock} updatedAt={board.updatedAt} />
      </div>
      <footer className="stage-foot">
        <button className="btn secondary" onClick={refresh} disabled={busy}>
          Refresh leaderboard
        </button>
        <button className={locked ? "btn" : "btn danger"} onClick={lock} disabled={busy} data-locked={locked}>
          {locked ? "Reopen game" : "Lock game"}
        </button>
        {msg && (
          <span className={msg.kind === "ok" ? "done" : "error"} role={msg.kind === "error" ? "alert" : "status"}>
            {msg.text}
          </span>
        )}
      </footer>
    </main>
  );
}
