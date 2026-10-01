import Placeholder from "../components/Placeholder";
import { BRAND } from "../config/brand";

export default function Stage() {
  return (
    <main className="screen stack">
      <h1>{BRAND.gameName} · Stage</h1>
      <Placeholder day={16}>Live leaderboard, raid status, final round (Oct 16–19)</Placeholder>
    </main>
  );
}
