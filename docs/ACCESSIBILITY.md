# Decade Hunt: accessibility notes

## Contrast

Every text colour pair is checked in both themes by `web/scripts/check-contrast.ts`, which runs in CI and before each deploy. The rule is at least 4.5:1, measured, not assumed. The kit's own pairs are below 4.5:1 in several places, so the app uses darker palette colours there:

| Kit pairing | Ratio | What the app uses |
|---|---|---|
| Wolf secondary text on Snow / Polar | 4.48 / 4.18 | Eel |
| Tree Frog text on Sea Sponge (correct) | 2.7 | Eel text; the Tree Frog edge and icon carry the meaning |
| Fire Ant text on Walking Fish (wrong) | 3.5 | Eel text; the Cardinal edge and icon carry the meaning |
| Whale text on Iguana (selected option) | 2.8 | Eel text; the Macaw border marks the selection |
| Macaw / Humpback links on Polar | 2.2 / 4.6 | Narwhal (light), Bluejay (dark) |
| Text on a Cardinal fill | ≤ 4.2 | Danger buttons are outlined, not filled |

## Brand exception: white labels on Owl and Macaw buttons

**Decision (Oct 16, 2026):** buttons filled with Owl (`#58CC02`) or Macaw (`#1CB0F6`) carry **white** uppercase DIN Next Bold labels, as Duolingo and the DET do. White on Owl is **2.09:1** and on Macaw **2.44:1**, below WCAG AA (4.5:1). This is a deliberate brand choice, not an oversight.

Mitigations:

- The labels are short, uppercase, bold and letter-spaced (for example CONTINUE, SCAN A POSTER, RECORD NOW).
- They sit on large, high-contrast 3D buttons with a darker bottom edge.
- Each button's meaning is also clear from its position and icon.
- The same treatment applies to icons on these fills (for example ✓ in pre-flight, the Scan button).
- Disabled buttons are exempt under WCAG 1.4.3 (Swan fill, Hare label).

The check script lists these pairs as `EXC` (brand exception) instead of failing. Every other text pair in both themes is ≥ 4.5:1.

To go back to AA labels, set `onPrimary`, `onAction` and `onAccent` to `DET.mantaRay` in `web/src/config/brand.ts` (one line each). That gives 6.6:1 on Owl and 5.6:1 on Macaw.

## Other

- **Motion:** confetti and celebrations only appear on the Result screen, never during a question.
- **Font size:** the smallest text is 11 px (bottom-nav labels); body text is 16 px.
- **Long names:** they wrap instead of being cut off.
- **Time limits:** every timed question shows the time left as text and to screen readers (`role="timer"`). The timer is part of the game rules.
