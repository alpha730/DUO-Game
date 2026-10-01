import Placeholder from "../components/Placeholder";
import { useAuth } from "../lib/auth";

export default function Me() {
  const { user, profile, signOut } = useAuth();
  return (
    <main className="screen with-nav stack">
      <h1>{profile?.name}</h1>
      <section className="card small">
        <p>
          {profile?.dept} · Year {profile?.year} · {profile?.roll}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          {user?.email}
        </p>
      </section>
      <Placeholder day={5}>Prize QR code and stats</Placeholder>
      <Placeholder day={7}>Share card</Placeholder>
      <button className="btn secondary" onClick={signOut}>
        Log out
      </button>
    </main>
  );
}
