# Decade Hunt — Spec

## 1. The game in short
- 10 posters on campus, one per DET year (2016–2025). Each poster = one Lingo.
- Scan a poster → its Lingo appears on the camera → tap **Catch it** → one timed challenge.
- Challenge types:
  - **speak** — say the shown phrase out loud (20 s)
  - **meaning** — pick the correct meaning of a word from 4 options (15 s)
- Win → points. Fail / forfeit → no points, uses up a try.
- **One-chance rule:** leaving the app during a challenge (close, tab switch, lock screen, call) forfeits it.
- Leaderboards (students + departments) live until Oct 22, 12:00 IST. Final round on stage Oct 22.

## 2. Game rules & numbers (all stored in `config/game`, editable by admin)
| Rule | Value |
|---|---|
| Tries per Lingo per day | 2 (a win ends the day for that Lingo) |
| speak timer | 20 s |
| meaning timer | 15 s |
| Grace after expiry | 2 s |
| speak pass mark | ≥ 80% of phrase words found in transcript |
| First-ever catch of a Lingo | +100 |
| Repeat catch (new day) | +20 |
| All 10 Lingos caught (once) | +500 |
| Streak bonus (first win of the day) | +10 × streakDays, max +100 |
| Owl Raid catch | +150 |
| Daily cap per user | 500 (bonuses for "all 10" and raids are outside the cap) |
| Location check | must be within `campusRadiusM` of campus centre |

**Streak:** a day counts if the user wins ≥ 1 challenge that IST day. Missing a day resets to 0.

## 3. The one-chance rule (exact behaviour)
1. Catch screen opens → **pre-flight first**: request mic permission (speak) and location. Only after both succeed show the **Start** button. (Permission prompts must never happen during an attempt.)
2. Tap Start → `startAttempt(lingoId, lat, lng)` → server creates `attempts/{id}` with `status: open`, `expiresAt`, returns the challenge (no answer) + `serverNow`.
3. Client countdown = `expiresAt − serverNow` (do not trust the phone clock).
4. While open, listen to `visibilitychange` (hidden) and `pagehide`. On either → send forfeit with `fetch(FORFEIT_URL, { method:'POST', keepalive:true, headers:{Authorization:'Bearer <idToken>'}, body:{attemptId} })` → show "Chance lost".
   - Do NOT use `blur` (fires on harmless things).
   - Cache the ID token when the attempt starts so the forfeit call needs no async work.
5. On app start / Catch screen mount: server auto-forfeits any `open` attempt of this user (`startAttempt` and a `getMyState` call both do this).
6. `submitAttempt` rejects if: not the owner, status ≠ open, or `now > expiresAt + grace` (then marks it `forfeit`).
7. Only one open attempt per user at a time.

## 4. Data model (Firestore)
| Path | Fields | Client read |
|---|---|---|
| `users/{uid}` | name, email, dept, year, roll, points, todayPoints, todayDate, streak, lastWinDate, lingosCaught (number), allTenBonus (bool), profileDone, createdAt | owner only |
| `users/{uid}/catches/{lingoId}` | firstCaughtAt, timesCaught, lastCaughtDate, triesToday, triesDate | owner only |
| `lingos/{lingoId}` | name, detYear, posterIndex (0–9), modelUrl, rarity, color | signed-in |
| `config/game` | startAt, lockAt, locked, campusLat, campusLng, campusRadiusM, rules (table above) | signed-in |
| `challenges/{date}_{lingoId}` | type ('speak'\|'meaning'), phrase? , word?, options? (4), correctIndex? | **never** |
| `attempts/{id}` | uid, lingoId, date, type, raidId?, startedAt, expiresAt, status ('open'\|'won'\|'failed'\|'forfeit'), score? | **never** |
| `rollNumbers/{roll}` | uid | **never** |
| `pointsLog/{id}` | uid, amount, reason, attemptId?, createdAt | **never** |
| `leaderboard/students` | top: [{uid, name, dept, points}] (top 100), updatedAt | signed-in |
| `leaderboard/depts` | rows: [{dept, points, players}], updatedAt | signed-in |
| `raids/{id}` | posterIndex, lingoId, startAt, endAt, minPlayers (20), joined (count), unlocked, status | signed-in |
| `raids/{id}/players/{uid}` | joinedAt | **never** |
| `prizes/{id}` | name, cost, stock | signed-in |
| `redemptions/{id}` | uid, prizeId, cost, byUid, createdAt | **never** |
| `final/state` | round, phrase, contestants[], scores{}, status | signed-in |

Departments (fixed list in `shared/types.ts`): CSE, AI&DS, AI&ML, IT, ECE, EE, ME, CE, Other. Years: 1–4.
Roll number: trim + uppercase before storing; must be unique.

## 5. Cloud Functions
All callable (`onCall`) unless noted. Every one runs the checks in CLAUDE.md rule 6 (except `completeProfile`, `getMyState`, admin ones).

| Function | Input | Logic | Returns |
|---|---|---|---|
| `completeProfile` | name, dept, year, roll | Validate; transaction: fail if `rollNumbers/{roll}` exists or profile done; create user + roll doc | `{ok}` |
| `getMyState` | – | Auto-forfeit open attempts; return user, catches, today's tries | `{user, catches, serverNow}` |
| `startAttempt` | lingoId, lat, lng, raidId? | Game open; on campus; no open attempt; tries left today; load `challenges/{today}_{lingoId}`; create attempt; increment triesToday | `{attemptId, type, phrase? , word?, options?, expiresAt, serverNow}` |
| `submitAttempt` | attemptId, transcript? , choice? | Owner + open + in time; score (speak: word match ≥ 80%; meaning: choice == correctIndex); on win → award points (transaction: points, todayPoints cap, streak, catches, all-10 bonus, pointsLog) | `{result:'won'\|'failed', pointsAdded, bonuses[], newTotal, missedWords?}` |
| `forfeitAttempt` | **HTTP `onRequest`**, header `Authorization: Bearer <idToken>`, body `{attemptId}` | Verify token; if owner + open → `forfeit` | 204 |
| `refreshLeaderboard` | **scheduled**, every 5 min | Top 100 users by points; sum points per dept | – |
| `joinRaid` | raidId, lat, lng | Raid active; on campus; add player; if joined ≥ minPlayers → unlocked | `{joined, unlocked}` |
| `redeemPrize` | uid, prizeId | Caller has role volunteer/admin; balance ≥ cost; stock > 0; deduct + log | `{newBalance}` |
| `adminSetConfig`, `adminUpsertChallenges`, `adminCreateRaid`, `lockGame`, `finalControl` | – | Role admin only | – |

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
| `/setup` | Profile | name, dept, year, roll → `completeProfile` |
| `/home` | Collection | 10 slots (caught = colour + count, not caught = silhouette), points, streak, today's tries, "Scan" button, raid banner if active |
| `/scan` | AR | camera + MindAR (`/assets/targets.mind`, 10 targets); target found → show that Lingo's model + "Catch it" |
| `/catch/:lingoId` | Challenge | pre-flight (mic + location) → Start → timer → speak (mic + live transcript) or meaning (4 buttons) → result |
| `/leaderboard` | Rankings | tabs Students / Departments, own rank pinned at bottom |
| `/me` | Profile | QR of uid (for prizes), stats, share card button, logout |
| `/admin` | Admin | config, upload challenges JSON, create raid, stats, lock game (role admin) |
| `/redeem` | Volunteer | scan QR → user + balance → pick prize → confirm (role volunteer/admin) |
| `/stage` | Big screen | live leaderboard, raid status, final round view |

Bottom nav on Home / Scan / Leaderboard / Me. Large tap targets. Works in portrait only.

## 8. AR details
- Build `targets.mind` from the 10 poster images with the MindAR compiler; target index = `posterIndex`.
- On `targetFound(i)` → load `lingos` where posterIndex == i → show its `.glb` with a gentle idle bob; show "Catch it".
- If the user caught it today or has 0 tries left → show "Come back tomorrow" instead.
- Stop camera + dispose three.js scene when leaving `/scan`.
- iOS Safari and Android Chrome both supported; show "Open in Chrome/Safari" if inside an in-app browser (Instagram/WhatsApp) that blocks camera.

## 9. Content
- `challenges` for 13 days × 10 Lingos = 130 docs, uploaded via `/admin` as JSON:
  `[{date, lingoId, type:'speak', phrase}]` or `[{date, lingoId, type:'meaning', word, options:[4], correctIndex}]`.
- Mix: roughly 60% speak, 40% meaning. Rarer Lingos get longer phrases.

## 10. Final round (Oct 22)
- Top 20 by points at lock. Admin drives `final/state` from `/admin`; `/stage` shows it.
- 3 rounds; each round the stage shows a phrase, contestants speak on the stage device (`/stage` has a "Record for <name>" mode), scored by the same matcher + time bonus; lowest scores eliminated (20 → 10 → 5 → winner).
- Manual override buttons for the host if mic/network fails.
