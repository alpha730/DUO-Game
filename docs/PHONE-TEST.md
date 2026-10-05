# Real-phone checklist (Day 8)

**Before (laptop, once):** Blaze billing on → `npx tsx scripts/seed.ts --prod --project decade-hunt-66f6e --campus <lat>,<lng>,500`
(test mode: game open from today) → `cd web && npm run build && cd .. && firebase deploy -P prod` → sign in once on a phone →
`npx tsx scripts/setRole.ts <you> admin --prod --project decade-hunt-66f6e`.
*Day 9: re-seed with `--real-dates`, run `scripts/loadChallenges.ts --prod`, delete test accounts.*

**Phones:** Android Chrome, iPhone Safari. Do 1–7 on campus Wi-Fi, then again on mobile data. Note model, network, ✓/✗, and the times in 2 and 3.

1. Open **https://decade-hunt-66f6e.web.app** → logo + "Decade Hunt" shows within ~1 s, then the sign-in screen.
2. **Continue with Google** (or Create an account → tap the link in the email → "I've verified") → type your name → **Start hunting** → Home shows "Lingos left today: 4/4" and 10 empty slots. *Time it: under 5 s on mobile data.*
3. **Scan** → Allow camera → hold the phone ~1 m from poster 3 → within ~2 s Zari appears on the poster with a name chip. *First scan on mobile data: note the seconds.*
4. Tap **Catch** → Allow microphone + location → **Start** → answer → "+1xx" with confetti; Home: 1 caught, "Lingos left today: 3/4".
5. Pick a *speak* or *pronounce* Lingo → **Start** → say it → result within ~2 s. *(iPhone: Settings › Safari › Microphone = Allow.)*
6. **Start** another Lingo, then press Home / switch app / lock the screen mid-challenge → come back → "Chance lost", Lingos left went down by 1; scanning that poster again says "Tried today ✗ — back tomorrow".
7. Turn on airplane mode on the Scan screen → "No internet" message → turn it off → **Try again** works.
8. **Instagram:** DM yourself the link, open it inside Instagram → "Open in your browser" card (Android: **Open in Chrome** button; iPhone: ••• → Open in Safari) → the game opens in the real browser.
9. **Me** → QR code visible → **Share my card** → share sheet with the image → Instagram story shows the card.
10. **Leaderboard** → your row appears (≤ 10 min, or /admin → Refresh now).
11. Off campus (e.g. at home): Catch → "You need to be on campus to catch Lingos"; Lingos left unchanged.
12. Turn the phone sideways → "Please turn your phone upright".

## Testing on Wi-Fi before the deploy (laptop + phone)
- Run the emulators and `cd web && npm run dev`; open the "Network" address it prints (e.g. `http://192.168.0.144:5173`) on a phone on the same Wi-Fi. If it doesn't load, allow Node.js / Java through Windows Firewall (private networks).
- That address is plain **http**, so phones block the camera, microphone and location there (the app says "This link isn't secure"). To test them anyway on Android Chrome: open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, set **Enabled**, enter the address (`http://192.168.0.144:5173`), tap **Relaunch**. Turn it off afterwards. iPhone Safari has no such switch — test it on the deployed https link.
