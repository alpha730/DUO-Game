"""Converts the DET kit fonts (assets/brand/fonts/*.otf|ttf|woff|woff2) to Latin-subset WOFF2 in
web/public/brand/fonts/ with fixed names that brand.ts looks for:

    feather-bold.woff2                      Feather Bold (headlines)
    din-light / din-regular / din-medium / din-bold .woff2   DIN Next Rounded (UI + body)

Run by scripts/sync-assets.mjs (npm run dev / build). Needs Python 3 + fontTools + brotli
(`pip install fonttools brotli`). Licence: only for this project, as approved by the Duolingo team.
"""
import re
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets" / "brand" / "fonts"
DEST = ROOT / "web" / "public" / "brand" / "fonts"
# Basic Latin + Latin-1 + common punctuation (₹ and the × of "DET × JECRC" included).
LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20B9,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"


def target(name: str) -> str | None:
    n = name.lower()
    if "feather" in n:
        return "feather-bold"
    if "din" in n:
        for w in ("light", "medium", "bold", "regular"):
            if w in n:
                return f"din-{w}"
        return "din-regular"
    return None


def main() -> int:
    if not SRC.exists():
        return 0
    DEST.mkdir(parents=True, exist_ok=True)
    done = []
    for f in sorted(SRC.iterdir()):
        if f.suffix.lower() not in (".otf", ".ttf", ".woff", ".woff2"):
            continue
        t = target(f.stem)
        if t is None:
            print(f"  brand-fonts: skipped {f.name} (not Feather / DIN Next Rounded)")
            continue
        if re.search(r"italic|oblique", f.stem, re.I):
            continue
        out = DEST / f"{t}.woff2"
        subset.main([
            str(f),
            f"--unicodes={LATIN}",
            "--flavor=woff2",
            "--layout-features=*",
            "--no-hinting",
            f"--output-file={out}",
        ])
        done.append(f"{f.name} -> {out.name} ({out.stat().st_size // 1024} KB)")
    for d in done:
        print(f"  brand-fonts: {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
