import Placeholder from "../components/Placeholder";
import { useAuth } from "../lib/auth";

/** One student list (rank, name, points) with your own row pinned at the bottom (SPEC §7). */
export default function Leaderboard() {
  const { profile } = useAuth();
  return (
    <main className="screen with-nav stack">
      <h1>Leaderboard</h1>
      <Placeholder day={5}>Top 100 students: rank, name, points</Placeholder>
      <section className="card row board-me" aria-label="Your rank" style={{ justifyContent: "space-between" }}>
        <span className="muted">—</span>
        <strong style={{ flex: 1 }}>{profile?.name} (you)</strong>
        <span>{profile?.points ?? 0} pts</span>
      </section>
    </main>
  );
}
