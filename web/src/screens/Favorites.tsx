import { Link } from "react-router-dom";
import Placeholder from "../components/Placeholder";
import { BRAND } from "../config/brand";
import { useAuth } from "../lib/auth";

export default function Favorites() {
  const { profile } = useAuth();
  return (
    <main className="screen stack">
      <h1>Pick 2 favourites</h1>
      <p className="muted">
        Only favourite {BRAND.creatureName}s build a streak. Catch one 10 days in a row to unlock its MAX form.
      </p>
      <p className="small muted">Changes left: {profile?.favoriteChangesLeft ?? 0}</p>
      <Placeholder day={4}>Choose 2 of your caught {BRAND.creatureName}s → setFavorites (changing resets the streak)</Placeholder>
      <Link className="btn secondary" to="/home">
        Back
      </Link>
    </main>
  );
}
