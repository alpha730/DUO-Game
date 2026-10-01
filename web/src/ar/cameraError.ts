export type CameraProblem = "denied" | "noCamera" | "busy" | "unsupported" | "unknown";

export class CameraError extends Error {
  constructor(
    readonly problem: CameraProblem,
    readonly cause?: unknown,
  ) {
    super(`camera: ${problem}`);
  }
}

/** Maps a getUserMedia DOMException name to what we tell the player. */
export function classifyCameraError(err: unknown): CameraProblem {
  const name = (err as { name?: string } | undefined)?.name ?? "";
  if (/NotAllowed|PermissionDenied|Security/.test(name)) return "denied";
  if (/NotFound|DevicesNotFound|Overconstrained/.test(name)) return "noCamera";
  if (/NotReadable|TrackStart|Abort/.test(name)) return "busy";
  return "unknown";
}

/** Runs `start` while recording the real getUserMedia error (MindAR swallows it and rejects with nothing). */
export async function withCameraErrors(start: () => Promise<void>): Promise<void> {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) throw new CameraError("unsupported");
  const original = md.getUserMedia;
  let cameraErr: unknown;
  md.getUserMedia = (constraints) =>
    original.call(md, constraints).catch((err: unknown) => {
      cameraErr = err;
      throw err;
    });
  try {
    await start();
  } catch (err) {
    if (cameraErr) throw new CameraError(classifyCameraError(cameraErr), cameraErr);
    throw err ?? new CameraError("unknown");
  } finally {
    md.getUserMedia = original;
  }
}
