# Decade Hunt — Claude Code instructions

Campus AR game for the Duolingo English Test 10-year celebration at JECRC, Jaipur.
Students scan 10 posters on campus, a creature ("Lingo") appears on the camera, and they catch it by
speaking a phrase or picking a word's meaning. Points → leaderboard → final round on Oct 22.

**Before any work:** read `docs/SPEC.md` (what to build) and `docs/PLAN.md` (what to build today).
Work only on the current day's tasks in `docs/PLAN.md`, in order.

## Key dates (IST, Asia/Kolkata)
- Build: Oct 1–9 · Game live: **Oct 10, 00:00** · Play locks: **Oct 22, 12:00** · Final round: Oct 22 afternoon
- All "today" logic uses the IST date (`YYYY-MM-DD` in Asia/Kolkata), computed on the server.

## Stack
- `/web` — React 18 + Vite + TypeScript, react-router-dom, Firebase JS SDK (modular)
- AR — `mind-ar` (image tracking, three.js build) + three.js `GLTFLoader`
- Voice — browser `SpeechRecognition` / `webkitSpeechRecognition`, lang `en-IN`
- `/functions` — Firebase Cloud Functions v2, Node 20, TypeScript, region `asia-south1`
- Firestore (asia-south1), Firebase Auth (Google + email/password, **any email**), Firebase Hosting
- `/shared/types.ts` — all shared types; copied into `functions/src/shared` by a prebuild script

## Folder structure
```
/web            React app
/functions      Cloud Functions
/shared         types.ts (single source of truth for data shapes + function I/O)
/scripts        seed + admin scripts (run locally with the emulator or a service account)
/assets         poster images, targets.mind, lingo .glb models
/docs           SPEC.md, PLAN.md
firestore.rules, firestore.indexes.json, firebase.json
```

## Hard rules (never break these)
1. **The phone never writes to Firestore.** Every write goes through a Cloud Function.
2. **Points are only calculated on the server.** The client only displays them.
3. Collections `attempts`, `challenges`, `questions`, `pointsLog`, `redemptions` are **never readable** from the client.
4. The correct answer of a challenge (`correctIndex`, the phrase for future days) is **never sent** to the client before it answers.
5. The server is the timer: an answer received after `expiresAt` (+2 s grace) is rejected, whatever the client says.
6. Every callable function checks: signed in → profile done → game open (`now` between `startAt` and `lockAt`, `locked == false`).
7. Never commit secrets. Firebase web config lives in `web/.env` (`VITE_FIREBASE_*`), which is git-ignored.
8. **Official Duolingo branding is approved (pending final review on Wed Oct 7).** Use the real Duo / DET mascots, logos, fonts and colours, but ONLY through `web/src/config/brand.ts` (names, colours, font families, logo + mascot file paths) and files in `web/public/brand/`. Never hard-code a brand colour, name, font or image path in a component. Keep a `PLACEHOLDER` brand set in the same file and switch with one constant (`ACTIVE_BRAND = 'official' | 'placeholder'`), so if approval is withdrawn on Oct 7 we revert in one line. Use only files supplied by the Duolingo team in `assets/brand/`; never download or redraw brand art yourself. Brand files are not to be reused outside this project.

## How to work
- Do one task at a time from `docs/PLAN.md`. After each task: run it in the emulator, tick the "done when" check, commit.
- Commit messages: `day<N>: <task #> <short description>`.
- Keep functions small: one file per function in `functions/src/fns/`, shared helpers in `functions/src/lib/`.
- Mobile-first: design at 375 px wide; must run on a cheap Android phone over campus Wi-Fi.
- 3D models under 500 KB each (Draco-compressed); lazy-load AR code only on the Scan screen.
- If a task is ambiguous, follow `docs/SPEC.md`; if SPEC is silent, choose the simplest option and leave a `// DECISION:` comment.
- Write unit tests for scoring/matching/date helpers (`functions/src/lib/*.test.ts`, vitest).

## Cost rules (expect 10,000–20,000 daily players)
- **Never read all users** for any total or ranking (leaderboard = top-N query by points only).
- 3D models **under 500 KB** each, **Draco-compressed** (`npx @gltf-transform/cli optimize in.glb out.glb --compress draco`); `npm run build` fails above 500 KB.
- Hosting caches **`/assets/**` for 30 days**; anything that can change there is requested with a content-hash `?v=` (targets.mind, models).
- **Leaderboard and raid listeners only while their screen is open** (no app-wide listeners).
- Leaderboard refresh **every 10 minutes**.

## Commands
- Emulators: `firebase emulators:start`
- Web dev: `cd web && npm run dev`
- Seed emulator: `npx tsx scripts/seed.ts`
- Tests: `cd functions && npm test`
- Deploy: `firebase deploy -P prod` (only after the day's checks pass; default project is the emulator-only `demo-decade-hunt`)
