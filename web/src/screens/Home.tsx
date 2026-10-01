import { Link } from "react-router-dom";
import { LINGO_COUNT } from "@shared/types";
import Placeholder from "../components/Placeholder";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";

export default function Home() {
  const { profile } = useAuth();

  return (
    <main className="screen with-nav stack">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            Hi {profile?.name.split(" ")[0]}
          </p>
          <h1 style={{ margin: 0 }}>{BRAND.gameName}</h1>
        </div>
        <div className="row small" style={{ gap: 8 }}>
          <span className="card" style={{ padding: "6px 10px" }}>🔥 {profile?.streak ?? 0}</span>
          <span className="card" style={{ padding: "6px 10px" }}>⭐ {profile?.points ?? 0}</span>
        </div>
      </header>

      <section className="card">
        <h3>
          Your {BRAND.creatureName}s · {profile?.lingosCaught ?? 0}/{LINGO_COUNT}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {Array.from({ length: LINGO_COUNT }, (_, i) => (
            <div
              key={i}
              aria-label={`${BRAND.creatureName} ${2016 + i}: not caught`}
              style={{
                aspectRatio: "1",
                borderRadius: 12,
                background: "var(--surface-2)",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: "0.7rem",
              }}
            >
              {2016 + i}
            </div>
          ))}
        </div>
      </section>

      <Placeholder day={4}>Live collection, today's tries and raid banner</Placeholder>

      <Link className="btn" to="/scan">
        📷 Scan a poster
      </Link>
    </main>
  );
}
