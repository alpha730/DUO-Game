# Decade Hunt — Spec

## 1. The game in short
- 10 posters on campus, one per DET year (2016–2025). Each poster = one Lingo.
- Scan a poster → its Lingo appears on the camera → tap **Catch it** → one timed challenge.
- Challenge types:
  - **pronounce** — say the shown word out loud correctly (15 s)
  - **speak** — say the shown English sentence out loud (20 s)
  - **meaning** — pick the correct meaning of a word from 4 options (15 s)
  - **question** — answer an English question from 4 options: fill in the blank, pick the correct sentence, synonym/antonym, simple grammar (20 s)
- **Difficulty: medium** (about CEFR B1–B2): not school-basic, not exam-hard. No trick questions.
- Win → points. Fail / forfeit → no points, uses up one of the day's 4 attempts.
- **4 attempts per day**, on any Lingos. A Lingo can be caught at most once per day.
- Each student picks **2 favourite Lingos**. Only favourites build a streak; a 10-day streak turns a favourite into its **MAX** form.
- Non-favourites level up by total catches, so everyone can collect all 10 (2 favourites + 2 others per day).
- **One-chance rule:** leaving the app during a challenge (close, tab switch, lock screen, call) forfeits it.
- One student leaderboard (no departments) live until Oct 22, 12:00 IST. Final round on stage Oct 22.

## 2. Game rules & numbers (all stored in `config/game`, editable by admin)
| Rule | Value |
|---|---|
| Attempts per day (per user) | **4** (won, failed and forfeited all count; raid attempts do NOT count) |
| Same Lingo per day | max 1 **catch** (win). A failed attempt may be retried on the same Lingo with another of the 4 |
| Favourites | **2** per user |
| Favourite changes | 1 allowed for the whole game; the replaced and the new favourite start at streak 0 |
| pronounce timer | 15 s |
| speak timer | 20 s |
| meaning timer | 15 s |
| question timer | 20 s |
| Grace after expiry | 2 s |
| pronounce pass mark | transcript contains the word (or one of its `accept[]` spellings) |
| speak pass mark | ≥ 80% of phrase words found in transcript |
| meaning / question pass mark | choice == correctIndex |
| First-ever catch of any Lingo | +100 (Level 1) |
| Repeat catch, non-favourite | +20 |
| Favourite catch | +20 × that favourite's streak day (day 1 = 20 … day 10 = 200); **capped at 200 per catch from day 10 on** (day 11, 12, … = 200) |
| Favourite reaches 3-day streak | Level 2 |
| Favourite reaches 6-day streak | Level 3 |
| Favourite reaches 10-day streak | **MAX** form + 1,000 bonus (once per Lingo) |
| Non-favourite levels | Level 2 at 3 total catches, Level 3 at 6 total catches (no MAX) |
| All 10 Lingos collected | +1,000 bonus (once) |
| Owl Raid catch | **+150 + speed bonus, instead of** the normal catch points (never +100 / +20 / favourite points); outside the daily 4 (see **Owl Raids** below) |
| **Speed bonus** (every correct answer, incl. raids) | +1 per full second left on the server timer: `floor((expiresAt − receivedAt)/1000)`, clamped 0…timer length |
| Wrong / failed / forfeited attempt | 0 points (and it uses one of the 4 attempts) |
| Logging in, opening the app, days played | 0 points |
| Location check | must be within `campusRadiusM` of campus centre (on the **emulators only** an off-campus player is let through with a logged warning, for testing from home; never skipped in production) |

**Favourite streak:** +1 when the favourite is caught on the IST day right after its last catch. A missed day resets the streak to 0, but **levels never go down**. MAX is permanent once reached.
**Choosing favourites:** after a user's first 2 catches, the app asks them to pick 2 favourites from Lingos they have caught. Until then no streaks count. Last day a 10-day streak can still be completed: start by Oct 12.
**Owl Raids:**
- **Who:** only players who joined that raid (`joinRaid`, on campus). Joining stays open until `endAt`, also after unlock.
- **When:** a raid try can start only while `unlocked == true` and `now < endAt`. A try started before `endAt` may finish after it (normal timer + grace).
- **Tries:** exactly **1 per player per raid**; won, failed and forfeited all use it. Raid tries never use the daily 4.
- **Challenge:** the raid's own challenge (`challenges/raid_{raidId}`, set by the admin when creating the raid), never that day's normal challenge. Same rules: server-only, answer never sent.
- **A raid win counts for the collection:** first catch of that Lingo → catch doc at Level 1, counts toward `lingosCaught` and the all-10 bonus; `timesCaught`++ (so non-favourite levels can rise).
- **A raid win does NOT:** change the favourite streak, MAX, `dayStreak` or `attemptsToday`, or set `lastCaughtDate` ("caught today") — the player can still do a normal catch of that Lingo the same day.
- Logged in `pointsLog` with reason `raid` (+ `speed`, + `allTen` if it completes the set). Wins/losses and answer time count like any attempt.

**Points come only from correct answers.** Every point source above requires a win (catch); nothing is given for logging in or trying.

**Leaderboard order (students):**
1. Points (high → low)
2. Accuracy = wins ÷ (wins + losses), losses = failed + forfeited (high → low)
3. Average answer time = totalAnswerMs ÷ wins (low → high)
4. `pointsReachedAt` — when the user reached their current total (earlier wins)

The same order picks the top 20 for the final round. The live final round on Oct 22 decides the single overall winner.

**Daily streak (overall):** display only, no points. A day counts **only if the user wins at least 1 challenge** that IST day; days with only failed/forfeited attempts do not count. Missing a winning day resets it to 0.

## 3. The one-chance rule (exact behaviour)
1. Catch screen opens → **pre-flight first**: request mic permission (always — the challenge type is only revealed after Start) and location. Only after both succeed show the **Start** button. (Permission prompts must never happen during an attempt.)
2. Tap Start → `startAttempt(lingoId, lat, lng)` → server creates `attempts/{id}` with `status: open`, `expiresAt`, returns the challenge (no answer) + `serverNow`.
3. Client countdown = `expiresAt − serverNow` (do not trust the phone clock).
4. While open, listen to `visibilitychange` (hidden) and `pagehide`. On either → send forfeit with `fetch(FORFEIT_URL, { method:'POST', keepalive:true, headers:{Authorization:'Bearer <idToken>'}, body:{attemptId} })` → show "Chance lost".
   - Do NOT use `blur` (fires on harmless things).
   - Cache the ID token when the attempt starts so the forfeit call needs no async work.
5. On app start / Catch screen mount: server auto-forfeits any `open` attempt of this user (`startAttempt` and a `getMyState` call both do this).
6. `submitAttempt` rejects if: not the owner, status ≠ open, or `now > expiresAt + grace` (then marks it `forfeit`).
7. Only one open attempt per user at a time.
8. **No speech recognition in the browser** (e.g. Firefox): the client sends `speech: false` with `startAttempt`. If that Lingo's challenge today is **pronounce** or **speak**, the server refuses with "Open in Chrome or Safari for this Lingo" — **no attempt is used** and the challenge content is never revealed. **meaning** and **question** work normally.

## 4. Data model (Firestore)
| Path | Fields | Client read |
|---|---|---|
| `users/{uid}` | name, email, points, attemptsToday, attemptsDate, dayStreak, lastPlayDate, lingosCaught (number), allTenBonus (bool), favorites (lingoId[] max 2), favoriteChangesLeft (1), wins, losses, totalAnswerMs, pointsReachedAt, profileDone, createdAt | owner only |
| `users/{uid}/catches/{lingoId}` | firstCaughtAt, timesCaught, lastCaughtDate, level (1\|2\|3\|'MAX'), favStreak, maxBonusGiven (bool) | owner only |
| `lingos/{lingoId}` | name, detYear, posterIndex (0–9), modelUrl, rarity, color | signed-in |
| `config/game` | startAt, lockAt, locked, campusLat, campusLng, campusRadiusM, rules (table above) | signed-in |
| `challenges/{date}_{lingoId}`, `challenges/raid_{raidId}` | type ('pronounce'\|'speak'\|'meaning'\|'question'), word? (pronounce/meaning), accept? (string[], pronounce), phrase? (speak), prompt? (question text), options? (4), correctIndex? | **never** |
| `attempts/{id}` | uid, lingoId, date, type, raidId?, startedAt, expiresAt, status ('open'\|'won'\|'failed'\|'forfeit'), score?, receivedAt?, answerMs?, speedBonus? | **never** |
| `pointsLog/{id}` | uid, amount, reason, attemptId?, createdAt | **never** |
| `leaderboard/students` | top: [{uid, name, points, accuracy, avgAnswerMs}] (top 100, in tie-break order), updatedAt | signed-in |
| `raids/{id}` | posterIndex, lingoId, startAt, endAt, minPlayers (20), joined (count), unlocked, status | signed-in |
| `raids/{id}/players/{uid}` | joinedAt, attemptId? (the player's one raid try) | **never** |
| `prizes/{id}` | name, cost, stock | signed-in |
| `redemptions/{id}` | uid, prizeId, cost, byUid, createdAt | **never** |
| `final/state` | round, phrase, contestants[], scores{}, status | signed-in |

**Profile = name + email only.** No department, year or roll number anywhere in the app.
**Fake-account guard:** email must be verified before Setup (Google accounts are already verified; email/password users must click the verification link first). Prizes are handed over only to the logged-in account shown on the Me screen, and the name must match the student's college ID card.

## 5. Cloud Functions
All callable (`onCall`) unless noted. Every one runs the checks in CLAUDE.md rule 6 (except `completeProfile`, `getMyState`, admin ones).

| Function | Input | Logic | Returns |
|---|---|---|---|
| `completeProfile` | name | Require verified email; name 2–40 chars, trimmed; fail if profile already done; create user with defaults (email from the auth token) | `{ok}` |
| `getMyState` | – | Auto-forfeit open attempts; return user, catches, today's tries | `{user, catches, serverNow}` |
| `startAttempt` | lingoId, lat, lng, raidId?, speech? | Game open; on campus; no open attempt; Lingo not already caught today; attemptsToday < 4 (reset when attemptsDate ≠ today); load `challenges/{today}_{lingoId}`. **With raidId:** raid's Lingo = lingoId; player joined; no try used yet; `unlocked` and `now < endAt`; load `challenges/raid_{raidId}`; skip the caught-today and daily-4 checks; record the try on the player doc; don't touch attemptsToday; if `speech === false` and the type is pronounce/speak → refuse (no attempt used, §3.8); create attempt; increment attemptsToday | `{attemptId, type, word?, phrase?, prompt?, options?, expiresAt, serverNow, attemptsLeft}` (never `accept` or `correctIndex`) |
| `submitAttempt` | attemptId, transcript? , choice? | Owner + open + in time; score (pronounce: word or accept[] in transcript; speak: word match ≥ 80%; meaning/question: choice == correctIndex); on win → one transaction: catch doc (timesCaught, favStreak, level), points per §2 incl. speed bonus, MAX + all-10 bonuses, wins++, totalAnswerMs += answerMs, pointsReachedAt = now, dayStreak, pointsLog; on fail → losses++ (forfeits also do losses++). **Raid attempt** (challenge `raid_{raidId}`): win = raidCatchPoints + speed (+ all-10) per §2 Owl Raids, no favourite/day-streak/caught-today changes | `{result:'won'\|'failed', pointsAdded, speedBonus, bonuses[], newLevel, favStreak?, newTotal, missedWords?, needsFavorites, raid?}` |
| `setFavorites` | lingoIds (exactly 2, both already caught) | First time: save. Later: only if favoriteChangesLeft > 0; decrement; new favourite starts favStreak 0 | `{favorites, favoriteChangesLeft}` |
| `forfeitAttempt` | **HTTP `onRequest`**, header `Authorization: Bearer <idToken>`, body `{attemptId}` | Verify token; if owner + open → `forfeit` and the user's losses++ (same when an expired or auto-forfeited attempt is closed) | 204 |
| `refreshLeaderboard` | **scheduled**, every 10 min | Query top 300 users by points, sort in code by the tie-break order in §2, keep top 100 | – |
| `joinRaid` | raidId, lat, lng | Raid active (until endAt, also after unlock); on campus; add player (once); if joined ≥ minPlayers → unlocked | `{joined, unlocked, tried}` |
| `redeemPrize` | uid, prizeId | Caller has role volunteer/admin; balance ≥ cost; stock > 0; deduct + log | `{newBalance}` |
| `adminCreateRaid` | posterIndex, lingoId, startAt, minutes? (15), minPlayers? (20), challenge (same shape as a normal challenge) | Role admin only; Lingo on that poster; validate the challenge; write `raids/{id}` + `challenges/raid_{id}` together | `{raidId}` |
| `adminSetConfig`, `adminUpsertChallenges`, `lockGame`, `finalControl` | – | Role admin only | – |

Roles = custom claims `{role:'admin'|'volunteer'}` set by `scripts/setRole.ts`.

**Speech matching helper** (`functions/src/lib/match.ts`): lowercase, remove punctuation, collapse spaces, split words; score = phrase words found in transcript words ÷ phrase words; pass ≥ 0.8. Return missed words.

**Date helper** (`functions/src/lib/date.ts`): `istDate(now)` → `YYYY-MM-DD` in Asia/Kolkata; `isYesterday(a,b)`.

**Distance helper** (`functions/src/lib/geo.ts`): haversine metres.

## 6. Security rules (summary)
- Default deny.
- `users/{uid}` and `users/{uid}/catches/*`: `allow read: if request.auth.uid == uid;` no writes.
- `lingos/*`, `config/*`, `leaderboard/*`, `raids/{id}` (not players), `prizes/*`, `final/*`: read if signed in; no writes.
- Everything else: no read, no write.

## 7. Screens (`/web`)
| Route | Screen | Contents |
|---|---|---|
| `/` | Login | Google button, email/password form, sign-up toggle |
| `/setup` | Profile | name only (email shown read-only) → `completeProfile`; email/password users see "Verify your email" first |
| `/home` | Collection | top: 2 favourite cards (Lingo, level, 🔥 streak "Day 6/10", "caught today ✓/not yet"); 10-slot grid (caught = colour + level badge, not caught = silhouette); points, "Attempts left today: 3/4", "Scan" button, raid banner if active |
| `/favorites` | Pick favourites | shown after the first 2 catches (and from Me, if a change is left); choose 2 of caught Lingos → `setFavorites`; warns that changing resets the streak |
| `/scan` | AR | camera + MindAR (`/assets/targets.mind`, 10 targets); target found → show that Lingo's model + "Catch it" |
| `/catch/:lingoId` | Challenge | pre-flight (mic + location) → Start → timer → pronounce / speak (mic + live transcript) or meaning / question (prompt + 4 buttons) → result |
| `/leaderboard` | Rankings | one list of students (rank, name, points), own rank pinned at bottom |
| `/me` | Profile | QR of uid (for prizes), stats, share card button, logout |
| `/admin` | Admin | config, upload challenges JSON, create raid, stats, lock game (role admin) |
| `/redeem` | Volunteer | scan QR → user + balance → pick prize → confirm (role volunteer/admin) |
| `/stage` | Big screen | live leaderboard, raid status, final round view |

Bottom nav on Home / Scan / Leaderboard / Me. Large tap targets. Works in portrait only.

## 8. AR details
- Build `targets.mind` from the 10 poster images with the MindAR compiler; target index = `posterIndex`.
- On `targetFound(i)` → load `lingos` where posterIndex == i → show its `.glb` with a gentle idle bob; show "Catch it".
- If the user already caught this Lingo today → "Caught today ✓ — come back tomorrow"; if 0 attempts left today → "No attempts left today". Otherwise "Catch it" (favourites also show their streak, e.g. "🔥 Day 4 — keep it going").
- Stop camera + dispose three.js scene when leaving `/scan`.
- iOS Safari and Android Chrome both supported; show "Open in Chrome/Safari" if inside an in-app browser (Instagram/WhatsApp) that blocks camera.

## 9. Content
- `challenges` for 13 days × 10 Lingos = 130 docs, uploaded via `/admin` as JSON:
  `{date, lingoId, type:'pronounce', word, accept?}` · `{date, lingoId, type:'speak', phrase}` ·
  `{date, lingoId, type:'meaning', word, options:[4], correctIndex}` · `{date, lingoId, type:'question', prompt, options:[4], correctIndex}`.
- Mix: about 25% each type, spread so a student doesn't get the same type 4 times in a day.
- All medium difficulty (B1–B2). Examples:
  - pronounce: "comfortable", "entrepreneur", "schedule"
  - speak: "Practice every day and you will see the difference."
  - meaning: "Reluctant" → unwilling / excited / tired / careful
  - question: "She has been working here ___ 2022." → since / for / from / at

## 10. Final round (Oct 22)
- Top 20 at lock, using the full leaderboard order (points → accuracy → avg answer time → reached first). Admin drives `final/state` from `/admin`; `/stage` shows it.
- 3 rounds; each round the stage shows a phrase, contestants speak on the stage device (`/stage` has a "Record for <name>" mode), scored by the same matcher + time bonus; lowest scores eliminated (20 → 10 → 5 → winner).
- Manual override buttons for the host if mic/network fails.
