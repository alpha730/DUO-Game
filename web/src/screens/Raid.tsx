import { collection, db, doc, onSnapshot } from "../lib/firestore";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COL, type RaidDoc, type RaidShardDoc } from "@shared/types";
import { requestLocation } from "../catch/preflight";
import { BRAND, lingoName } from "../config/brand";
import { api, apiErrorMessage } from "../lib/api";
import { loadLingos, type Lingo } from "../lib/lingos";
import { mmss, raidPhase, toRaid, useServerNow, type Raid as RaidT } from "../lib/raids";

type Step = "locating" | "joining" | "in" | "error";

/** Owl Raid waiting room (PLAN 6.3): join (on campus) → live joined count → unlocked. */
export default function Raid() {
  const { raidId = "" } = useParams();
  const [raid, setRaid] = useState<RaidT | null>(null);
  // Joined count = sum of the raid's 10 counter shards (Day 8 sharded counter).
  const [joined, setJoined] = useState(0);
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [step, setStep] = useState<Step>("locating");
  const [error, setError] = useState("");
  const [offsetMs, setOffsetMs] = useState(0);
  // This player already used their one try at this raid (from joinRaid).
  const [tried, setTried] = useState(false);
  const now = useServerNow(offsetMs);
  const joining = useRef(false);

  // Live count — only while this screen is open (cost rules); only joined players are here.
  useEffect(
    () =>
      onSnapshot(
        doc(db, COL.raids, raidId),
        (snap) => setRaid(snap.exists() ? toRaid(snap.id, snap.data() as RaidDoc) : null),
        () => {},
      ),
    [raidId],
  );
  useEffect(
    () =>
      onSnapshot(
        collection(db, COL.raids, raidId, COL.shards),
        (snap) => setJoined(snap.docs.reduce((sum, d) => sum + ((d.data() as RaidShardDoc).count ?? 0), 0)),
        () => {},
      ),
    [raidId],
  );

  useEffect(() => {
    if (raid) loadLingos().then((ls) => setLingo(ls.find((l) => l.id === raid.lingoId) ?? null), () => {});
  }, [raid?.lingoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function join() {
    if (joining.current) return;
    joining.current = true;
    setError("");
    setStep("locating");
    try {
      api.getMyState({}).then((s) => setOffsetMs(s.serverNow - Date.now()), () => {});
      const loc = await requestLocation();
      if (!loc.position) {
        setError(loc.state === "denied" ? "Allow location to join the raid (it checks you're on campus)." : "Couldn't get your location.");
        setStep("error");
        return;
      }
      setStep("joining");
      const out = await api.joinRaid({ raidId, lat: loc.position.lat, lng: loc.position.lng });
      setTried(out.tried);
      setStep("in");
    } catch (err) {
      setError(apiErrorMessage(err));
      setStep("error");
    } finally {
      joining.current = false;
    }
  }

  useEffect(() => {
    void join();
  }, [raidId]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase = raid ? raidPhase(raid, now) : null;
  const pct = raid ? Math.min(100, (joined / raid.minPlayers) * 100) : 0;

  return (
    <main className="screen stack raid-room" data-step={step} data-unlocked={raid?.unlocked ?? false}>
      <h1 style={{ margin: 0 }}>
        🦉 {BRAND.raidName}
        {raid && ` · poster ${raid.posterIndex + 1}`}
      </h1>
      {lingo && <p className="muted" style={{ margin: 0 }}>Catch {lingoName(lingo)} together — it only unlocks with enough players.</p>}

      {raid && (
        <section className="card stack" aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong data-joined={joined}>
              {joined}/{raid.minPlayers} joined
            </strong>
            {phase === "active" && <span className="small muted">Ends in {mmss(raid.endAt - now)}</span>}
            {phase === "ended" && <span className="small muted">Raid over</span>}
          </div>
          <div className="fav-bar" style={{ height: 10 }}>
            <div style={{ width: `${pct}%`, background: "var(--accent)" }} />
          </div>
          {raid.unlocked ? (
            <p className="done" data-raid-unlocked>
              🔓 Unlocked! {tried ? "You've had your one try at this raid." : "One try each — make it count."}
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              {Math.max(0, raid.minPlayers - joined)} more players needed — bring your friends to the poster!
            </p>
          )}
        </section>
      )}

      {step === "locating" && <p className="muted">Checking you're on campus…</p>}
      {step === "joining" && <p className="muted">Joining…</p>}
      {step === "in" && <p className="small" data-joined-me>✓ You're in.</p>}
      {step === "in" && raid?.unlocked && phase === "active" && !tried && (
        <Link className="btn" to={`/catch/${raid.lingoId}?raid=${raid.id}`} data-raid-start>
          Start the raid challenge
        </Link>
      )}
      {step === "error" && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button className="btn secondary" onClick={join}>
            Try again
          </button>
        </>
      )}
      <Link className="btn link" to="/scan">
        Back to scanning
      </Link>
    </main>
  );
}
