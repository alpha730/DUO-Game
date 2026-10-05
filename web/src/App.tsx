import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loading, PublicOnly, RequireProfile, RequireRole, SetupOnly } from "./components/Guards";
import NavLayout from "./components/NavLayout";
import { AuthProvider } from "./lib/auth";
import Home from "./screens/Home";
import Login from "./screens/Login";

// Heavy or staff-only screens load on demand (AR code only on /scan — CLAUDE.md). Day 8: the first
// load carries only Login + Home; Me (QR code), Leaderboard, Favorites and Setup load when opened.
const Setup = lazy(() => import("./screens/Setup"));
const Leaderboard = lazy(() => import("./screens/Leaderboard"));
const Me = lazy(() => import("./screens/Me"));
const Favorites = lazy(() => import("./screens/Favorites"));
const Dex = lazy(() => import("./screens/Dex"));
const Scan = lazy(() => import("./screens/Scan"));
const Catch = lazy(() => import("./screens/Catch"));
const Raid = lazy(() => import("./screens/Raid"));
const Admin = lazy(() => import("./screens/Admin"));
const Redeem = lazy(() => import("./screens/Redeem"));
const Stage = lazy(() => import("./screens/Stage"));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<PublicOnly><Login /></PublicOnly>} />
          {/* DECISION: public camera/tracking test page for real-phone testing before the backend is
              live (no sign-in, no server calls, catching off). Remove at the Day 9 freeze. */}
          <Route path="/ar-test" element={<Scan testMode />} />
          <Route path="/setup" element={<SetupOnly><Setup /></SetupOnly>} />

          <Route element={<RequireProfile><NavLayout /></RequireProfile>}>
            <Route path="/home" element={<Home />} />
            <Route path="/dex" element={<Dex />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/me" element={<Me />} />
          </Route>
          {/* Full-screen camera: no bottom nav (close X goes Home). */}
          <Route path="/scan" element={<RequireProfile><Scan /></RequireProfile>} />
          <Route path="/catch/:lingoId" element={<RequireProfile><Catch /></RequireProfile>} />
          <Route path="/raid/:raidId" element={<RequireProfile><Raid /></RequireProfile>} />
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
