import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Loading() {
  return (
    <main className="screen center" aria-busy="true">
      <div className="spinner" />
    </main>
  );
}

/** `/` only: signed-in users go to setup or home. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  if (user === undefined) return <Loading />;
  if (!user) return <>{children}</>;
  if (profile === undefined) return <Loading />;
  return <Navigate to={profile?.profileDone ? "/home" : "/setup"} replace />;
}

/** `/setup` only: must be signed in and not yet set up. */
export function SetupOnly({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  if (user === undefined || (user && profile === undefined)) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (profile?.profileDone) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

/** Everything else: logged out → `/`, no profile → `/setup`. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  if (user === undefined || (user && profile === undefined)) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (!profile?.profileDone) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}
