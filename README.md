# Decade Hunt

The campus AR game for the Duolingo English Test's 10-year celebration at JECRC, Jaipur.
What to build: [docs/SPEC.md](docs/SPEC.md). Security and anti-cheat: [docs/SECURITY.md](docs/SECURITY.md).
Working rules: [CLAUDE.md](CLAUDE.md).

## Run it locally

```bash
firebase emulators:start                # Auth 9099, Firestore 8085, Functions 5001, Hosting 5000, UI 4000
npx tsx scripts/seed.ts                 # 10 Lingos, config (both campuses), question pool, prizes
npx tsx scripts/testUsers.ts            # admin@qa.test, volunteer@qa.test, player1–5@qa.test (password test1234)
cd web && npm run dev                   # http://localhost:5173 (and http://<laptop-ip>:5173 on the same Wi-Fi)
```

## Tests

| What | Command | Needs |
|---|---|---|
| Unit (scoring, matching, dates, anti-cheat helpers) | `cd functions && npm test` | — |
| Emulator (every function, Firestore rules, security) | `cd functions && npm run test:emu` | emulators running + seeded |
| End-to-end, Chromium + WebKit at 375×812 | `cd e2e && npm install && npm run install-browsers && node run.mjs` | emulators + `npm run dev` |
| Colour contrast | `cd web && npx tsx scripts/check-contrast.ts` | — |

`node run.mjs --browser=webkit 03` runs one flow in one browser. Screenshots and logs go to `e2e/out/`.
The E2E flows mock the camera (`window.__posterFound(i)`), microphone, location and speech. The fake
scanner only exists when the app runs against the emulators.

## App Check (do this before going live)

The functions **refuse every call without an App Check token** (anti-cheat D). The web app gets its
tokens from reCAPTCHA v3, which is invisible to players. One-time setup:

1. **reCAPTCHA v3 key.** Go to <https://www.google.com/recaptcha/admin/create> → choose
   *Score based (v3)*. Domains: `decade-hunt-66f6e.web.app`, `decade-hunt-66f6e.firebaseapp.com`
   (and any custom domain). Copy the **site key** and the **secret key**.
2. **Register the app.** Firebase console → *App Check* → *Apps* → the web app → *reCAPTCHA* →
   paste the **secret key** → Save.
3. **Site key in the build.** In `web/.env` (git-ignored), set `VITE_RECAPTCHA_SITE_KEY=<site key>`.
   Then build and deploy Hosting **together with** the functions (see Deploy below).
4. **Firestore enforcement.** Firebase console → *App Check* → *APIs* → *Cloud Firestore*. First
   watch the metrics for about an hour after launch: almost all requests should show as *verified*.
   Then press **Enforce**. Cloud Functions are already enforced in code; there's no console switch
   for them.
5. **Testing a preview from a desktop (optional).** App Check → *Apps* → ⋮ → *Manage debug tokens*
   → add a token. Put it in `VITE_APPCHECK_DEBUG_TOKEN` for that test build only. Never set it for
   the live build. Preview channel domains (`decade-hunt-66f6e--<name>.web.app`) aren't in the
   reCAPTCHA list, so they need this debug token, or add the preview domain to the key.

**Emergency switch.** If App Check blocks real players (for example a reCAPTCHA outage), create
`functions/.env.decade-hunt-66f6e` with `ENFORCE_APP_CHECK=false` and run
`firebase deploy --only functions -P prod`. Remove the line and redeploy afterwards.

On the emulators, App Check uses an unsigned debug token, so local play and tests need no setup.

## Deploy (only after the day's checks pass)

Billing (Blaze) must be on for Cloud Functions. Production project: `decade-hunt-66f6e` (alias `prod`).

```bash
cd functions && npm test && cd ..                         # unit tests
firebase deploy --only firestore:rules,firestore:indexes -P prod
firebase deploy --only functions -P prod                  # needs Blaze
GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/seed.ts --prod --project decade-hunt-66f6e --real-dates
GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/loadQuestions.ts --prod --project decade-hunt-66f6e
cd web && npm run build && cd ..                          # with VITE_RECAPTCHA_SITE_KEY set in web/.env
firebase deploy --only hosting -P prod
GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/setRole.ts <your-email> admin --prod --project decade-hunt-66f6e
```

`key.json` is a service-account key. Never commit it.
