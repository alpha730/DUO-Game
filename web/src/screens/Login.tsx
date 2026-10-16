import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import CoBrand from "../components/CoBrand";
import { CheckIcon } from "../components/Icons";
import { HeroArt, PatternBg } from "../components/BrandArt";
import { BRAND } from "../config/brand";
import { authErrorMessage } from "../lib/auth";
import { auth } from "../lib/firebase";

const IGNORED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export default function Login() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      // Route guard moves us on once auth state changes.
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (!IGNORED.has(code)) setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const google = () =>
    run(async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        // Some mobile browsers block popups; fall back to a full-page redirect.
        if ((err as { code?: string }).code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
        else throw err;
      }
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    run(() =>
      mode === "signIn"
        ? signInWithEmailAndPassword(auth, trimmed, password)
        : createUserWithEmailAndPassword(auth, trimmed, password).then((cred) =>
            // Verification link first; /setup shows "Verify your email" until it's clicked.
            sendEmailVerification(cred.user).catch(() => {}),
          ),
    );
  };

  return (
    <main className="screen login has-pattern">
      <PatternBg />
      <header className="login-lockup">
        <CoBrand />
      </header>
      <section className="login-hero">
        <div className="login-hero-text">
          <p className="eyebrow">{BRAND.appName}</p>
          {/* Feather headline (DET-DESIGN §2): lowercase, ≥ 40 px, ≤ 10 words, left-aligned. */}
          <h1 className="headline">ready to show your English?</h1>
          <ul className="ticks">
            <li>
              <CheckIcon /> Find 10 posters on campus
            </li>
            <li>
              <CheckIcon /> Catch each {BRAND.creatureName} with a quick English question
            </li>
            <li>
              <CheckIcon /> Top the leaderboard before the final on Oct 22
            </li>
          </ul>
          <Link className="rules-link" to="/rules" data-rules-link>
            Read the game rules →
          </Link>
        </div>
        <div className="login-hero-art">
          <HeroArt name="beaComputerDuo" />
        </div>
      </section>
      <div className="stack login-form">

        <button className="btn secondary" onClick={google} disabled={busy}>
          <GoogleIcon /> Continue with Google
        </button>

        <div className="divider">or</div>

        <form className="stack" onSubmit={submit} noValidate>
          <label className="field">
            Email
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="btn big" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signIn" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="btn link"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError("");
          }}
        >
          {mode === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
