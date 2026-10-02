import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { COL, type Role, type UserDoc } from "@shared/types";
import { auth, db } from "./firebase";

interface AuthState {
  /** undefined while Firebase restores the session */
  user: User | null | undefined;
  /** undefined while loading; null if the user doc doesn't exist yet */
  profile: UserDoc | null | undefined;
  /** undefined while loading; null for players */
  role: Role | null | undefined;
  /** Email verified (Google accounts always are). Required before Setup (SPEC §4). */
  emailVerified: boolean;
  /** Re-reads the account after the player clicked the verification link (and refreshes the token). */
  refreshUser: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserDoc | null | undefined>(undefined);
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setEmailVerified(!!u?.emailVerified);
      }),
    [],
  );

  const refreshUser = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return false;
    await u.reload();
    // A fresh ID token carries email_verified, which completeProfile checks on the server.
    if (u.emailVerified) await u.getIdToken(true);
    setEmailVerified(u.emailVerified);
    return u.emailVerified;
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(user === null ? null : undefined);
      return;
    }
    setRole(undefined);
    user
      .getIdTokenResult()
      .then((t) => setRole((t.claims.role as Role | undefined) ?? null))
      .catch(() => setRole(null));
  }, [user]);

  // Live user doc (owner-readable per firestore.rules), so points/profile update after function calls.
  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    return onSnapshot(
      doc(db, COL.users, user.uid),
      (snap) => setProfile(snap.exists() ? (snap.data() as UserDoc) : null),
      () => setProfile(null),
    );
  }, [user]);

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, role, emailVerified, refreshUser, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "No account with that email. Tap “Create an account”.",
  "auth/email-already-in-use": "That email already has an account. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
  "auth/network-request-failed": "No internet connection. Check Wi-Fi or mobile data.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/operation-not-supported-in-this-environment": "Google sign-in doesn't work in this app. Open the link in Chrome or Safari.",
  "auth/web-storage-unsupported": "Google sign-in doesn't work in this app. Open the link in Chrome or Safari.",
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? "Something went wrong. Please try again.";
}
