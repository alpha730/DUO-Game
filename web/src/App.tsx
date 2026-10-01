import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./screens/Login";

function Root() {
  const { user, signOut } = useAuth();
  if (user === undefined) return <main className="screen center"><div className="spinner" /></main>;
  if (!user) return <Login />;
  return (
    <main className="screen center">
      <p>Signed in as {user.email}</p>
      <button className="btn secondary" onClick={signOut}>Log out</button>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="*" element={<Root />} />
      </Routes>
    </AuthProvider>
  );
}
