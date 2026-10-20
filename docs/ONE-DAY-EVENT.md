# Decade Hunt — one-day event (Oct 22)

The game runs on **one day in three rounds**. Rounds replace days: everything that was "per day"
is now "per round", and a favourite's streak counts **rounds in a row**.

Turn it on (or change the times) with:

```
npx tsx scripts/oneDayEvent.ts --prod --project decade-hunt-66f6e --rounds 10:00-11:30,12:30-14:00,15:00-16:00
```

(IST times; `--date 2026-10-22` is the default; `--dry-run` shows what it would write.)
It writes `config/game`: `rounds`, `startAt` = round 1 start, `lockAt` = last round end,
`locked = false`, and `rules` = current rules + `ONE_DAY_RULES` (shared/types.ts); and
`public/event` = `{ date, rounds }` — readable by anyone (firestore.rules), so the login screen and
Rules show the round times before sign-in. No client writes it.

Turn the event off again (back to the multi-day game) with `--off`: it removes `rounds` from
`config/game` and deletes `public/event` (times, lock and rules stay as they are).

Before the event, wipe the players' practice data (staff keep their roles and data):

```
npx tsx scripts/resetForEvent.ts --prod --project decade-hunt-66f6e          # dry run: counts only
npx tsx scripts/resetForEvent.ts --prod --project decade-hunt-66f6e --yes    # do it
```

`--delete-users` also deletes the players' Auth accounts and user docs (they sign up again).

## On the day

- `/stage` (admin, laptop → projector, 16:9): round status + countdown, the live top 10 (every
  ~30 s; ★★ Fav MAX = qualified, listed first after the lock), Refresh leaderboard, Lock game, and
  the sudden-death question for a tie at the top (`adminStageQuestion`: a random hard meaning /
  fill-in-the-blank question, never repeated in the session; the answer only on "Reveal answer").
- `/redeem` (volunteer or admin, phone): scan the player's prize QR (Me page) or type the code under
  it → name, points, balance → pick a prize → Confirm (`redeemPrize`).
- `/admin` → Prizes: add / edit / remove prizes (name, cost, stock), with the number redeemed.
- `/ar-test` is staff only.

## Rules

| | |
|---|---|
| Rounds | 3 (default 10:00–11:30, 12:30–14:00, 15:00–16:00 IST). Between rounds new tries are closed ("Round 2 starts at 12:30"). An answer to a question started in a round still counts. |
| Each round | 5 different Lingos, 2 tries each (2 favourites + 3 new, 3 new, 2 new = all 10 by round 3, with 1 spare). A catch closes that Lingo for the round. Resets when the next round starts. |
| Levels | **Three**: Lv 1 → Lv 2 → MAX (level 3 is never given). |
| Favourites | Pick **2** after the first 2 catches. **No changes.** Rounds caught before picking count. |
| Favourite streak | Caught in round 1 → Lv 1 · rounds 1+2 → Lv 2 · rounds 1+2+3 → **MAX** (+1000 once). Miss a round → the streak breaks (no MAX that day). |
| Favourite points | 50 × streak (round 2 in a row = 100, round 3 = 150) + the 100 first catch. |
| Other Lingos | Lv 1 on the first catch, Lv 2 when caught again in a later round, never MAX. |
| Hard questions | A favourite caught in the round before (streak day ≥ 2). Everything else Medium. |
| Winning | Only players with **both favourites at MAX** ("qualified") can win the top prizes. The admin Top-20 export lists qualified players first. |
| Ranking (never a tie) | points → favourites at MAX → accuracy → average answer time → reached the score first → uid. A tie at the very top that survives all of that: a sudden-death question on stage. |

## How it works (code)

- `functions/src/lib/date.ts` `playPeriod(now, config)`: with `config.rounds`, the per-day key is a
  round key `"2026-10-22#R2"` (the current round, else the next one); `isPreviousPeriod` = previous
  round. All per-day fields (attemptsDate, triedDate, wordsDate, lastCaughtDate, lastPlayDate,
  attempt.date) store that key, so the existing equality checks work per round.
- `lib/guards.ts` `requireGameOpen(now, newTry)`: refuses a NEW try between rounds (`between-rounds`).
- `lib/points.ts`: with round keys, every Lingo's `favStreak` counts rounds in a row (so a favourite
  caught before it was picked keeps its round-1 streak); MAX on a favourite increments `users.favMaxCount`.
- `lib/favorites.ts`: the first pick keeps the streaks (`keepStreaksOnFirstPick`).
- `lib/rank.ts`: `favMaxCount` ranks right after points; `isQualified` = 2.
- Web: `getMyState.round` drives the "Round 2 of 3 · until 14:00" line under the HUD and all
  "this round / next round" wording (`web/src/lib/period.ts`); without rounds the old wording stays.
  `useRoundRefresh` (lib/myState.ts) re-fetches getMyState when the round ends or the next starts
  (server time), so Home / Scan / Dex / Leaderboard switch by themselves.
- Looks: Lv 1 = the old Lv 2 look, Lv 2 = the old Lv 3 look, MAX = MAX (2D `LingoArt` and the AR standee).
- Without `config.rounds` the multi-day game behaves exactly as before (all old tests pass).
