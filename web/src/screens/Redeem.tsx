import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { COL, type DeskPlayerOutput, type PrizeDoc } from "@shared/types";
import { api, apiErrorMessage } from "../lib/api";
import { collection, db, onSnapshot } from "../lib/firestore";
import { isPrizeCode, readQr } from "../lib/qrScan";

const fmt = (n: number) => n.toLocaleString("en-IN");
type Prize = PrizeDoc & { id: string };
/** A refused redeem / lookup, by the server's error code (redeemPrize, deskPlayer). */
const ERROR_TITLE: Record<string, string> = {
  "not-enough": "Not enough points",
  "out-of-stock": "Out of stock",
  disabled: "Player paused",
  "no-player": "Unknown code",
  "bad-code": "Unknown code",
  "no-prize": "Unknown prize",
};
interface DeskError {
  code: string;
  title: string;
  text: string;
}
const deskError = (err: unknown): DeskError => {
  const code = (err as { details?: { code?: string } }).details?.code ?? "";
  return { code, title: ERROR_TITLE[code] ?? "Couldn't do that", text: apiErrorMessage(err) };
};

function ErrorBox({ error }: { error: DeskError }) {
  return (
    <div className="desk-error" role="alert" data-error-code={error.code || undefined}>
      <strong>{error.title}</strong>
      <span>{error.text}</span>
    </div>
  );
}

/** The phone camera, read a few times a second until a QR code shows up. */
function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "on" | "off">("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    let reading = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        setState("on");
        timer = setInterval(async () => {
          if (reading || !video.current) return;
          reading = true;
          const code = await readQr(video.current);
          reading = false;
          if (code && isPrizeCode(code) && !stopped) {
            stopped = true;
            onCode(code.trim());
          }
        }, 250);
      } catch {
        if (!stopped) setState("off");
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="desk-camera" data-camera={state}>
      <video ref={video} muted playsInline aria-label="Camera: point it at the player's prize QR" />
      {state === "starting" && <p className="desk-camera-note">Starting the camera…</p>}
      {state === "off" && <p className="desk-camera-note">No camera — type the code from the player's Me page instead.</p>}
      {state === "on" && <span className="desk-camera-frame" aria-hidden="true" />}
    </div>
  );
}

/** /redeem: the prize desk (volunteer or admin, phone-sized). SPEC §7. */
export default function Redeem() {
  const [player, setPlayer] = useState<DeskPlayerOutput | null>(null);
  const [prizes, setPrizes] = useState<Prize[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeskError | null>(null);
  const [done, setDone] = useState<{ prize: string; newBalance: number } | null>(null);

  // Cost rule: the prize list only while the desk is open (a handful of docs, live stock).
  useEffect(
    () =>
      onSnapshot(
        collection(db, COL.prizes),
        (snap) =>
          setPrizes(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as PrizeDoc) })).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)),
          ),
        () => setPrizes([]),
      ),
    [],
  );

  const lookup = useCallback(async (uid: string) => {
    setBusy(true);
    setError(null);
    try {
      setPlayer(await api.deskPlayer({ uid }));
      setPick(null);
    } catch (err) {
      setError(deskError(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const typed = (e: FormEvent) => {
    e.preventDefault();
    if (!isPrizeCode(code)) {
      setError({ code: "bad-code", title: "Unknown code", text: "That isn't a prize code — it's the code under the player's QR." });
      return;
    }
    void lookup(code.trim());
  };

  const confirm = async () => {
    if (!player || !pick) return;
    const prize = prizes?.find((p) => p.id === pick);
    setBusy(true);
    setError(null);
    try {
      const { newBalance } = await api.redeemPrize({ uid: player.uid, prizeId: pick });
      setDone({ prize: prize?.name ?? "Prize", newBalance });
    } catch (err) {
      setError(deskError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPlayer(null);
    setPick(null);
    setDone(null);
    setError(null);
    setCode("");
  };

  if (done && player) {
    return (
      <main className="screen stack desk" data-desk="done">
        <h1>Prize desk</h1>
        <section className="card stack desk-done" role="status">
          <p className="desk-done-mark" aria-hidden="true">
            ✓
          </p>
          <h2>{done.prize} redeemed</h2>
          <p>
            for <strong>{player.name}</strong>
          </p>
          <p className="desk-balance" data-balance={done.newBalance}>
            New balance: <strong>{fmt(done.newBalance)}</strong> points
          </p>
        </section>
        <button className="btn" onClick={reset}>
          Next player
        </button>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="screen stack desk" data-desk="scan">
        <h1>Prize desk</h1>
        <p className="muted" style={{ margin: 0 }}>
          Scan the player's prize QR (Me page), or type the code under it.
        </p>
        {!busy && <QrScanner onCode={lookup} />}
        {busy && (
          <div className="center" aria-busy="true">
            <div className="spinner" />
          </div>
        )}
        <form className="stack" onSubmit={typed}>
          <label className="field">
            <span>Prize code</span>
            <input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          </label>
          <button className="btn secondary" type="submit" disabled={busy || !code.trim()}>
            Look up
          </button>
        </form>
        {error && <ErrorBox error={error} />}
        <Link className="btn link" to="/home">
          Back to the hunt
        </Link>
      </main>
    );
  }

  const chosen = prizes?.find((p) => p.id === pick);
  return (
    <main className="screen stack desk" data-desk="player">
      <h1>Prize desk</h1>
      <section className="card desk-player" data-uid={player.uid} data-disabled={player.disabled}>
        <h2 className="desk-name">{player.name}</h2>
        <dl className="desk-numbers">
          <div>
            <dt>Points</dt>
            <dd data-points={player.points}>{fmt(player.points)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{fmt(player.spent)}</dd>
          </div>
          <div>
            <dt>Balance</dt>
            <dd className="desk-balance" data-balance={player.balance}>
              {fmt(player.balance)}
            </dd>
          </div>
        </dl>
        {player.disabled && <p className="desk-paused">⚠ This player's account is paused — ask an organiser.</p>}
      </section>

      <section className="stack" aria-label="Prizes">
        <h2 style={{ margin: 0 }}>Pick a prize</h2>
        {prizes === null && <div className="spinner" />}
        {prizes?.length === 0 && <p className="muted">No prizes set up yet (admin → Prizes).</p>}
        <div className="desk-prizes" role="radiogroup" aria-label="Prizes">
          {prizes?.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pick === p.id}
              className="desk-prize"
              data-prize={p.id}
              data-out={p.stock <= 0 || undefined}
              data-short={p.cost > player.balance || undefined}
              onClick={() => {
                setPick(p.id);
                setError(null);
              }}
            >
              <span className="desk-prize-name">{p.name}</span>
              <span className="desk-prize-cost">{fmt(p.cost)} pts</span>
              <span className="desk-prize-stock">{p.stock <= 0 ? "Out of stock" : `${fmt(p.stock)} left`}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <ErrorBox error={error} />}
      <button className="btn" onClick={confirm} disabled={busy || !chosen}>
        {busy ? "Redeeming…" : chosen ? `Confirm: ${chosen.name} (${fmt(chosen.cost)})` : "Confirm"}
      </button>
      <button className="btn secondary" onClick={reset} disabled={busy}>
        Cancel — next player
      </button>
    </main>
  );
}
