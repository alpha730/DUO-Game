import { sendEmailVerification } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import CoBrand from "../components/CoBrand";
import Mascot from "../components/Mascot";
import { authErrorMessage, useAuth } from "../lib/auth";
import { app, auth, usingEmulators } from "../lib/firebase";

/**
 * Email/password players must verify their email before Setup (SPEC §4 fake-account guard).
 * Google accounts never see this.
 */
export default function VerifyEmail() {
  const { user, refreshUser, signOut } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(
    async (quiet = false) => {
      setBusy(true);
      try {
        const ok = await refreshUser();
        if (!ok && !quiet) setMsg("Not verified yet — open the link in the email, then tap the button again.");
      } catch (err) {
        if (!quiet) setMsg(authErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [refreshUser],
  );

  // Coming back from the email app → check automatically.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void check(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  async function resend() {
    if (!auth.currentUser) return;
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setMsg("Sent! Check your inbox (and the spam folder).");
    } catch (err) {
      setMsg(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Emulator only: the Auth emulator doesn't send real email; open its stored link instead.
  async function emulatorVerify() {
    setBusy(true);
    try {
      const host = `http://${location.hostname}:9099`;
      const res = await fetch(`${host}/emulator/v1/projects/${app.options.projectId}/oobCodes`).then((r) => r.json());
      const codes = (res.oobCodes as Array<{ email: string; requestType: string; oobLink: string }>).filter(
        (c) => c.requestType === "VERIFY_EMAIL" && c.email.toLowerCase() === user?.email?.toLowerCase(),
      );
      if (!codes.length) {
        setMsg("No verification link yet — tap “Resend link” first.");
        return;
      }
      await fetch(codes[codes.length - 1].oobLink);
      await check();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen stack">
      <header className="topbar">
        <CoBrand />
      </header>
      <section className="login-hero compact">
        <div className="login-hero-art">
          <Mascot slot="hero" mood="wow" badge="✉️" />
        </div>
        <h1>Verify your email</h1>
        <p>
          We sent a link to <strong>{user?.email}</strong>. Open it, then come back here.
        </p>
        <p className="small muted">This keeps the leaderboard fair: one real account per student.</p>
      </section>
      {msg && (
        <p className="card small" role="status">
          {msg}
        </p>
      )}
      <button className="btn" onClick={() => check()} disabled={busy}>
        I've verified
      </button>
      <button className="btn secondary" onClick={resend} disabled={busy}>
        Resend link
      </button>
      {usingEmulators && (
        <button className="btn secondary" onClick={emulatorVerify} disabled={busy}>
          Open the verification link (emulator)
        </button>
      )}
      <button className="btn link" onClick={signOut}>
        Use a different account
      </button>
    </main>
  );
}
