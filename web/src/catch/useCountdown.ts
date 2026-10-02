import { useEffect, useRef, useState } from "react";

/**
 * Countdown for an attempt (SPEC §3.3): total = expiresAt − serverNow from the server, elapsed is
 * measured with performance.now() (monotonic) — so changing the phone's clock changes nothing.
 * Calls onExpire once when it reaches 0.
 */
export function useCountdown(expiresAt: number, serverNow: number, onExpire: () => void) {
  const totalMs = Math.max(0, expiresAt - serverNow);
  const t0 = useRef(performance.now());
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const [leftMs, setLeftMs] = useState(totalMs);

  useEffect(() => {
    t0.current = performance.now();
    fired.current = false;
    const tick = () => {
      const left = Math.max(0, totalMs - (performance.now() - t0.current));
      setLeftMs(left);
      if (left === 0 && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [totalMs]);

  return { leftMs, totalMs, seconds: Math.ceil(leftMs / 1000) };
}
