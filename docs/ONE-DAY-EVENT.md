# Decade Hunt — one-day event (Oct 22)

The game runs on **one day in three rounds**. Rounds replace days: everything that was "per day"
is now "per round", and a favourite's streak counts **rounds in a row**.

Turn it on (or change the times) with:

```
npx tsx scripts/oneDayEvent.ts --prod --project decade-hunt-66f6e --rounds 10:00-11:30,12:30-14:00,15:00-16:00
```

(IST times; `--date 2026-10-22` is the default; `--dry-run` shows what it would write.)
It writes `config/game`: `rounds`, `startAt` = round 1 start, `lockAt` = last round end,
`locked = false`, and `rules` = current rules + `ONE_DAY_RULES` (shared/types.ts).

## Rules

| | |
|---|---|
| Rounds | 3 (default 10:00–11:30, 12:30–14:00, 15:00–16:00 IST). Between rounds new tries are closed ("Round 2 starts at 12:30"). An answer to a question started in a round still counts. |
| Each round | 4 different Lingos, 2 tries each. A catch closes that Lingo for the round. Resets when the next round starts. |
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
- Looks: Lv 1 = the old Lv 2 look, Lv 2 = the old Lv 3 look, MAX = MAX (2D `LingoArt` and the AR standee).
- Without `config.rounds` the multi-day game behaves exactly as before (all old tests pass).
