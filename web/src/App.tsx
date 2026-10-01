import { Route, Routes } from "react-router-dom";
import { BRAND } from "./config/brand";
import { usingEmulators } from "./lib/firebase";

export default function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <main className="screen center">
            <h1>{BRAND.gameName}</h1>
            <p className="muted">{BRAND.tagline}</p>
            {usingEmulators && <p className="muted small">Connected to local emulators</p>}
          </main>
        }
      />
    </Routes>
  );
}
