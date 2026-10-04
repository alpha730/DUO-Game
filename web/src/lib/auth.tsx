import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { COL, type Role, type UserDoc } from "@shared/types";
import { api } from "./api";
import { auth } from "./firebase";
import { loadLingos } from "./lingos";

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
  /** Fresh token → re-reads the `role` claim (after scripts/setRole.ts). */
  refreshRole: () => Promise<void>;
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
        // Day 8: Home's data starts loading now, not after the profile arrives and Home mounts.
        if (u?.emailVerified) {
          // Its user copy unblocks the profile guard if it beats the realtime listener (usually on
          // 3G); the listener then takes over. No screen reads the profile's timestamp fields.
          api.prefetchMyState().then(
            (s) => {
              if (s.user && auth.currentUser?.uid === u.uid) setProfile((p) => p ?? (s.user as unknown as UserDoc));
            },
            () => {},
          );
          loadLingos().catch(() => {});
        }
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

  const loadRole = useCallback((u: User, force = false) => {
    setRole(undefined);
    return u
      .getIdTokenResult(force)
      .then((t) => setRole((t.claims.role as Role | undefined) ?? null))
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(user === null ? null : undefined);
      return;
    }
    void loadRole(user);
  }, [user, loadRole]);

  /** Fetches a fresh token, so a role just given by scripts/setRole.ts applies without signing out. */
  const refreshRole = useCallback(async () => {
    if (auth.currentUser) await loadRole(auth.currentUser, true);
  }, [loadRole]);

  // Live user doc (owner-readable per firestore.rules), so points/profile update after function calls.
  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    setProfile(undefined);
    let live = true;
    let unsubscribe = () => {};
    void import("./firestore").then(({ db, doc, onSnapshot }) => {
      if (!live) return;
      unsubscribe = onSnapshot(
        doc(db, COL.users, user.uid),
        (snap) => setProfile(snap.exists() ? (snap.data() as UserDoc) : null),
        () => setProfile(null),
      );
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [user]);

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, role, emailVerified, refreshUser, refreshRole, signOut }}>{children}</AuthContext.Provider>
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
