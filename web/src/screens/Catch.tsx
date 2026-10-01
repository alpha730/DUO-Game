import { Link, useParams } from "react-router-dom";
import Placeholder from "../components/Placeholder";

export default function Catch() {
  const { lingoId } = useParams();
  return (
    <main className="screen stack">
      <h1>Catch {lingoId}</h1>
      <Placeholder day={3}>Mic + location check, timed challenge, result</Placeholder>
      <Link className="btn secondary" to="/scan">
        Back to scanning
      </Link>
    </main>
  );
}
