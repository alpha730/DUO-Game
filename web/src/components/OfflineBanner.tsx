import { useEffect, useState } from "react";

/** Small pill at the top while the phone has no connection (campus Wi-Fi drops happen). */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className="offline-pill" role="status" data-offline>
      <span aria-hidden="true">📶</span> You're offline — we'll reconnect when you're back
    </p>
  );
}
