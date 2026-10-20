import { db, doc, getDoc } from "../lib/firestore";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  COL,
  DEFAULT_RULES,
  DOC,
  MAX_CAMPUSES,
  QUESTION_LEVELS,
  QUESTION_TYPES,
  type AdminPlayerRow,
  type AdminPrizeRow,
  type AdminStatsOutput,
  type AdminUploadError,
  type ChallengeInput,
  type ChallengeType,
  type GameConfigDoc,
  type GameRules,
  type QuestionCounts,
} from "@shared/types";
import { BRAND, lingoName } from "../config/brand";
import { api, apiErrorMessage } from "../lib/api";
import { loadLingos, type Lingo } from "../lib/lingos";

// All admin times are typed and shown in IST (CLAUDE.md: Asia/Kolkata), whatever the laptop's zone.
const IST_MS = 5.5 * 3600 * 1000;
const toIstInput = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 16);
const fromIstInput = (v: string) => Date.parse(`${v}:00+05:30`);
const fmtIst = (ms: number) => `${toIstInput(ms).replace("T", " ")} IST`;

type Status = { kind: "ok" | "error"; text: string } | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card stack admin-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p className={status.kind === "ok" ? "done" : "error"} role={status.kind === "error" ? "alert" : "status"}>
      {status.text}
    </p>
  );
}

/** Wraps an admin action: busy flag + a success/error line. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const run = useCallback(async (fn: () => Promise<string>) => {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ kind: "ok", text: await fn() });
    } catch (err) {
      setStatus({ kind: "error", text: apiErrorMessage(err) });
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, status, run };
}

function Stats() {
  const [stats, setStats] = useState<AdminStatsOutput | null>(null);
  const { busy, status, run } = useAction();
  const load = useCallback(() => run(async () => (setStats(await api.adminStats({})), "Updated.")).catch(() => {}), [run]);
  useEffect(() => void load(), [load]);
  // One-day event (config.rounds set): the server counts the current round, keyed "2026-10-22#R2".
  const period = stats && /#R\d+$/.test(stats.today) ? "this round" : "today";
  return (
    <Section title="Stats">
      {stats && (
        <>
          <div className="stat-grid" data-period={period}>
            <div data-stat="users">
              <strong>{stats.users.toLocaleString("en-IN")}</strong>
              <span className="small muted">players</span>
            </div>
            <div data-stat="attempts">
              <strong>{stats.attemptsToday.toLocaleString("en-IN")}</strong>
              <span className="small muted">attempts {period}</span>
            </div>
            <div data-stat="wins">
              <strong>{stats.winsToday.toLocaleString("en-IN")}</strong>
              <span className="small muted">wins {period}</span>
            </div>
          </div>
          <QuestionCountsTable counts={stats.questions} total={stats.questionTotal} />
        </>
      )}
      <button className="btn secondary" onClick={load} disabled={busy}>
        {busy ? "Loading…" : "Refresh stats"}
      </button>
      {status?.kind === "error" && <StatusLine status={status} />}
    </Section>
  );
}

function GameLock({ config, reload }: { config: GameConfigDoc; reload: () => void }) {
  const { busy, status, run } = useAction();
  const toggle = () => {
    const locked = !config.locked;
    if (!window.confirm(locked ? "Lock the game now? Nobody can play until you unlock it." : "Unlock the game?")) return;
    run(async () => {
      await api.lockGame({ locked });
      reload();
      return locked ? "Game locked." : "Game unlocked.";
    }).catch(() => {});
  };
  return (
    <Section title="Lock game">
      <p style={{ margin: 0 }} data-locked={config.locked}>
        {config.locked ? "🔒 Locked — every player action is refused." : `🟢 Open (play locks automatically at ${fmtIst(config.lockAt.toMillis())}).`}
      </p>
      <button className={config.locked ? "btn" : "btn danger"} onClick={toggle} disabled={busy}>
        {config.locked ? "Unlock game" : "Lock game now"}
      </button>
      <StatusLine status={status} />
    </Section>
  );
}

type CampusRow = { name: string; lat: string; lng: string; radiusM: string };

function ConfigForm({ config, reload }: { config: GameConfigDoc; reload: () => void }) {
  const [startAt, setStartAt] = useState(toIstInput(config.startAt.toMillis()));
  const [lockAt, setLockAt] = useState(toIstInput(config.lockAt.toMillis()));
  const [campuses, setCampuses] = useState<CampusRow[]>(
    (config.campuses ?? []).map((c) => ({ name: c.name, lat: String(c.lat), lng: String(c.lng), radiusM: String(c.radiusM) })),
  );
  const rulesNow = { ...DEFAULT_RULES, ...config.rules };
  const [rules, setRules] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(rulesNow).map(([k, v]) => [k, String(v)])),
  );
  const { busy, status, run } = useAction();

  function save(e: FormEvent) {
    e.preventDefault();
    const changedRules: Partial<GameRules> = {};
    for (const [k, v] of Object.entries(rules)) {
      if (Number(v) !== rulesNow[k as keyof GameRules]) changedRules[k as keyof GameRules] = Number(v);
    }
    run(async () => {
      await api.adminSetConfig({
        startAt: fromIstInput(startAt),
        lockAt: fromIstInput(lockAt),
        campuses: campuses.map((c) => ({ name: c.name.trim(), lat: Number(c.lat), lng: Number(c.lng), radiusM: Number(c.radiusM) })),
        ...(Object.keys(changedRules).length ? { rules: changedRules } : {}),
      });
      reload();
      return "Config saved.";
    }).catch(() => {});
  }

  return (
    <Section title="Config">
      <form className="stack" onSubmit={save}>
        <label className="field">
          Game starts (IST)
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required name="startAt" />
        </label>
        <label className="field">
          Play locks (IST)
          <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} required name="lockAt" />
        </label>
        <fieldset className="stack campus-list">
          <legend>Campuses (on campus = inside any of them)</legend>
          {campuses.map((c, i) => {
            const set = (k: keyof CampusRow) => (e: ChangeEvent<HTMLInputElement>) =>
              setCampuses((list) => list.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
            return (
              <div className="stack campus-row" key={i} data-campus={i}>
                <div className="row admin-pair">
                  <label className="field">
                    Name
                    <input value={c.name} onChange={set("name")} required name={`campus-${i}-name`} />
                  </label>
                  <label className="field">
                    Radius (m)
                    <input inputMode="numeric" value={c.radiusM} onChange={set("radiusM")} required name={`campus-${i}-radiusM`} />
                  </label>
                </div>
                <div className="row admin-pair">
                  <label className="field">
                    Lat
                    <input inputMode="decimal" value={c.lat} onChange={set("lat")} required name={`campus-${i}-lat`} />
                  </label>
                  <label className="field">
                    Lng
                    <input inputMode="decimal" value={c.lng} onChange={set("lng")} required name={`campus-${i}-lng`} />
                  </label>
                </div>
                {campuses.length > 1 && (
                  <button type="button" className="btn secondary" onClick={() => setCampuses((list) => list.filter((_, j) => j !== i))}>
                    Remove {c.name || `campus ${i + 1}`}
                  </button>
                )}
              </div>
            );
          })}
          {campuses.length < MAX_CAMPUSES && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setCampuses((list) => [...list, { name: "", lat: "", lng: "", radiusM: "500" }])}
            >
              Add campus
            </button>
          )}
        </fieldset>
        <details>
          <summary>Game rules (SPEC §2)</summary>
          <div className="rules-grid">
            {Object.keys(rulesNow).map((k) => (
              <label className="field" key={k}>
                <span className="small">{k}</span>
                <input inputMode="decimal" value={rules[k]} name={`rule-${k}`} onChange={(e) => setRules((r) => ({ ...r, [k]: e.target.value }))} />
              </label>
            ))}
          </div>
        </details>
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save config"}
        </button>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}

// Placeholder rows only — never real pool questions: this chunk is a public file, and a real row
// here would hand out its answer (QA: the old example shipped two pool answers).
const EXAMPLE = `[
  { "id": "example-meaning", "level": "medium", "type": "meaning", "word": "WORD",
    "options": ["option A", "option B", "option C", "option D"], "correctIndex": 2,
    "explanation": "why option C is right" },
  { "id": "example-blank", "level": "medium", "type": "question", "target": "WORD",
    "prompt": "A sentence with a _____ to fill.",
    "options": ["option A", "option B", "option C", "option D"], "correctIndex": 0,
    "explanation": "why option A is right" },
  { "id": "example-read-aloud", "level": "medium", "type": "pronounce", "word": "WORD",
    "explanation": "what the word means" }
]`;

/** Questions per level × type (SPEC §9). */
function QuestionCountsTable({ counts, total }: { counts: QuestionCounts; total: number }) {
  return (
    <div className="table-scroll">
      <table className="admin-table" data-question-total={total}>
        <thead>
          <tr>
            <th>Pool: {total}</th>
            {QUESTION_TYPES.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {QUESTION_LEVELS.map((l) => (
            <tr key={l}>
              <th>{l}</th>
              {QUESTION_TYPES.map((t) => (
                <td key={t} data-count={`${l}/${t}`}>
                  {counts[`${l}/${t}`]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionUpload({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [rowErrors, setRowErrors] = useState<AdminUploadError[]>([]);
  const [counts, setCounts] = useState<{ counts: QuestionCounts; total: number } | null>(null);
  const { busy, status, run } = useAction();

  async function pickFile(file: File | undefined) {
    if (file) setText(await file.text());
  }
  function upload() {
    setRowErrors([]);
    setCounts(null);
    let questions: unknown;
    try {
      questions = JSON.parse(text);
    } catch {
      run(async () => {
        throw new Error("That isn't valid JSON.");
      }).catch(() => {});
      return;
    }
    run(async () => {
      const out = await api.adminUpsertQuestions({ questions: questions as never });
      setCounts({ counts: out.counts, total: out.written });
      onDone();
      return `Saved ${out.written} question${out.written === 1 ? "" : "s"}${out.removed ? ` (removed ${out.removed} old)` : ""}.`;
    }).catch((err) => setRowErrors((err as { details?: { errors?: AdminUploadError[] } }).details?.errors ?? []));
  }

  return (
    <Section title="Upload the question pool (JSON)">
      <p className="small muted" style={{ margin: 0 }}>
        The whole pool (scripts/content/question-pool-2026.json): every row needs a unique id, level medium/hard, type
        meaning/question/pronounce and an explanation; meaning/question need 4 different options and correctIndex 0–3. Nothing
        is saved if any row is wrong. It replaces the current pool; players get it within 10 minutes.
      </p>
      <input type="file" accept=".json,application/json" onChange={(e) => void pickFile(e.target.files?.[0])} aria-label="Question pool JSON file" />
      <label className="field">
        Or paste JSON
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} name="questionsJson" />
      </label>
      <button className="btn" onClick={upload} disabled={busy || !text.trim()}>
        {busy ? "Checking…" : "Validate & upload"}
      </button>
      <StatusLine status={status} />
      {counts && <QuestionCountsTable counts={counts.counts} total={counts.total} />}
      {rowErrors.length > 0 && (
        <ul className="row-errors small" data-row-errors={rowErrors.length}>
          {rowErrors.map((e) => (
            <li key={`${e.row}-${e.message}`}>
              {e.row ? `Row ${e.row}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ChallengeFields({ value, onChange }: { value: ChallengeInput; onChange: (c: ChallengeInput) => void }) {
  const opts = "options" in value ? value.options : ["", "", "", ""];
  const correct = "correctIndex" in value ? value.correctIndex : 0;
  const setType = (type: ChallengeType) => {
    if (type === "pronounce") onChange({ type, word: "" });
    else if (type === "speak") onChange({ type, phrase: "" });
    else if (type === "meaning") onChange({ type, word: "", options: opts, correctIndex: correct });
    else onChange({ type, prompt: "", options: opts, correctIndex: correct });
  };
  return (
    <fieldset className="stack raid-challenge">
      <legend>Raid challenge (its own — never today's normal one)</legend>
      <label className="field">
        Type
        <select value={value.type} onChange={(e) => setType(e.target.value as ChallengeType)} name="challengeType">
          <option value="pronounce">pronounce — say a word</option>
          <option value="speak">speak — say a sentence</option>
          <option value="meaning">meaning — pick a word's meaning</option>
          <option value="question">question — pick the right answer</option>
        </select>
      </label>
      {(value.type === "pronounce" || value.type === "meaning") && (
        <label className="field">
          Word
          <input value={value.word} onChange={(e) => onChange({ ...value, word: e.target.value })} required name="challengeWord" />
        </label>
      )}
      {value.type === "pronounce" && (
        <label className="field">
          Other accepted spellings (comma-separated, optional)
          <input
            value={(value.accept ?? []).join(", ")}
            onChange={(e) => {
              const accept = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              onChange({ type: "pronounce", word: value.word, ...(accept.length ? { accept } : {}) });
            }}
            name="challengeAccept"
          />
        </label>
      )}
      {value.type === "speak" && (
        <label className="field">
          Sentence
          <input value={value.phrase} onChange={(e) => onChange({ ...value, phrase: e.target.value })} required name="challengePhrase" />
        </label>
      )}
      {value.type === "question" && (
        <label className="field">
          Question
          <input value={value.prompt} onChange={(e) => onChange({ ...value, prompt: e.target.value })} required name="challengePrompt" />
        </label>
      )}
      {(value.type === "meaning" || value.type === "question") &&
        opts.map((o, i) => (
          <div className="row option-row" key={i}>
            <input
              type="radio"
              name="challengeCorrect"
              checked={correct === i}
              onChange={() => onChange({ ...value, correctIndex: i })}
              aria-label={`Option ${i + 1} is correct`}
            />
            <label className="field" style={{ flex: 1 }}>
              <span className="small">Option {i + 1}{correct === i ? " ✓ correct" : ""}</span>
              <input
                value={o}
                required
                name={`challengeOption${i}`}
                onChange={(e) => onChange({ ...value, options: opts.map((x, j) => (j === i ? e.target.value : x)) })}
              />
            </label>
          </div>
        ))}
    </fieldset>
  );
}

function CreateRaid({ lingos }: { lingos: Lingo[] }) {
  const [posterIndex, setPosterIndex] = useState(0);
  const [startNow, setStartNow] = useState(true);
  const [startAt, setStartAt] = useState(toIstInput(Date.now() + 10 * 60_000));
  const [minutes, setMinutes] = useState("15");
  const [minPlayers, setMinPlayers] = useState("20");
  const [challenge, setChallenge] = useState<ChallengeInput>({ type: "meaning", word: "", options: ["", "", "", ""], correctIndex: 0 });
  const { busy, status, run } = useAction();
  const lingo = lingos.find((l) => l.posterIndex === posterIndex);

  function create(e: FormEvent) {
    e.preventDefault();
    if (!lingo) return;
    run(async () => {
      const { raidId } = await api.adminCreateRaid({
        posterIndex,
        lingoId: lingo.id,
        startAt: startNow ? Date.now() : fromIstInput(startAt),
        minutes: Number(minutes),
        minPlayers: Number(minPlayers),
        challenge,
      });
      return `${BRAND.raidName} created (${raidId}) at poster ${posterIndex + 1}.`;
    }).catch(() => {});
  }

  return (
    <Section title={`Create ${BRAND.raidName}`}>
      <form className="stack" onSubmit={create}>
        <label className="field">
          Poster
          <select value={posterIndex} onChange={(e) => setPosterIndex(Number(e.target.value))} name="posterIndex">
            {lingos.map((l) => (
              <option key={l.id} value={l.posterIndex}>
                Poster {l.posterIndex + 1} · {lingoName(l)} ({l.detYear})
              </option>
            ))}
          </select>
        </label>
        <label className="row small">
          <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} name="startNow" /> Start now
        </label>
        {!startNow && (
          <label className="field">
            Starts (IST)
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required name="raidStartAt" />
          </label>
        )}
        <div className="row admin-pair">
          <label className="field">
            Minutes
            <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} required name="minutes" />
          </label>
          <label className="field">
            Players to unlock
            <input inputMode="numeric" value={minPlayers} onChange={(e) => setMinPlayers(e.target.value)} required name="minPlayers" />
          </label>
        </div>
        <ChallengeFields value={challenge} onChange={setChallenge} />
        <button className="btn" disabled={busy || !lingo}>
          {busy ? "Creating…" : `Create ${BRAND.raidName}`}
        </button>
      </form>
      <StatusLine status={status} />
    </Section>
  );
}

function LeaderboardRefresh() {
  const { busy, status, run } = useAction();
  return (
    <Section title="Leaderboard">
      <p className="small muted" style={{ margin: 0 }}>
        Refreshes by itself every 10 minutes.
      </p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => run(async () => `Leaderboard refreshed (${(await api.refreshLeaderboard({})).rows} rows).`).catch(() => {})}
      >
        {busy ? "Refreshing…" : "Refresh now"}
      </button>
      <StatusLine status={status} />
    </Section>
  );
}

type PrizeForm = { name: string; cost: string; stock: string };
const prizeForm = (p?: AdminPrizeRow): PrizeForm => ({ name: p?.name ?? "", cost: p ? String(p.cost) : "", stock: p ? String(p.stock) : "" });
/** An empty or non-numeric box is sent as null (the server refuses it) — never as 0. */
const num = (v: string): number | null => {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

/** One prize: edit name / cost / stock in place (or a new one), stock + redeemed shown. */
function PrizeRowForm({ prize, onSaved }: { prize?: AdminPrizeRow; onSaved: (rows: AdminPrizeRow[]) => void }) {
  const [form, setForm] = useState<PrizeForm>(() => prizeForm(prize));
  const { busy, status, run } = useAction();
  const set = (k: keyof PrizeForm) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { prizes } = await api.adminPrizes({ action: "save", ...(prize ? { id: prize.id } : {}), name: form.name, cost: num(form.cost), stock: num(form.stock) });
      onSaved(prizes);
      if (!prize) setForm(prizeForm());
      return prize ? "Saved." : "Prize added.";
    }).catch(() => {});
  };
  const remove = () => {
    if (!prize || !window.confirm(`Remove "${prize.name}"? Its ${prize.redeemed} redemption(s) stay in the history.`)) return;
    run(async () => {
      onSaved((await api.adminPrizes({ action: "remove", id: prize.id })).prizes);
      return "Removed.";
    }).catch(() => {});
  };
  const tag = prize?.id ?? "new";
  return (
    <form className="prize-row" onSubmit={save} data-prize-row={tag}>
      <label className="field">
        <span>Name</span>
        <input name={`prize-${tag}-name`} value={form.name} onChange={set("name")} maxLength={80} />
      </label>
      <label className="field">
        <span>Cost (points)</span>
        <input name={`prize-${tag}-cost`} value={form.cost} onChange={set("cost")} inputMode="numeric" />
      </label>
      <label className="field">
        <span>Stock</span>
        <input name={`prize-${tag}-stock`} value={form.stock} onChange={set("stock")} inputMode="numeric" />
      </label>
      {prize && (
        <p className="small muted prize-counts" data-stock={prize.stock} data-redeemed={prize.redeemed}>
          {prize.stock.toLocaleString("en-IN")} in stock · {prize.redeemed.toLocaleString("en-IN")} redeemed
        </p>
      )}
      <div className="row">
        <button className="btn small" type="submit" disabled={busy}>
          {prize ? "Save" : "Add prize"}
        </button>
        {prize && (
          <button className="btn small danger" type="button" onClick={remove} disabled={busy}>
            Remove
          </button>
        )}
      </div>
      <StatusLine status={status} />
    </form>
  );
}

/** Prizes for the desk (/redeem): add, edit, remove — validated by the adminPrizes function. */
function Prizes() {
  const [rows, setRows] = useState<AdminPrizeRow[] | null>(null);
  const { status, run } = useAction();
  useEffect(() => {
    run(async () => (setRows((await api.adminPrizes({ action: "list" })).prizes), "")).catch(() => {});
  }, [run]);
  return (
    <Section title="Prizes">
      {rows?.length === 0 && <p className="small muted">No prizes yet.</p>}
      {rows?.map((p) => <PrizeRowForm key={`${p.id}:${p.name}:${p.cost}:${p.stock}`} prize={p} onSaved={setRows} />)}
      <h3 style={{ margin: 0 }}>Add a prize</h3>
      <PrizeRowForm onSaved={setRows} />
      {status?.kind === "error" && <StatusLine status={status} />}
    </Section>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const secs = (ms: number) => (ms ? `${(ms / 1000).toFixed(1)} s` : "—");

/** Disable / re-enable a player (anti-cheat F): every function refuses, off the leaderboard. */
function DisableButton({ row }: { row: AdminPlayerRow }) {
  const [disabled, setDisabled] = useState(row.disabled);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!disabled && !confirm(`Disable ${row.name} (${row.email})? They can't play and leave the leaderboard at the next refresh.`)) return;
    setBusy(true);
    try {
      setDisabled((await api.adminSetDisabled({ uid: row.uid, disabled: !disabled })).disabled);
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className={`btn small ${disabled ? "secondary" : "danger"}`} disabled={busy} onClick={toggle} data-disable={row.uid} data-disabled={disabled}>
      {busy ? "…" : disabled ? "Enable" : "Disable"}
    </button>
  );
}

function PlayersTable({ rows, showRank, showReason }: { rows: AdminPlayerRow[]; showRank?: boolean; showReason?: boolean }) {
  if (!rows.length) return <p className="small muted" style={{ margin: 0 }}>Nobody.</p>;
  return (
    <div className="table-scroll">
      <table className="admin-table" data-rows={rows.length}>
        <thead>
          <tr>
            {showRank && <th>#</th>}
            {showReason && <th>Group</th>}
            <th>Name</th>
            <th>Email</th>
            <th>Points</th>
            <th title="Favourites at MAX (2 = qualified to win)">Fav MAX</th>
            <th>Accuracy</th>
            <th>Avg time</th>
            <th>Flags</th>
            {showReason && <th>Why</th>}
            <th>Player</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid} data-uid={r.uid} className={r.flags > 0 || r.suspect || r.voiceSuspect || r.locationJumps > 0 ? "flagged" : undefined}>
              {showRank && <td>{r.rank}</td>}
              {showReason && <td>{r.group}</td>}
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.points.toLocaleString("en-IN")}</td>
              <td data-qualified={r.qualified ? "" : undefined}>
                {r.favMax ?? 0}/2{r.qualified ? " ✓" : ""}
              </td>
              <td>{pct(r.accuracy)}</td>
              <td>{secs(r.avgAnswerMs)}</td>
              <td>
                {r.flags}
                {r.suspect ? " ⚠" : ""}
                {r.voiceSuspect ? " 🎤" : ""}
                {r.locationJumps > 0 ? ` 📍${r.locationJumps}` : ""}
              </td>
              {showReason && <td className="small">{r.reason}</td>}
              <td>
                <DisableButton row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Suspicious() {
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const { busy, status, run } = useAction();
  return (
    <Section title="Suspicious players">
      <p className="small muted" style={{ margin: 0 }}>
        Flags = answers faster than a human could (voice &lt; 1.5 s, tap &lt; 0.8 s). ⚠ = ≥ 10 wins, ≥ 95 % accuracy and
        &lt; 3 s average. 🎤 = every Read Aloud perfect and under 2 s. 📍 = jumped between the campuses in under 5
        minutes. Signals only — nobody is blocked automatically; check, then Disable if needed.
      </p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => run(async () => ((r) => (setRows(r.rows), `${r.rows.length} player(s).`))(await api.adminSuspicious({}))).catch(() => {})}
      >
        {busy ? "Loading…" : rows ? "Reload" : "Load suspicious players"}
      </button>
      <StatusLine status={status} />
      {rows && <PlayersTable rows={rows} />}
    </Section>
  );
}

function Duplicates() {
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const { busy, status, run } = useAction();
  return (
    <Section title="Possible duplicate accounts">
      <p className="small muted" style={{ margin: 0 }}>
        Same or nearly the same name, similar email, made minutes apart. Two students can share a name — this only
        groups them for you to check; nobody is blocked automatically. Reads every player, so load it only when needed.
      </p>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() =>
          run(async () => ((r) => (setRows(r.rows), `${new Set(r.rows.map((x) => x.group)).size} group(s), ${r.rows.length} accounts.`))(await api.adminDuplicates({}))).catch(() => {})
        }
        data-load-duplicates
      >
        {busy ? "Loading…" : rows ? "Reload" : "Load possible duplicates"}
      </button>
      <StatusLine status={status} />
      {rows && <PlayersTable rows={rows} showReason />}
    </Section>
  );
}

/** CSV (Excel-friendly) of the top 20 for the final, flags column included. */
function toCsv(rows: AdminPlayerRow[]): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["rank", "name", "email", "points", "fav_max", "qualified", "accuracy_pct", "avg_answer_s", "wins", "flags", "suspect", "voice_flag", "location_jumps", "disabled"];
  const yes = (b: boolean) => (b ? "yes" : "no");
  const body = rows.map((r) =>
    [r.rank ?? "", r.name, r.email, r.points, r.favMax ?? 0, yes(!!r.qualified), Math.round(r.accuracy * 100), (r.avgAnswerMs / 1000).toFixed(2), r.wins, r.flags, yes(r.suspect), yes(r.voiceSuspect), r.locationJumps, yes(r.disabled)]
      .map(q)
      .join(","),
  );
  return [head.join(","), ...body].join(String.fromCharCode(13, 10));
}

function Top20() {
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const { busy, status, run } = useAction();
  function exportTop20() {
    run(async () => {
      const out = await api.adminTop20({});
      setRows(out.rows);
      // Leading BOM so Excel reads the names as UTF-8.
      const blob = new Blob([String.fromCharCode(0xfeff) + toCsv(out.rows)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `top20-${new Date(Date.now() + IST_MS).toISOString().slice(0, 16).replace(/[T:]/g, "-")}-IST.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      return `Top ${out.rows.length} downloaded (ranked just now).`;
    }).catch(() => {});
  }
  return (
    <Section title="Top 20 for the final">
      <p className="small muted" style={{ margin: 0 }}>
        Re-ranks now (points → accuracy → avg time → reached first) and downloads a CSV with emails and flags.
      </p>
      <button className="btn secondary" disabled={busy} onClick={exportTop20} data-export-top20>
        {busy ? "Ranking…" : "Export top 20 (CSV)"}
      </button>
      <StatusLine status={status} />
      {rows && <PlayersTable rows={rows} showRank />}
    </Section>
  );
}

/** /admin (PLAN 7.2, role admin): stats, lock, config, challenges upload, raids, leaderboard refresh. */
export default function Admin() {
  const [config, setConfig] = useState<GameConfigDoc | null>(null);
  const [lingos, setLingos] = useState<Lingo[]>([]);
  const [statsKey, setStatsKey] = useState(0);
  const [error, setError] = useState("");

  // One read on open and after each save (no listener: cost rules).
  const reload = useCallback(() => {
    getDoc(doc(db, COL.config, DOC.gameConfig)).then(
      (s) => setConfig((s.data() as GameConfigDoc | undefined) ?? null),
      (err) => setError(apiErrorMessage(err)),
    );
  }, []);
  useEffect(() => {
    reload();
    loadLingos().then(setLingos, () => {});
  }, [reload]);

  return (
    <main className="screen stack admin">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <Link className="btn link" to="/home">
          Home
        </Link>
      </header>
      {error && <p className="error">{error}</p>}
      <Stats key={statsKey} />
      {config && <GameLock config={config} reload={reload} />}
      {config && <ConfigForm config={config} reload={reload} />}
      <QuestionUpload onDone={() => setStatsKey((k) => k + 1)} />
      {lingos.length > 0 && <CreateRaid lingos={lingos} />}
      <LeaderboardRefresh />
      <Prizes />
      <Suspicious />
      <Duplicates />
      <Top20 />
    </main>
  );
}
