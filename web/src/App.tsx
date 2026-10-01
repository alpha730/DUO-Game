import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loading, PublicOnly, RequireProfile, RequireRole, SetupOnly } from "./components/Guards";
import NavLayout from "./components/NavLayout";
import { AuthProvider } from "./lib/auth";
import Favorites from "./screens/Favorites";
import Home from "./screens/Home";
import Leaderboard from "./screens/Leaderboard";
import Login from "./screens/Login";
import Me from "./screens/Me";
import Setup from "./screens/Setup";

// Heavy or staff-only screens load on demand (AR code only on /scan — CLAUDE.md).
const Scan = lazy(() => import("./screens/Scan"));
const Catch = lazy(() => import("./screens/Catch"));
const Admin = lazy(() => import("./screens/Admin"));
const Redeem = lazy(() => import("./screens/Redeem"));
const Stage = lazy(() => import("./screens/Stage"));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/setup" element={<SetupOnly><Setup /></SetupOnly>} />

          <Route element={<RequireProfile><NavLayout /></RequireProfile>}>
            <Route path="/home" element={<Home />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/me" element={<Me />} />
          </Route>
          <Route path="/catch/:lingoId" element={<RequireProfile><Catch /></RequireProfile>} />
          <Route path="/favorites" element={<RequireProfile><Favorites /></RequireProfile>} />

          <Route path="/admin" element={<RequireRole roles={["admin"]}><Admin /></RequireRole>} />
          <Route path="/redeem" element={<RequireRole roles={["admin", "volunteer"]}><Redeem /></RequireRole>} />
          {/* DECISION: /stage is driven by admins (SPEC §10), so it is admin-only. */}
          <Route path="/stage" element={<RequireRole roles={["admin"]}><Stage /></RequireRole>} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
      <div className="rotate-notice">
        <p>Please turn your phone upright 📱</p>
      </div>
    </AuthProvider>
  );
}
