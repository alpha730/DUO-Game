import type { ReactNode } from "react";
import type { Role } from "@shared/types";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import VerifyEmail from "../screens/VerifyEmail";

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

/** `/setup` only: must be signed in and not yet set up; unverified emails see "Verify your email". */
export function SetupOnly({ children }: { children: ReactNode }) {
  const { user, profile, emailVerified } = useAuth();
  if (user === undefined || (user && profile === undefined)) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (profile?.profileDone) return <Navigate to="/home" replace />;
  if (!emailVerified) return <VerifyEmail />;
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

/** Role-gated screens (custom claim `role`, set by scripts/setRole.ts). */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, role } = useAuth();
  if (user === undefined || (user && role === undefined)) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (!role || !roles.includes(role)) {
    return (
      <main className="screen center">
        <h2>Staff only</h2>
        <p className="muted">This page is for {roles.join(" / ")} accounts.</p>
        <Link className="btn secondary" to="/home">Back to the hunt</Link>
      </main>
    );
  }
  return <>{children}</>;
}
