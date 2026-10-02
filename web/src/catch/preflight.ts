// Pre-flight (SPEC §3.1): every permission prompt happens BEFORE Start, never during an attempt.

export type CheckState = "idle" | "asking" | "ok" | "denied" | "unavailable";

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Asks for the microphone (needed for pronounce/speak; the type is only known after Start). */
export async function requestMic(): Promise<CheckState> {
  if (!navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // permission is what we wanted, not the stream
    return "ok";
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    return /NotAllowed|PermissionDenied|Security/.test(name) ? "denied" : "unavailable";
  }
}

/** Asks for location and returns a fix (the server checks the campus radius). */
export function requestLocation(): Promise<{ state: CheckState; position?: Position }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ state: "unavailable" });
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          state: "ok",
          position: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy },
        }),
      (err) => resolve({ state: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}
