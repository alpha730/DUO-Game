import { Link } from "react-router-dom";
import Placeholder from "../components/Placeholder";
import { useAuth } from "../lib/auth";

export default function Me() {
  const { user, profile, signOut } = useAuth();
  return (
    <main className="screen with-nav stack">
      <h1>{profile?.name}</h1>
      <section className="card small">
        <p className="muted" style={{ margin: 0 }}>
          {user?.email}
        </p>
      </section>
      {profile && (profile.favorites.length === 0 || profile.favoriteChangesLeft > 0) && (
        <Link className="btn secondary" to="/favorites">
          {profile.favorites.length === 0 ? "⭐ Pick your 2 favourites" : `⭐ Change favourites (${profile.favoriteChangesLeft} left)`}
        </Link>
      )}
      <Placeholder day={5}>Prize QR code and stats</Placeholder>
      <Placeholder day={7}>Share card</Placeholder>
      <button className="btn secondary" onClick={signOut}>
        Log out
      </button>
    </main>
  );
}
