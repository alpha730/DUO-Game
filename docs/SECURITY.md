# Decade Hunt — Security & anti-cheat

How the game stops cheating, the test that proves each protection, and what is still possible.
Last full audit: **Oct 10, 2026** (before launch on Oct 12, 00:00 IST).

**The basic rule.** The phone is never trusted. Every write and every point goes through a Cloud
Function. The server keeps the clock, the answers, the limits and the scores. The phone only shows
what the server sends.

Test locations:

- **Unit tests:** `functions/src/lib/*.test.ts` (`cd functions && npm test`).
- **Emulator tests:** `functions/test/*.test.ts` (`npm run test:emu`, with the emulators running).
- **Browser tests:** `e2e/flows/*.mjs` (`cd e2e && node run.mjs`; Chromium and WebKit, mobile size 375×812).

## A. Answers never reach the phone

| Threat | Protection | Proved by |
|---|---|---|
| Reading the right answer from the app's code | No question, option, explanation or pool id is in the built web bundle. There are no source maps. The text `correctIndex` appears only as a field name in the staff-only Admin page chunk, used by its upload form. The phone screens' code never mentions it. | `e2e/flows/11-security.mjs`: "built bundle has no question text…", "player chunks never mention correctIndex", "no source maps shipped" |
| Downloading the question pool file | `scripts/content/*` is not in `web/public` or `web/dist`. `/question-pool-2026.json` on the site returns the app page, not the file. | 11-security: "web/public has no question/pool files", "web/dist has no…", "…is not served" |
| Reading questions, attempts, the points log or redemptions from Firestore | The Firestore rules deny every client read and write. They're tested for every collection as the owner, another player, a signed-out user and an admin. | `functions/test/rules.test.ts`: read matrix and "no client writes anywhere" (105 tests) |
| The answer in the Start response | `publicChallenge()` builds the response field by field. It never includes `correctIndex`, `accept`, the option order, the explanation or the stored question. | `security.test.ts` A: "startAttempt sends no correctIndex…"; 11-security: "startAttempt response has no answer data" (real pool questions too) |
| The answer in an error message | The not-open, too-late, invalid-input and busy errors carry only a code and a plain message. | `security.test.ts` A: "error messages never contain the right answer" |
| Answer data in the live data stream | All Firestore traffic recorded during play contains no question text. | 11-security: "Firestore traffic … never carries question data" |

After an answer, the right option and its explanation are shown on purpose, so players learn. That
question isn't asked to that player again, and their second try at a Lingo always gets a different
question.

## B. "Pick any answer and win" is impossible

| Threat | Protection | Proved by |
|---|---|---|
| Sharing "the answer is C" | Each attempt shows the 4 options in its own random order, stored on the attempt. The phone sends the position it showed; the server maps it back and scores it. | `security.test.ts` B: "shuffled per attempt…" and "sharing 'the answer is C' doesn't work"; unit test `anticheat.test.ts` (all 24 orders occur) |
| Trying every option | One try at a time, at most 2 tries per Lingo a day, and each try is a different question. Each of the 3 wrong positions fails. | `security.test.ts` B: "each of the 3 wrong positions fails"; `e2e/flows/03-questions.mjs` (all wrong options, both browsers) |
| Sending junk (`-1`, `99`, `"1"`, `null`, `[]`, `{}`, `1.5`, `true`) or extra fields such as `result: "won"` or `points` | The input is checked strictly. Junk is refused and the attempt stays open. Extra fields are ignored. A transcript can't answer a choice question, and a choice can't answer Read Aloud. | `security.test.ts` B: "garbage choices never win", "a transcript can't win a choice question…"; `cheat.test.ts` |

## C. Replays and races

| Threat | Protection | Proved by |
|---|---|---|
| Sending the same answer 5 times in parallel | Scoring runs in one transaction on an open attempt, and the attempt is closed in the same transaction. | `security.test.ts` C: "submitAttempt 5× in parallel → scored once" |
| Pressing Start on 2 tabs or devices at the same moment | Start refuses with "busy" if the player has an open attempt started less than 5 s ago. So only one runs, and only one try or Lingo is used. An older open attempt (a tab left behind) is closed as a miss. | `security.test.ts` C: "startAttempt from 2 devices at the same moment…"; `e2e/flows/04-limits.mjs` (second tab, reload, tab switch) |
| Answering someone else's attempt, an old attempt, or after the timer | The owner is checked. An attempt that's already closed is "not-open". The server's clock decides, with expiry plus a 2 s grace. | `security.test.ts` C: "someone else's attempt, an old attempt, and after expiry + grace…"; `submitAttempt.test.ts`; 03-questions "late right answer" |
| Peeking at the question in one tab, answering in another | Leaving the page (tab switch, lock screen, reload or closing) forfeits the try immediately. A second tab's Start closes the first. Reopening the app closes any open attempt. | `e2e/flows/04-limits.mjs`; `forfeitAttempt.test.ts` |

## D. Firebase App Check

| Threat | Protection | Proved by |
|---|---|---|
| A script calling the functions directly with a real account | Every callable enforces App Check (`setGlobalOptions({ enforceAppCheck })`), and the forfeit endpoint verifies the `X-Firebase-AppCheck` header. The web app gets its tokens from reCAPTCHA Enterprise (invisible). Firestore enforcement is a console switch (see the README). | `security.test.ts` D: "callables refuse a call without an App Check token", "the forfeit endpoint refuses…"; 11-security: "every function call carries an App Check token", "the forfeit request is accepted with its App Check token" |

On the emulators there's no App Check backend, so they decode tokens without checking a signature.
Local play and the tests use an unsigned debug token (`web/src/lib/firebase.ts`,
`functions/test/helpers.ts`). In production, tokens are checked properly by the Admin SDK.

## E. Rate limits

| Threat | Protection | Proved by |
|---|---|---|
| Hammering the functions or bulk-guessing | Each player gets at most **30 calls a minute** and at most **6 Starts a minute**, counted in `limits/{uid}` on the server clock. Anything over gets "Slow down". A refused call isn't counted, so waiting always works. | `security.test.ts` E: "31st call in a minute → 'Slow down'", "7th startAttempt in a minute…"; unit test `anticheat.test.ts` |

## F. Account abuse

| Threat | Protection | Proved by |
|---|---|---|
| Unverified throw-away accounts | Playing needs a verified email. Google accounts are already verified; email and password accounts must click the link. This is checked on profile setup **and** on every play call. | `security.test.ts` F: "an unverified email can't play even with a profile"; `completeProfile.test.ts`; 01-signup |
| One person with several accounts | Admin → **Possible duplicate accounts** groups players by the same name (ignoring accents, spaces and word order), a near spelling ("Ishan" / "Ishaan"), a similar email ("asha.v1@" / "asha.v2@") and accounts made minutes apart. It's a flag only; an admin decides. | `security.test.ts` F: "Possible duplicate accounts…"; unit test `anticheat.test.ts` |
| A caught cheater keeps playing | Admin → **Disable** (on the suspicious, duplicates and top-20 rows). Every play function refuses, they drop off the leaderboard at the next refresh, and their Home says the account is paused. **Enable** undoes it. | `security.test.ts` F: "Disable player: every play function refuses…" |

## G. Voice answers (Read Aloud)

| Threat | Protection | Proved by |
|---|---|---|
| A recording or injected text instead of speaking | These are flags, never blocks: an answer under 1.5 s (voice) or under 0.8 s (tap); 10 or more wins with at least 95% accuracy and an average under 3 s; and, new, **every Read Aloud win a perfect transcript in under 2 s** (5 or more wins). They show in Suspicious players (🎤) and the top-20 CSV (`voice_flag`). | `security.test.ts` G; `flags.test.ts`; unit test `anticheat.test.ts` |

We can't hear the audio. The live final on stage is the real check.

## H. Location

| Threat | Protection | Proved by |
|---|---|---|
| Playing from off campus | Every Start and raid join checks the location against both campuses: Foundation 500 m, University 1000 m. Off campus is refused, and no try is used. | 09-edges: "off campus → refused, no try used", "both campuses accepted" |
| A faked GPS location | A flag if the location jumps 3 km or more (between the campuses, about 4.5 km) in under 5 minutes (📍 in Suspicious players, `location_jumps` in the CSV). | `security.test.ts` H; unit test `anticheat.test.ts` |

## I. Roles and data

| Threat | Protection | Proved by |
|---|---|---|
| Giving yourself admin | Roles are custom claims set only by `scripts/setRole.ts` with admin credentials. The Auth API refuses a user changing their own claims (`INSUFFICIENT_PERMISSION`, checked Oct 10). | Manual check (see the QA report); admin functions refuse non-admins (`admin.test.ts`, `security.test.ts` F, 07-raid) |
| Writing points, levels, favourites, raid counts or leaderboard docs | No client writes anywhere: every path × every client is denied. Favourites change only through `setFavorites` (2 caught Lingos, 1 change). | `rules.test.ts` (105); `setFavorites.test.ts`; 06-screens |

## J. Prize desk

| Threat | Protection | Proved by |
|---|---|---|
| Redeeming twice at the same moment, or spending more than you have | `redeemPrize` (volunteer or admin only) runs in one transaction on the player and the prize: balance (points − spent) must cover the cost, and stock must be above 0. Spent, stock and the redemption are written together. Leaderboard points stay as earned. | `security.test.ts` J: "two desks at the same moment…", "last item in stock…" |

The `/redeem` screen (scan QR → prize → confirm) is still the placeholder planned for Oct 13–16. The
server side is done and tested.

## K. Time

| Threat | Protection | Proved by |
|---|---|---|
| Changing the phone's clock | Timers come from `expiresAt − serverNow`. The IST "today", the daily limits, the game start and lock, and the speed bonus are all computed on the server. Times the client sends are ignored. | `security.test.ts` K; 11-security: "phone 3 days ahead: timer shows 15 s…"; `e2e/flows/01-signup.mjs` countdown |

## What's left (residual risks)

1. **Scanning isn't proved.** The server checks the location, not that the camera saw the poster.
   Someone on campus can open `/catch/lingo-20xx` directly. The limits (4 Lingos, 2 tries, the rate
   limits) cap what this gains: it saves walking, not points.
2. **Sharing answers as text.** After answering, the right option is shown. Friends can tell each
   other "if you get *abundant*, pick *available in large quantities*". The pool has 456 questions,
   no word repeats for a player in a day, and the option order is shuffled, so this helps little.
   Positions can't be shared.
3. **GPS spoofing and emulators.** A determined player can fake GPS. Big jumps are flagged; small
   fakes near campus can't be told apart.
4. **App Check isn't a wall.** A real browser driven by a script still gets tokens. App Check stops
   simple scripts and raises the effort; the rate limits and flags cover the rest. Until the
   reCAPTCHA key is registered and the console switch is on, Firestore isn't App-Check-enforced (it
   is read-only for clients anyway).
5. **Voice can't be heard.** The flags spot patterns, not audio. The on-stage final settles the top 20.
6. **Many real accounts.** One person with many verified emails is limited per account only.
   Duplicates are flagged for a person to judge, so common names (e.g. "Rahul Sharma") will appear
   and need checking.
7. **Players can see their own flags.** A player can read their own user doc, which holds their own
   `flags` / `suspect` / `disabled` values. This only tells a cheater they were flagged.
8. **The live site needs a Hosting redeploy.** Until then, the deployed Admin chunk still has the old
   upload example, which includes 2 real pool answers. It's fixed in the code (QA bug #5).
9. **Disabled players can still load their state.** `getMyState` still answers for them (read-only),
   so the app can show "Your account is paused". Every other function refuses.

## Brand exception (not a security item)

White uppercase DIN Bold labels on the Owl / Macaw buttons are a deliberate brand exception to the
4.5:1 contrast rule (2.09 / 2.44:1). Details and how to undo it: [ACCESSIBILITY.md](ACCESSIBILITY.md).
