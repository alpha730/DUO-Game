import { db, doc, getDoc } from "../lib/firestore";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  COL,
  DEFAULT_RULES,
  DOC,
  type AdminStatsOutput,
  type AdminUploadError,
  type ChallengeInput,
  type ChallengeType,
  type GameConfigDoc,
  type GameRules,
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
  return (
    <Section title="Stats">
      {stats && (
        <>
          <div className="stat-grid">
            <div data-stat="users">
              <strong>{stats.users.toLocaleString("en-IN")}</strong>
              <span className="small muted">players</span>
            </div>
            <div data-stat="attempts">
              <strong>{stats.attemptsToday.toLocaleString("en-IN")}</strong>
              <span className="small muted">attempts today</span>
            </div>
            <div data-stat="wins">
              <strong>{stats.winsToday.toLocaleString("en-IN")}</strong>
              <span className="small muted">wins today</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }} data-missing={stats.missingCount}>
            {stats.missingCount === 0
              ? `✓ Every game day × ${BRAND.creatureName} has a challenge.`
              : `${stats.missingCount} game day × ${BRAND.creatureName} slots have no challenge, e.g. ${stats.missingChallenges.slice(0, 5).join(", ")}`}
          </p>
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

function ConfigForm({ config, reload }: { config: GameConfigDoc; reload: () => void }) {
  const [startAt, setStartAt] = useState(toIstInput(config.startAt.toMillis()));
  const [lockAt, setLockAt] = useState(toIstInput(config.lockAt.toMillis()));
  const [lat, setLat] = useState(String(config.campusLat));
  const [lng, setLng] = useState(String(config.campusLng));
  const [radius, setRadius] = useState(String(config.campusRadiusM));
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
        campusLat: Number(lat),
        campusLng: Number(lng),
        campusRadiusM: Number(radius),
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
        <div className="row admin-pair">
          <label className="field">
            Campus lat
            <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} required name="campusLat" />
          </label>
          <label className="field">
            Campus lng
            <input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} required name="campusLng" />
          </label>
        </div>
        <label className="field">
          Campus radius (m)
          <input inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} required name="campusRadiusM" />
        </label>
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

const EXAMPLE = `[
  { "date": "2026-10-10", "lingoId": "lingo-2016", "type": "pronounce", "word": "colour", "accept": ["color"] },
  { "date": "2026-10-10", "lingoId": "lingo-2017", "type": "speak", "phrase": "Practice makes progress." },
  { "date": "2026-10-10", "lingoId": "lingo-2018", "type": "meaning", "word": "keen",
    "options": ["eager", "tired", "angry", "late"], "correctIndex": 0 },
  { "date": "2026-10-10", "lingoId": "lingo-2019", "type": "question", "prompt": "She has lived here ___ 2020.",
    "options": ["since", "for", "from", "at"], "correctIndex": 0 }
]`;

function ChallengeUpload({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [rowErrors, setRowErrors] = useState<AdminUploadError[]>([]);
  const { busy, status, run } = useAction();

  async function pickFile(file: File | undefined) {
    if (file) setText(await file.text());
  }
  function upload() {
    setRowErrors([]);
    let challenges: unknown;
    try {
      challenges = JSON.parse(text);
    } catch {
      run(async () => {
        throw new Error("That isn't valid JSON.");
      }).catch(() => {});
      return;
    }
    run(async () => {
      const out = await api.adminUpsertChallenges({ challenges: challenges as never });
      onDone();
      return `Saved ${out.written} challenge${out.written === 1 ? "" : "s"}.`;
    }).catch((err) => setRowErrors((err as { details?: { errors?: AdminUploadError[] } }).details?.errors ?? []));
  }

  return (
    <Section title="Upload challenges (JSON)">
      <p className="small muted" style={{ margin: 0 }}>
        An array of challenges. Each needs a date inside the game, a lingoId and a type; meaning/question need 4 different
        options and correctIndex 0–3. Nothing is saved if any row is wrong; the same date × Lingo is replaced.
      </p>
      <input type="file" accept=".json,application/json" onChange={(e) => void pickFile(e.target.files?.[0])} aria-label="Challenges JSON file" />
      <label className="field">
        Or paste JSON
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} name="challengesJson" />
      </label>
      <button className="btn" onClick={upload} disabled={busy || !text.trim()}>
        {busy ? "Checking…" : "Validate & upload"}
      </button>
      <StatusLine status={status} />
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
      <ChallengeUpload onDone={() => setStatsKey((k) => k + 1)} />
      {lingos.length > 0 && <CreateRaid lingos={lingos} />}
      <LeaderboardRefresh />
    </main>
  );
}
