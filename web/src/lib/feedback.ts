// Game feel: haptics (navigator.vibrate — silently absent on iPhone) and short sound effects
// (web/public/sfx, made by scripts/make-sfx.mjs). Sounds are fetched after the player's first tap,
// which also unlocks audio (iOS only allows it from a user gesture). Mute is saved per phone.

export type Sfx = "found" | "correct" | "wrong" | "levelup" | "tick";
const SOUNDS: Sfx[] = ["found", "correct", "wrong", "levelup", "tick"];
const MUTE_KEY = "dh-muted";

let audio: AudioContext | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // private mode: mute lasts for this visit only
  }
}

/** First tap: create/resume the AudioContext (iOS rule) and preload the sounds. */
function unlock(): void {
  if (audio) return;
  const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    audio = new Ctx();
  } catch {
    return;
  }
  const ctx = audio;
  void ctx.resume?.().catch(() => {});
  // A silent one-sample buffer played inside the gesture finishes the unlock on older iOS.
  const blank = ctx.createBufferSource();
  blank.buffer = ctx.createBuffer(1, 1, 22050);
  blank.connect(ctx.destination);
  blank.start(0);
  for (const name of SOUNDS) {
    fetch(`/sfx/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => buffers.set(name, buf))
      .catch(() => {});
  }
}

export function play(name: Sfx): void {
  if (muted || !audio) return;
  const buf = buffers.get(name);
  if (!buf) return;
  try {
    if (audio.state === "suspended") void audio.resume();
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    src.start();
  } catch {
    // never let a sound break the game
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported (iPhone) — fine
  }
}

export const haptic = {
  tap: () => vibrate(10),
  found: () => vibrate(30),
  tick: () => vibrate(15),
  win: () => vibrate([30, 60, 30, 60, 120]),
  fail: () => vibrate([60, 90, 60]),
};

/** App start: unlock audio on the first tap, and a 10 ms tap on every button press. */
export function installFeedback(): void {
  document.addEventListener("pointerdown", unlock, { capture: true, once: true });
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, .btn, .choice, .bottom-nav a");
      if (el && !(el as HTMLButtonElement).disabled) haptic.tap();
    },
    { capture: true, passive: true },
  );
}
