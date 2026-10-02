/**
 * Speed bonus (SPEC §2): +perSecond for every full second left on the server timer when the answer
 * arrived — floor((expiresAt − receivedAt) / 1000), clamped to 0…timer length. Only paid on a win.
 */
export function speedBonus(expiresAtMs: number, receivedAtMs: number, timerSeconds: number, perSecond = 1): number {
  const secondsLeft = Math.floor((expiresAtMs - receivedAtMs) / 1000);
  return Math.min(Math.max(secondsLeft, 0), timerSeconds) * perSecond;
}
