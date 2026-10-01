import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireProfile, SetupOnly } from "./components/Guards";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./screens/Login";
import Setup from "./screens/Setup";

function HomeStub() {
  const { profile, signOut } = useAuth();
  return (
    <main className="screen center">
      <p>Welcome, {profile?.name}</p>
      <button className="btn secondary" onClick={signOut}>Log out</button>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/setup" element={<SetupOnly><Setup /></SetupOnly>} />
        <Route path="/home" element={<RequireProfile><HomeStub /></RequireProfile>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  );
}
