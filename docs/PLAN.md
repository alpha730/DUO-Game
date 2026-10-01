# Decade Hunt — Build plan

One Claude Code session. Do the current day's tasks in order. After each task: test in the emulator, check "Done when", commit.
Rules and data shapes are in `SPEC.md`. If behind schedule, drop items marked *(optional)* first.

| Day | Date | Theme |
|---|---|---|
| 1 | Oct 1 | Setup, login, profile |
| 2 | Oct 2 | AR scanning |
| 3 | Oct 3 | Challenges + one-chance rule |
| 4 | Oct 4 | Points, streaks, bonuses, Home |
| 5 | Oct 5 | Leaderboards, Me page |
| 6 | Oct 6 | Owl Raids |
| 7 | Oct 7 | Admin, content, share card |
| 8 | Oct 8 | Testing + cheating tests |
| 9 | Oct 9 | Fixes, freeze, deploy |
| — | **Oct 10** | **Launch** |
| — | Oct 10–21 | Live ops + redemption + final round tools |
| — | Oct 22 | Lock 12:00, final round, prizes |

---

## Day 1 — Setup, login, profile (Oct 1)
Human does first: create Firebase project (asia-south1), Blaze plan + ₹500 budget alert, enable Google + Email/Password auth, create Firestore, register Web App, put keys in `web/.env`.

| # | Task | Done when |
|---|---|---|
| 1.1 | Init git repo + folder structure from CLAUDE.md, `.gitignore` (node_modules, .env, dist) | Structure exists |
| 1.2 | `firebase init`: Firestore, Functions (TS, Node 20), Hosting (`web/dist`, SPA rewrite), Emulators (Auth, Firestore, Functions, Hosting) | `firebase emulators:start` runs |
| 1.3 | Functions: `setGlobalOptions({region:'asia-south1'})`; folders `fns/`, `lib/`; vitest set up | `npm test` runs (0 tests ok) |
| 1.4 | `/shared/types.ts`: every type in SPEC §4 + all function inputs/outputs from SPEC §5 + DEPARTMENTS, YEARS; prebuild script copies to `functions/src/shared` | Functions build |
| 1.5 | `lib/date.ts`, `lib/geo.ts`, `lib/match.ts` + tests | Tests pass (IST date edge at 23:59/00:01, 80% match cases, punctuation, extra words) |
| 1.6 | `lib/guards.ts`: `requireAuth`, `requireProfile`, `requireGameOpen`, `requireRole` | Used by later functions |
| 1.7 | `firestore.rules` per SPEC §6 + rules unit tests with `@firebase/rules-unit-testing` | Client can't read attempts/challenges, can't write anything |
| 1.8 | `scripts/seed.ts`: 10 lingos (placeholder model URLs), `config/game` (dates, rules, campus centre placeholder), 2 challenges for today (1 speak, 1 meaning), 2 prizes | Emulator has data |
| 1.9 | `completeProfile` (transaction, unique roll) | Duplicate roll rejected; second call rejected |
| 1.10 | `/web`: Vite React TS, react-router, Firebase client (`lib/firebase.ts`, connect to emulators on localhost), `config/brand.ts` | App runs |
| 1.11 | Auth context + Login screen (Google + email/password sign-in/sign-up, errors shown) | Can log in with any email |
| 1.12 | Setup screen → `completeProfile`; route guard (logged out → `/`, no profile → `/setup`) | Can't skip setup |
| 1.13 | Placeholder screens for all routes in SPEC §7 + bottom nav, mobile layout, theme | Every route opens at 375 px |
| 1.14 | `firebase deploy`, open on a real phone | Login + setup work over HTTPS |

## Day 2 — AR scanning (Oct 2)
Human: 10 poster images final (high contrast, lots of detail), `targets.mind` compiled, 10 `.glb` models (< 2 MB; placeholder cubes ok).

| # | Task | Done when |
|---|---|---|
| 2.1 | Install `mind-ar` + `three`; `Scan` screen lazy-loaded | Bundle for other screens unaffected |
| 2.2 | Start MindAR image tracking with `/assets/targets.mind` (10 targets) | Camera opens on Android + iPhone |
| 2.3 | Load `lingos` once; on `targetFound(i)` show matching `.glb` with idle animation; hide on `targetLost` | Pointing at poster 3 shows Lingo 3 |
| 2.4 | Overlay: Lingo name + "Catch it" (→ `/catch/:lingoId`), or "Come back tomorrow" if no tries left (from `getMyState`) | Correct button shows |
| 2.5 | `getMyState` function (auto-forfeits open attempts) | Returns user + catches + serverNow |
| 2.6 | Clean-up: stop camera + dispose scene on leave | No camera light after leaving |
| 2.7 | Camera permission denied / in-app browser → helpful message | Tested inside Instagram browser |
| 2.8 | Model loading spinner, cache models after first load | Second scan is instant |

## Day 3 — Challenges + one-chance rule (Oct 3)
| # | Task | Done when |
|---|---|---|
| 3.1 | `startAttempt` per SPEC §5 (game open, on campus, one open attempt, tries left, challenge without answer) | Returns challenge; answer never in response |
| 3.2 | `submitAttempt` scoring only (points come Day 4): speak → match helper; meaning → correctIndex; expiry + grace | Late answers rejected and marked forfeit |
| 3.3 | `forfeitAttempt` as HTTP `onRequest` with Bearer token, CORS for hosting domain | `curl` with token forfeits |
| 3.4 | Catch screen pre-flight: mic permission (speak) + location, then Start button | No permission prompt appears after Start |
| 3.5 | Timer from `expiresAt − serverNow`; auto-submit/fail at 0 | Changing phone clock does nothing |
| 3.6 | Speak UI: SpeechRecognition `en-IN`, interim transcript shown, stop on final result → submit | Saying the phrase wins |
| 3.7 | Meaning UI: word + 4 big buttons → submit | Right option wins, wrong fails |
| 3.8 | One-chance: `visibilitychange`(hidden) + `pagehide` → `fetch(keepalive)` forfeit with cached token → "Chance lost" | Switching tab mid-attempt forfeits; reload shows attempt forfeited |
| 3.9 | Result screen: won / failed (missed words) / forfeit; tries left today | All 3 states shown |
| 3.10 | Browser without SpeechRecognition + a speak challenge → show "Open in Chrome or Safari" before Start (no try used) | Firefox shows message, tries unchanged |

## Day 4 — Points, streaks, Home (Oct 4)
| # | Task | Done when |
|---|---|---|
| 4.1 | `lib/points.ts`: pure function computing points from (user, catch, now, rules) → amounts + bonuses; unit tests | Tests: first catch, repeat, cap, streak reset, all-10 |
| 4.2 | Wire into `submitAttempt` in one transaction (user, catch doc, pointsLog) | Points correct in emulator |
| 4.3 | `todayPoints` reset when `todayDate` ≠ today; cap 500 | Cap respected |
| 4.4 | Home: 10-slot grid (colour vs silhouette + catch count), points, streak flame, tries today, Scan button | Updates after a catch |
| 4.5 | Win animation + "+100" pop + bonus banners | Looks good on phone |

## Day 5 — Leaderboards + Me (Oct 5)
| # | Task | Done when |
|---|---|---|
| 5.1 | `refreshLeaderboard` scheduled every 5 min (+ admin "refresh now") | Docs update |
| 5.2 | Leaderboard screen: Students / Departments tabs, own rank pinned (own points from user doc; rank "100+" if outside top 100) | Shows correctly |
| 5.3 | Me screen: QR of uid (`qrcode` lib), stats, logout | QR scannable |
| 5.4 | Firestore index for points ordering | No index errors |

## Day 6 — Owl Raids (Oct 6)
| # | Task | Done when |
|---|---|---|
| 6.1 | `adminCreateRaid` (posterIndex, lingoId, start, 15-min window) + `joinRaid` | 20 joins → unlocked |
| 6.2 | Home banner for active raid (listen to `raids` where status active) + countdown | Banner appears live |
| 6.3 | Scan the raid poster during raid → "Join raid" → waiting room with joined count | Count updates live |
| 6.4 | Unlocked → `startAttempt(raidId)` → normal challenge, +150 on win, 1 try per raid | Works end to end |
| 6.5 | *(optional)* Push notifications for raids (FCM) | Notification arrives |

## Day 7 — Admin, content, share card (Oct 7)
| # | Task | Done when |
|---|---|---|
| 7.1 | `scripts/setRole.ts` (admin/volunteer claims) | Role works |
| 7.2 | `/admin`: edit config, upload challenges JSON (validate 4 options, correctIndex 0–3, dates in range), create raid, stats (users, attempts today, wins), refresh leaderboard, lock game | All actions work |
| 7.3 | Load 130 real challenges (Oct 10–22) | Every day × Lingo has one |
| 7.4 | Set real campus centre + radius, real start/lock times | Config final |
| 7.5 | Share card on Me: canvas image "I caught 7/10 Lingos · 1,240 pts" → Web Share API / download | Shares to Instagram |

## Day 8 — Testing (Oct 8)
- [ ] 10+ phones: cheap Android, mid Android, iPhone; Chrome + Safari; campus Wi-Fi + mobile data
- [ ] Models load < 5 s; scan works in daylight and indoor light
- [ ] Cheating tests: switch tab mid-attempt, reload, kill app, change phone clock, call functions from console with fake data, submit after timer, two tabs at once, fake location
- [ ] Same roll number twice → blocked
- [ ] Daily cap, streak across midnight IST
- [ ] Leaderboard updates within 5 min
- [ ] Fix everything found

## Day 9 — Freeze (Oct 9)
- [ ] Only bug fixes; no new features
- [ ] Remove test users/data from production; re-seed real lingos/config/challenges
- [ ] `firebase deploy`; smoke test the live link on 3 phones
- [ ] Posters up; poster QR → live link
- [ ] Game starts automatically Oct 10, 00:00 IST (check `startAt`)

## Live ops (Oct 10–21)
| When | Task |
|---|---|
| Daily | Check function logs + errors; check tomorrow's challenges exist |
| Oct 12, 15, 18 | Run Owl Raids from `/admin` |
| Oct 13–16 | `redeemPrize` + `/redeem` page (camera QR scan → user → prize → confirm) |
| Oct 16–19 | `/stage` big screen + `final/state` + `finalControl` (SPEC §10) |
| Oct 20 | Full rehearsal: redemption + final round with test users |
| Oct 21 | Freeze |

## Oct 22
- 12:00 IST: `lockGame` (also enforced by `lockAt`); leaderboard final refresh; export top 20
- Afternoon: `/stage` final round → winner; redemption desk with ID-card check (roll number must match)
