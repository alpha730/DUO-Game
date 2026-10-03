# Brand files (Duolingo team only)

Only files supplied by the Duolingo team go here (CLAUDE.md rule 8). Never download, trace or
redraw brand art. `npm run dev` / `npm run build` copies `fonts/`, `logos/`, `mascots/` and `models/`
to `web/public/brand/` (`guidelines/` stays private). `web/src/config/brand.ts` switches each official
item on **only when its file exists** — otherwise it keeps the placeholder and lists it as pending.

| Item | Put the file at | Used for |
|---|---|---|
| Logo / wordmark | `logos/logo.svg` | Login screen |
| Square mark | `logos/mark.svg` | Favicon / browser tab |
| Welcome mascot | `mascots/hero.png` | Login screen (above the logo) |
| Celebrate mascot | `mascots/celebrate.png` | Win screen |
| Brand font | `fonts/brand-regular.woff2`, `fonts/brand-bold.woff2` | All text (`@font-face` "BrandFont") |
| Colours, campaign name, Lingo names | `guidelines/` (PDF / notes) | Typed into `OFFICIAL` in brand.ts by hand |

Different file names are fine — then update the paths in `OFFICIAL` in `web/src/config/brand.ts`.
To revert to the placeholder look: `ACTIVE_BRAND = "placeholder"` in that file (one line).
