# Brand files (not in this repository)

The official Duolingo / Duolingo English Test (DET) and JECRC brand files were supplied for the
Decade Hunt event only. **They are not in this repository and must never be committed.** Everything
here except this README is git-ignored (`.gitignore`), and the git history was rewritten to remove
them. Without them the app runs with its placeholder look (`ACTIVE_BRAND = "placeholder"` in
`web/src/config/brand.ts`).

If you have the official kit (from the Duolingo team, and the JECRC logo from JECRC), put the files
back exactly here. Never download, trace or redraw brand art.

| Folder / file | What goes in it | Used for |
|---|---|---|
| `assets/brand/det10/` | DET 10-year lockups and icons (`det_10_*.svg`) | Headers, the DET × JECRC lockup, splash, share card |
| `assets/brand/logos/` | DET horizontal logos (green / black / white) and the DET emblem | Login, About, lockups |
| `assets/brand/mascots/` | Duo pose SVGs (`Duo_*.svg`, `duo_v2_*.svg`) | Each Lingo's art (mapped in `brand.ts` → `lingoArt`), AR standees, empty states |
| `assets/brand/hero/` | Hero illustrations (`*Duo*.svg`, `LinComputer.svg`, …) | Login hero, Me, celebrations |
| `assets/brand/ui-icons/` | DET UI icons | Rules, Me, buttons |
| `assets/brand/emblems/` | Emblems, scallops, DET icons | MAX badge, level looks |
| `assets/brand/jecrc/` | JECRC logo + shield, colour and white (`jecrc-logo*.png`, `jecrc-mark*.png`) | The DET × JECRC lockup |
| `assets/brand/fonts/` | Licensed DET fonts (`DIN_Next_for_Duolingo_*.otf`, `Feather_Bold.otf`) | Built to WOFF2 in `web/public/brand/` (`web/scripts/brand-fonts.py`) |
| `assets/posters/final/` | The 10 campus posters (`poster-01.png` … `poster-10.png`) | Printing; the AR image targets |
| `assets/test-posters/` | Test posters (`test-poster-01.png` …) | Tracking tests |
| `assets/targets.mind` | MindAR targets compiled from the 10 posters | The Scan screen (without it, Scan shows an error) |
| `docs/DET-brand-board.png`, `docs/DET-DESIGN.md` | The DET brand board and design notes | Reference only |

`npm run dev` / `npm run build` (in `web/`) copies what it finds to `web/public/brand/` and
`web/public/assets/` (`web/scripts/sync-assets.mjs`); missing files are skipped. `brand.ts` lists
the exact file names it uses. The do-not-use items (university logos, Operating Principles
graphics, DET China / Japan logos, Red Bull) are never shipped, even when present.

Official look: `ACTIVE_BRAND = "official"` in `web/src/config/brand.ts` (needs the files above).
Placeholder look: `ACTIVE_BRAND = "placeholder"` — one line, no brand files needed.
