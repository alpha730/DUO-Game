import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_RULES, ONE_DAY_RULES, type GameConfigDoc, type GameRules } from "@shared/types";
import { DuoArt } from "../components/BrandArt";
import CoBrand from "../components/CoBrand";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";
import { istTime } from "../lib/period";
import { loadPublicEvent } from "../lib/publicEvent";

type Row = [rule: string, value: React.ReactNode];

function Table({ title, rows, id }: { title: string; rows: Row[]; id: string }) {
  return (
    <section className="card rules-section" aria-labelledby={`rules-${id}`} data-rules-section={id}>
      <h2 id={`rules-${id}`}>{title}</h2>
      <table className="rules-table">
        <tbody>
          {rows.map(([rule, value]) => (
            <tr key={rule}>
              <th scope="row">{rule}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Public rules table (SPEC §2) — open to everyone, signed in or not. The numbers come from the game's
 * rules: the defaults, replaced by the live config/game values once the player is signed in (config
 * is only readable when signed in), so the page always matches what the server enforces. Signed
 * out, the one-day event's round times come from public/event (readable by anyone), with the
 * one-day rules (ONE_DAY_RULES) that scripts/oneDayEvent.ts sets with them.
 */
export default function Rules() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<GameRules>(DEFAULT_RULES);
  // One-day event: the rounds from config/game (IST times); null = the multi-day game.
  const [rounds, setRounds] = useState<{ startAt: number; endAt: number }[] | null>(null);

  useEffect(() => {
    let live = true;
    if (!user) {
      void loadPublicEvent().then((ev) => {
        if (!live || !ev) return;
        setRounds(ev.rounds);
        setRules({ ...DEFAULT_RULES, ...ONE_DAY_RULES });
      });
      return () => {
        live = false;
      };
    }
    import("../lib/firestore")
      .then(({ db, doc, getDoc }) => getDoc(doc(db, "config", "game")))
      .then((s) => {
        const c = s.data() as GameConfigDoc | undefined;
        if (live && c?.rules) setRules({ ...DEFAULT_RULES, ...c.rules });
        if (live && c?.rounds?.length) {
          setRounds(
            c.rounds.map((x) => ({ startAt: x.startAt.toMillis(), endAt: x.endAt.toMillis() })).sort((a, b) => a.startAt - b.startAt),
          );
        }
      })
      .catch(() => {}); // offline: the defaults are the launch rules
    return () => {
      live = false;
    };
  }, [user]);

  const L = BRAND.creatureName;
  const r = rules;
  const back = () => (history.length > 1 ? navigate(-1) : navigate(user ? "/home" : "/"));

  return (
    <main className="screen stack rules" data-rules>
      <header className="topbar">
        <CoBrand variant="compact" />
      </header>
      <div>
        <p className="eyebrow">{BRAND.appName}</p>
        <h1 className="headline with-icon" style={{ margin: 0 }}>
          {BRAND.uiIcons.rules && <img className="headline-icon" src={BRAND.uiIcons.rules} alt="" aria-hidden="true" />}
          game rules
        </h1>
        {BRAND.duo.pointer && <DuoArt mood="pointer" className="rules-duo" />}
        <p className="muted" style={{ margin: "6px 0 0" }}>
          The same rules for every player. The game server checks all of them — points, timers and limits can't be
          changed from a phone.
        </p>
      </div>

      {rounds && (
        <Table
          id="rounds"
          title="One day, three rounds"
          rows={[
            ...rounds.map((x, i): Row => [`Round ${i + 1}`, <strong>{istTime(x.startAt)} – {istTime(x.endAt)}</strong>]),
            ["Between rounds", "Catching is closed — check the leaderboard and get ready"],
            ["Each round", <><strong>{r.attemptsPerDay} different {L}s</strong>, {r.triesPerLingoPerDay} tries each — they reset when the next round starts</>],
            ["After a catch", <>That {L} is done for the round — catch it again next round to grow its streak</>],
          ]}
        />
      )}

      {rounds && (
        <Table
          id="favourites"
          title="Favourites and levels"
          rows={[
            ["Favourites", <>Pick <strong>{r.favoritesCount} favourite {L}s</strong> after your first 2 catches{r.favoriteChanges ? <> (you can change them {r.favoriteChanges}×)</> : <> — no changes, so choose well</>}</>],
            ["Favourite streak", "Catch a favourite in every round. Miss a round and its streak breaks"],
            ["Levels", <>Lv 1 on the first catch · Lv 2 when caught in {r.favLevel2Streak} rounds in a row · <strong>MAX</strong> in all {r.favMaxStreak} rounds (+{r.maxBonus.toLocaleString("en-IN")})</>],
            ["Other " + L + "s", <>Lv 2 when caught again in a later round — only favourites reach MAX</>],
            ["Harder questions", `A favourite caught in the round before gets hard questions`],
          ]}
        />
      )}

      {rounds && (
        <Table
          id="winning"
          title="Winning and ties"
          rows={[
            ["To win", <>Take <strong>both favourites to MAX</strong> — only those players can win the top prizes</>],
            ["Ranking", "Points, then favourites at MAX, then accuracy, then average answer time, then who reached the score first"],
            ["A tie at the very top", "A sudden-death question on stage — the first correct answer wins"],
          ]}
        />
      )}

      {!rounds && (
      <Table
        id="daily"
        title="Every day"
        rows={[
          ["Posters per day", <><strong>{r.attemptsPerDay} different {L}s</strong> — the first try at a {L} uses 1 of the {r.attemptsPerDay}</>],
          ["Tries per poster", <><strong>{r.triesPerLingoPerDay} tries</strong> per {L} per day. A wrong answer, time-out or leaving the app uses a try</>],
          ["Second try", <>A new question, and it doesn't use another of your {r.attemptsPerDay} {L}s</>],
          ["After a catch", <>That {L} is done for the day — come back tomorrow to catch it again</>],
          ["New day", "Everything resets at 00:00 India time (IST)"],
          ["Where", <>Only on the {BRAND.campusName} campuses — your location is checked when you tap Start</>],
        ]}
      />
      )}

      <Table
        id="questions"
        title="Questions and timers"
        rows={[
          ["Choose the Meaning", <>Pick the right meaning · <strong>{r.meaningSeconds}&nbsp;s</strong></>],
          ["Fill in the Blanks / Choose the Answer", <>Pick the word or answer that fits · <strong>{r.questionSeconds}&nbsp;s</strong></>],
          ["Read Aloud", <>Say the word clearly · <strong>{r.pronounceSeconds}&nbsp;s</strong></>],
          [`${BRAND.raidName} speaking`, <>Say the sentence — at least {Math.round(r.speakPassRatio * 100)}% of its words · <strong>{r.speakSeconds}&nbsp;s</strong></>],
          ["Answering", "Tap an answer, then SUBMIT. When time runs out, your selected answer is sent"],
          ["Timer", "The server's clock decides — an answer that arrives too late doesn't count"],
        ]}
      />

      <Table
        id="points"
        title="Points"
        rows={[
          [`First catch of a ${L}`, <strong>+{r.firstCatchPoints}</strong>],
          [`Catch again (not a favourite)`, <strong>+{r.repeatCatchPoints}</strong>],
          ["Catch a favourite", rounds
            ? <><strong>+{r.favoriteCatchPointsPerDay} × streak</strong> (round 2 in a row = {r.favoriteCatchPointsPerDay * 2}, round 3 = {r.favoriteCatchPointsPerDay * 3})</>
            : <><strong>+{r.favoriteCatchPointsPerDay} × streak day</strong> (day 1 = {r.favoriteCatchPointsPerDay} … day {r.favMaxStreak} = {r.favoriteCatchPointsPerDay * r.favMaxStreak}, then {r.favoriteCatchPointsPerDay * r.favMaxStreak} a day)</>],
          ["Speed bonus", <><strong>+{r.speedBonusPerSecond}</strong> for every full second left on the timer (every correct answer)</>],
          [`All 10 ${L}s collected`, <strong>+{r.allTenBonus.toLocaleString("en-IN")} once</strong>],
          [`Favourite reaches MAX`, <strong>+{r.maxBonus.toLocaleString("en-IN")} once per {L}</strong>],
          [`${BRAND.raidName} catch`, <><strong>+{r.raidCatchPoints}</strong> + speed bonus</>],
          ["Wrong answer, time-out, leaving", <strong>0</strong>],
          ["Logging in or opening the app", <strong>0</strong>],
        ]}
      />

      {!rounds && (
      <Table
        id="favourites"
        title="Favourites, streaks and levels"
        rows={[
          ["Favourites", <>Pick <strong>{r.favoritesCount}</strong> after your first 2 catches. You can change them <strong>{r.favoriteChanges}×</strong> in the whole game (both streaks restart)</>],
          ["Favourite streak", "+1 for each day in a row you catch it. Miss a day and it restarts — levels never go down"],
          ["Favourite levels", <>Level 2 at a {r.favLevel2Streak}-day streak · Level 3 at {r.favLevel3Streak} days · <strong>MAX</strong> at {r.favMaxStreak} days</>],
          ["Other levels", <>Level 2 at {r.nonFavLevel2Catches} catches · Level 3 at {r.nonFavLevel3Catches} catches</>],
          ["Harder questions", `A favourite on streak day ${r.hardFromStreakDay} or later gets hard questions`],
        ]}
      />
      )}

      <Table
        id="raids"
        title={`${BRAND.raidName}s`}
        rows={[
          ["What", <>A surprise {L} at one poster for a short time — join at the poster</>],
          ["Unlock", "It opens when enough players have joined"],
          ["Tries", <><strong>1 try</strong> per raid — it doesn't use your {rounds ? "round's" : "daily"} {L}s or tries</>],
        ]}
      />

      <Table
        id="fair"
        title="Fair play"
        rows={[
          ["Stay in the app", "Leaving during a question (switching apps, locking the phone, a call) loses that try"],
          ["One question at a time", "Starting a new question closes any other open one as a miss"],
          ["Too-fast answers", "Flagged for the organisers to review before prizes and the final"],
        ]}
      />

      <button className="btn big" onClick={back} data-rules-back>
        Got it
      </button>
      {!user && (
        <Link className="btn link" to="/">
          Sign in to play
        </Link>
      )}
    </main>
  );
}
