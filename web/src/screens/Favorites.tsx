import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GetMyStateOutput } from "@shared/types";
import LevelBadge from "../components/LevelBadge";
import LingoArt from "../components/LingoArt";
import { BRAND, lingoName } from "../config/brand";
import { api, apiErrorMessage } from "../lib/api";
import { loadLingos, type Lingo } from "../lib/lingos";

const PICK = 2;

/** Pick 2 favourites from caught Lingos (SPEC §7, PLAN 4.5). */
export default function Favorites() {
  const navigate = useNavigate();
  const [me, setMe] = useState<GetMyStateOutput | null>(null);
  const [lingos, setLingos] = useState<Lingo[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The player's own taps win: a state answer that lands after the first tap never resets the pick
  // (QA: a late second answer undid a tap, so Save never appeared).
  const touched = useRef(false);

  useEffect(() => {
    api.getMyState({}).then(
      (s) => {
        setMe(s);
        if (!touched.current) setPicked(s.user?.favorites ?? []);
      },
      (err) => setError(apiErrorMessage(err)),
    );
    loadLingos().then(setLingos, () => {});
  }, []);

  const caught = useMemo(() => {
    const byId = new Map(lingos.map((l) => [l.id, l]));
    return (me?.catches ?? [])
      .filter((c) => c.timesCaught > 0 && byId.has(c.lingoId))
      .map((c) => ({ ...c, lingo: byId.get(c.lingoId)! }))
      .sort((a, b) => a.lingo.posterIndex - b.lingo.posterIndex);
  }, [me, lingos]);

  const current = me?.user?.favorites ?? [];
  const changesLeft = me?.user?.favoriteChangesLeft ?? 0;
  const isChange = current.length > 0;
  const locked = isChange && changesLeft <= 0;
  const same = picked.length === current.length && picked.every((id) => current.includes(id));
  const canSave = picked.length === PICK && !same && !locked && !busy;

  function toggle(id: string) {
    if (locked) return;
    touched.current = true;
    setError("");
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PICK ? [...p, id] : [p[1], id]));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.setFavorites({ lingoIds: picked });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen stack">
      <h1>{isChange ? "Your favourites" : "Pick 2 favourites"}</h1>
      <p className="muted">
        Only favourite {BRAND.creatureName}s build a streak — catch one 10 days in a row to unlock its MAX form.
      </p>
      {isChange && (
        <p className="card small" data-warning>
          {locked
            ? "You've used your one change — these stay your favourites."
            : `Changing resets the streak of the ${BRAND.creatureName} you replace and the new one to 0. Changes left: ${changesLeft}.`}
        </p>
      )}

      {me && caught.length < PICK && (
        <p className="card small">Catch at least 2 different {BRAND.creatureName}s first, then come back.</p>
      )}

      <div className="fav-grid" role="group" aria-label="Caught Lingos">
        {caught.map((c) => (
          <button
            key={c.lingoId}
            className="fav-option"
            data-picked={picked.includes(c.lingoId)}
            disabled={locked}
            onClick={() => toggle(c.lingoId)}
            aria-pressed={picked.includes(c.lingoId)}
          >
            <span className="fav-option-art" aria-hidden="true">
              <LingoArt lingo={c.lingo} mood={picked.includes(c.lingoId) ? "happy" : "calm"} />
            </span>
            <strong>{lingoName(c.lingo)}</strong>
            <span className="small muted">{c.lingo.detYear}</span>
            <LevelBadge level={c.level} />
            {current.includes(c.lingoId) && c.favStreak > 0 && <span className="small streak-text">🔥 Day {c.favStreak}</span>}
            {picked.includes(c.lingoId) && <span className="fav-check" aria-hidden="true">★</span>}
          </button>
        ))}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!locked && (
        <button className="btn" onClick={save} disabled={!canSave}>
          {busy ? "Saving…" : picked.length < PICK ? `Pick ${PICK - picked.length} more` : isChange ? "Save change" : "Save favourites"}
        </button>
      )}
      <Link className="btn link" to="/home">
        {isChange ? "Back" : "Later"}
      </Link>
    </main>
  );
}
